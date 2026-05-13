import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { USER_AGENTS, INSTAGRAM_EXCLUDED_HANDLES, LINK_AGGREGATORS } from '../config/constants';
import { Logger } from '../utils/logger';

export interface SocialLinks {
  instagramUrl?: string;
  instagramUsername?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  email?: string;
  telefono?: string;
}

export class WebsiteScraper {
  private randomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  private isLinkAggregator(url: string): boolean {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return LINK_AGGREGATORS.some(agg => host === agg || host.endsWith(`.${agg}`));
    } catch {
      return false;
    }
  }

  // ── Social URL parsers ─────────────────────────────────────────────────────

  private parseInstagram(href: string): { username: string; url: string } | null {
    const match = href.match(/instagram\.com\/([a-zA-Z0-9._]{1,30})\/?(?:[?#].*)?$/);
    if (!match) return null;
    const handle = match[1].toLowerCase();
    if (INSTAGRAM_EXCLUDED_HANDLES.has(handle) || handle.length < 3) return null;
    return { username: handle, url: `https://www.instagram.com/${handle}/` };
  }

  private parseFacebook(href: string): string | null {
    // Match facebook.com/pagename but exclude share/video/photo/group/login paths
    const match = href.match(/(?:facebook|fb)\.com\/(?:pages\/[^/?#]+\/)?([a-zA-Z0-9.\-_]+)\/?(?:[?#].*)?$/);
    if (!match) return null;
    const excluded = new Set(['sharer', 'share', 'login', 'photo', 'video', 'story', 'events', 'groups', 'watch', 'home']);
    if (excluded.has(match[1].toLowerCase())) return null;
    return `https://www.facebook.com/${match[1]}`;
  }

  private parseTikTok(href: string): string | null {
    const match = href.match(/tiktok\.com\/@([a-zA-Z0-9._]{1,30})\/?(?:[?#].*)?$/);
    return match ? `https://www.tiktok.com/@${match[1]}` : null;
  }

  // ── Core HTML extraction ───────────────────────────────────────────────────
  // Applies 5 strategies in order: <a> hrefs, JSON-LD sameAs, raw HTML scan,
  // aria-label/title, then contact-page crawl.

  private async extractFromHtml(pageUrl: string, html: string): Promise<SocialLinks> {
    const $ = cheerio.load(html);
    const result: SocialLinks = {};
    let linktreeCandidate: string | undefined;

    // ── Strategy 1: <a href> anchor links ─────────────────────────────────
    $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') ?? '').trim();
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      // Normalize relative URLs
      let absHref = href;
      if (!href.startsWith('http')) {
        try { absHref = new URL(href, pageUrl).href; } catch { return; }
      }

      if (!result.instagramUrl && absHref.includes('instagram.com')) {
        const ig = this.parseInstagram(absHref);
        if (ig) { result.instagramUrl = ig.url; result.instagramUsername = ig.username; }
        return;
      }
      if (!result.facebookUrl && (absHref.includes('facebook.com') || absHref.includes('fb.com'))) {
        const fb = this.parseFacebook(absHref);
        if (fb) result.facebookUrl = fb;
        return;
      }
      if (!result.tiktokUrl && absHref.includes('tiktok.com')) {
        const tt = this.parseTikTok(absHref);
        if (tt) result.tiktokUrl = tt;
        return;
      }
      if (!linktreeCandidate && this.isLinkAggregator(absHref)) {
        linktreeCandidate = absHref;
      }
    });

    // ── Strategy 2: JSON-LD schema.org sameAs ─────────────────────────────
    if (!result.instagramUrl) {
      $('script[type="application/ld+json"]').each((_, el) => {
        if (result.instagramUrl) return; // already found
        try {
          const data = JSON.parse($(el).html() ?? '{}') as Record<string, unknown>;
          const sameAsRaw = data.sameAs ?? (data['@graph'] as Record<string, unknown>[])?.[0]?.sameAs;
          const sameAs: string[] = Array.isArray(sameAsRaw) ? sameAsRaw : (sameAsRaw ? [String(sameAsRaw)] : []);
          for (const saUrl of sameAs) {
            if (!result.instagramUrl && saUrl.includes('instagram.com')) {
              const ig = this.parseInstagram(saUrl);
              if (ig) { result.instagramUrl = ig.url; result.instagramUsername = ig.username; }
            }
            if (!result.facebookUrl && saUrl.includes('facebook.com')) {
              const fb = this.parseFacebook(saUrl);
              if (fb) result.facebookUrl = fb;
            }
            if (!result.tiktokUrl && saUrl.includes('tiktok.com')) {
              const tt = this.parseTikTok(saUrl);
              if (tt) result.tiktokUrl = tt;
            }
          }
        } catch { /* malformed JSON */ }
      });
    }

    // ── Strategy 3: raw HTML scan (catches JS vars, data-attrs, obfuscated links)
    if (!result.instagramUrl) {
      // Use matchAll to find all instagram.com references in raw HTML
      const igMatches = html.matchAll(/["'(=](?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{3,30})\/?["')&\s]/g);
      for (const m of igMatches) {
        const handle = m[1].toLowerCase();
        if (!INSTAGRAM_EXCLUDED_HANDLES.has(handle)) {
          result.instagramUrl = `https://www.instagram.com/${handle}/`;
          result.instagramUsername = handle;
          break;
        }
      }
    }

    // ── Strategy 4: aria-label / title attributes ─────────────────────────
    if (!result.instagramUrl) {
      $('[aria-label*="instagram" i], [title*="instagram" i], [alt*="instagram" i]').each((_, el) => {
        const href = $(el).attr('href') ?? $(el).closest('a').attr('href') ?? '';
        if (href.includes('instagram.com')) {
          const ig = this.parseInstagram(href);
          if (ig) { result.instagramUrl = ig.url; result.instagramUsername = ig.username; }
        }
      });
    }

    // ── Strategy 5: email & phone from body text ───────────────────────────
    const bodyText = $('body').text();
    if (!result.email) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = bodyText.match(emailRegex) ?? [];
      const real = matches.find(e =>
        !e.includes('example') && !e.includes('test@') && !e.includes('noreply')
        && !e.endsWith('@google.com') && !e.endsWith('@sentry.io')
      );
      if (real) result.email = real.toLowerCase();
    }
    if (!result.telefono) {
      const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4,4}/g;
      const phones = bodyText.match(phoneRegex) ?? [];
      if (phones.length && phones[0]) result.telefono = phones[0].trim();
    }

    // ── Follow link aggregator if found ───────────────────────────────────
    if (linktreeCandidate && !result.instagramUrl) {
      Logger.info(`[Website] 🔗 Link aggregator detectado: ${linktreeCandidate}`);
      const ltLinks = await this.extractFromLinkAggregator(linktreeCandidate);
      if (ltLinks.instagramUrl)  result.instagramUrl  = ltLinks.instagramUrl;
      if (ltLinks.instagramUsername) result.instagramUsername = ltLinks.instagramUsername;
      if (ltLinks.facebookUrl)   result.facebookUrl   = ltLinks.facebookUrl;
      if (ltLinks.tiktokUrl)     result.tiktokUrl     = ltLinks.tiktokUrl;
    }

    return result;
  }

  // ── Render link aggregators with Playwright (they're fully JS-rendered) ──
  private async extractFromLinkAggregator(url: string): Promise<SocialLinks> {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,svg,mp4}', r => r.abort());
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Linktree injects links via React — wait briefly for hydration
      await page.waitForTimeout(2500);
      const html = await page.content();
      // Re-run extraction on rendered HTML (no aggregator recursion)
      return this.extractFromHtmlNoAggregator(html);
    } catch (error) {
      Logger.warn(`[Website] Link aggregator falló: ${error}`);
      return {};
    } finally {
      await browser.close().catch(() => {});
    }
  }

  // Extraction without link-aggregator follow (avoids infinite recursion)
  private async extractFromHtmlNoAggregator(html: string): Promise<SocialLinks> {
    const $ = cheerio.load(html);
    const result: SocialLinks = {};

    $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') ?? '').trim();
      if (!result.instagramUrl && href.includes('instagram.com')) {
        const ig = this.parseInstagram(href);
        if (ig) { result.instagramUrl = ig.url; result.instagramUsername = ig.username; }
      }
      if (!result.facebookUrl && href.includes('facebook.com')) {
        const fb = this.parseFacebook(href);
        if (fb) result.facebookUrl = fb;
      }
      if (!result.tiktokUrl && href.includes('tiktok.com')) {
        const tt = this.parseTikTok(href);
        if (tt) result.tiktokUrl = tt;
      }
    });

    // Raw scan as fallback inside aggregators (they embed URLs in data attrs)
    if (!result.instagramUrl) {
      const igMatches = html.matchAll(/["'(=](?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{3,30})\/?["')&\s]/g);
      for (const m of igMatches) {
        const handle = m[1].toLowerCase();
        if (!INSTAGRAM_EXCLUDED_HANDLES.has(handle)) {
          result.instagramUrl = `https://www.instagram.com/${handle}/`;
          result.instagramUsername = handle;
          break;
        }
      }
    }

    return result;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async extractSocialLinks(url: string): Promise<SocialLinks> {
    // If the URL itself is a link aggregator, render it directly
    if (this.isLinkAggregator(url)) {
      Logger.info(`[Website] URL es link aggregator, usando Playwright: ${url}`);
      return this.extractFromLinkAggregator(url);
    }

    // First attempt: fast axios fetch (no JS overhead, handles 80% of sites)
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.randomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 12000,
        maxRedirects: 8,
        // Follow all redirects, including HTTP → HTTPS
        validateStatus: (status) => status < 400,
      });

      const links = await this.extractFromHtml(url, response.data as string);
      Logger.info(
        `[Website] ${url.slice(0, 50)} → IG=${links.instagramUsername ?? '-'} FB=${links.facebookUrl ? '✓' : '-'}`,
      );
      return links;
    } catch (axiosErr) {
      const msg = axiosErr instanceof Error ? axiosErr.message : String(axiosErr);
      Logger.warn(`[Website] axios falló (${msg.slice(0, 60)}) — intentando Playwright...`);
    }

    // Second attempt: Playwright for JS-heavy / bot-detecting sites
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: this.randomUserAgent() });
      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,svg}', r => r.abort());
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      const html = await page.content();
      const links = await this.extractFromHtml(url, html);
      Logger.info(`[Website] (Playwright) ${url.slice(0, 50)} → IG=${links.instagramUsername ?? '-'}`);
      return links;
    } catch (pwErr) {
      Logger.error(`[Website] Playwright también falló para ${url}: ${pwErr}`);
      return {};
    } finally {
      await browser.close().catch(() => {});
    }
  }
}
