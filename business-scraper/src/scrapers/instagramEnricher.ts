import axios from 'axios';
import { chromium } from 'playwright';
import { Logger } from '../utils/logger';

export interface InstagramProfileData {
  username: string;
  fullName?: string;
  bio?: string;
  website?: string;       // link in bio (already resolved from l.instagram.com redirect)
  email?: string;
  phone?: string;
  isPrivate?: boolean;
  followersCount?: number;
}

export class InstagramEnricher {
  // ── Strategy 1: Instagram internal JSON API ────────────────────────────────
  // Works for public profiles without authentication.
  // Uses the same endpoint the web app calls.
  private async tryApiEndpoint(username: string): Promise<InstagramProfileData | null> {
    try {
      const response = await axios.get(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            // Mobile Safari UA — Instagram API is less aggressive with mobile clients
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
            'X-IG-App-ID': '936619743392459',
            'Accept': '*/*',
            'Accept-Language': 'es-AR,es;q=0.9',
            'Referer': `https://www.instagram.com/${username}/`,
            'Origin': 'https://www.instagram.com',
          },
          timeout: 10000,
        },
      );

      const user = (response.data as { data?: { user?: Record<string, unknown> } })?.data?.user;
      if (!user) return null;

      return {
        username: String(user.username ?? username),
        fullName: user.full_name ? String(user.full_name) : undefined,
        bio: user.biography ? String(user.biography) : undefined,
        website: user.external_url ? String(user.external_url) : undefined,
        isPrivate: Boolean(user.is_private),
        followersCount: (user.edge_followed_by as { count?: number })?.count ?? undefined,
      };
    } catch {
      Logger.debug(`[IG Enricher] API endpoint sin resultado para @${username}`);
      return null;
    }
  }

  // ── Strategy 2: Playwright — for profiles blocked by the API ──────────────
  // Navigates to the public profile page and extracts data from:
  //   a) window.__additionalDataLoaded / script[type="application/json"] (JSON embed)
  //   b) DOM elements as fallback
  private async tryPlaywright(username: string): Promise<InstagramProfileData | null> {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 },
        extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9' },
      });
      const page = await context.newPage();
      // Block media — we only need HTML + scripts
      await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,svg,mp4,m4v}', r => r.abort());

      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await page.waitForTimeout(3000);

      // Bail if we hit the login wall
      const loginWall = await page.locator('input[name="username"]').count().catch(() => 0);
      if (loginWall > 0) {
        Logger.warn(`[IG Enricher] Login wall detectado para @${username}`);
        return null;
      }

      // ── a) Try embedded JSON data first ────────────────────────────────
      const profileJson = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse((script as HTMLScriptElement).textContent ?? '') as {
              data?: { user?: Record<string, unknown> };
              user?: Record<string, unknown>;
            };
            if (data?.data?.user) return data.data.user;
            if (data?.user) return data.user;
          } catch { /* not JSON or wrong shape */ }
        }
        return null;
      }) as Record<string, unknown> | null;

      if (profileJson) {
        return {
          username: String(profileJson.username ?? username),
          fullName: profileJson.full_name ? String(profileJson.full_name) : undefined,
          bio: profileJson.biography ? String(profileJson.biography) : undefined,
          website: profileJson.external_url ? String(profileJson.external_url) : undefined,
          isPrivate: Boolean(profileJson.is_private),
        };
      }

      // ── b) DOM fallback ─────────────────────────────────────────────────
      // Bio: multiple selectors — Instagram redesigns frequently
      const bio =
        await page.locator('[data-testid="user-description"]').textContent().catch(() => null) ??
        await page.locator('header section div > span').first().textContent().catch(() => null) ??
        await page.locator('h1 + div span').first().textContent().catch(() => null);

      // Website link in bio goes through l.instagram.com redirect — extract the target URL
      const rawWebsiteHref = await page.locator('a[href*="l.instagram.com"]').first()
        .getAttribute('href').catch(() => null);
      let website: string | undefined;
      if (rawWebsiteHref) {
        try {
          const parsed = new URL(rawWebsiteHref);
          website = decodeURIComponent(parsed.searchParams.get('u') ?? rawWebsiteHref);
        } catch {
          website = rawWebsiteHref;
        }
      }

      const phoneHref = await page.locator('a[href^="tel:"]').first()
        .getAttribute('href').catch(() => null);
      const emailHref = await page.locator('a[href^="mailto:"]').first()
        .getAttribute('href').catch(() => null);

      return {
        username,
        bio: bio?.trim() || undefined,
        website,
        phone: phoneHref?.replace('tel:', '').trim() || undefined,
        email: emailHref?.replace('mailto:', '').toLowerCase().trim() || undefined,
      };
    } catch (error) {
      Logger.error(`[IG Enricher] Playwright falló para @${username}: ${error}`);
      return null;
    } finally {
      await browser.close().catch(() => {});
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async enrichProfile(username: string): Promise<InstagramProfileData | null> {
    if (!username) return null;
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    if (clean.length < 3 || clean.length > 30) return null;

    Logger.info(`[IG Enricher] Enriqueciendo @${clean}...`);

    // API is fast (no browser spin-up) — try it first
    const apiResult = await this.tryApiEndpoint(clean);
    if (apiResult) {
      Logger.success(`[IG Enricher] ✅ @${clean} → via API`);
      return apiResult;
    }

    // Small pause before launching a browser
    await new Promise(r => setTimeout(r, 1500));

    const pwResult = await this.tryPlaywright(clean);
    if (pwResult) {
      Logger.success(`[IG Enricher] ✅ @${clean} → via Playwright`);
    } else {
      Logger.warn(`[IG Enricher] No se pudo enriquecer @${clean}`);
    }
    return pwResult;
  }
}
