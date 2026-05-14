import { chromium, Browser, Page } from 'playwright';
import { Lead, GoogleMapsSearchOptions } from '../types/lead';
import { DataCleaner } from '../services/dataCleaner';
import { Validator } from '../services/validator';
import { USER_AGENTS, DELAYS, INSTAGRAM_EXCLUDED_HANDLES } from '../config/constants';
import { Logger } from '../utils/logger';

export class GoogleMapsScraper {
  private browser: Browser | null = null;

  private getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  private randomDelay(min = DELAYS.MIN_MS, max = DELAYS.MAX_MS): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min) + min);
    return new Promise(r => setTimeout(r, ms));
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async createPage(): Promise<Page> {
    await this.initBrowser();
    const context = await this.browser!.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8' },
    });
    const page = await context.newPage();
    await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,svg}', r => r.abort());
    return page;
  }

  // ── Step 1: collect all place URLs from the search results feed ──────────────
  private async collectPlaceUrls(page: Page, limite: number): Promise<string[]> {
    const seen = new Set<string>();
    const seenClean = new Set<string>();
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(limite / 8) + 5;

    Logger.info(`[Google Maps] 🔍 Recolectando URLs del feed (máx ${limite})...`);

    while (seen.size < limite && scrollAttempts < maxScrolls) {
      const links = await page.locator('a[href*="/maps/place/"]').all();

      for (const link of links) {
        const href = await link.getAttribute('href').catch(() => null);
        if (!href) continue;
        const clean = href.split('?')[0].replace(/^.*\/maps\/place\//, '/maps/place/');
        const full  = href.startsWith('http') ? href : `https://www.google.com${href}`;
        if (!seenClean.has(clean)) {
          seenClean.add(clean);
          seen.add(full);
          const namePart = decodeURIComponent(clean.split('/maps/place/')[1] ?? '').replace(/\+/g, ' ');
          Logger.debug(`[Google Maps]   + URL #${seen.size}: ${namePart.slice(0, 60)}`);
        }
        if (seen.size >= limite) break;
      }

      if (seen.size >= limite) break;

      Logger.info(`[Google Maps] 📜 Scroll #${scrollAttempts + 1} — ${seen.size}/${limite} URLs encontradas`);

      const feed = page.locator('[role="feed"]').first();
      const scrolled = await feed.evaluate(el => {
        const h = el as HTMLElement;
        if (h.scrollTop + h.clientHeight >= h.scrollHeight - 10) return false;
        h.scrollTop += 600;
        return true;
      }).catch(() => false);

      if (!scrolled) {
        Logger.warn('[Google Maps] Feed llegó al final');
        break;
      }
      await this.randomDelay(800, 1400);
      scrollAttempts++;
    }

    Logger.info(`[Google Maps] ✅ Recolección terminada: ${seen.size} URLs únicas`);
    return Array.from(seen);
  }

  // Extract a clean Instagram handle from any instagram.com URL fragment
  private extractInstagramHandle(href: string): string | null {
    // Match handle after instagram.com/  — stop at /, ?, #
    const match = href.match(/instagram\.com\/([a-zA-Z0-9._]{1,30})\/?(?:[?#].*)?$/);
    if (!match) return null;
    const handle = match[1].toLowerCase();
    // Exclude system paths and single-char fragments
    if (INSTAGRAM_EXCLUDED_HANDLES.has(handle) || handle.length < 3) return null;
    return handle;
  }

  // ── Step 2: visit each place URL and extract all data ───────────────────────
  private async extractFromUrl(
    page: Page,
    url: string,
    ciudad: string,
    keyword: string,
    index: number,
    total: number,
  ): Promise<Lead | null> {
    try {
      Logger.info(`[Google Maps] [${index}/${total}] Abriendo lugar...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Wait for the h1 (name) — the panel renders in two phases, name comes first
      await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});

      // Give the JS panel a moment to inject phone, links and category.
      // Sequential locator.getAttribute() calls take ~90s; a single evaluate() is ~2s.
      await page.waitForTimeout(1500);

      // ── Extract everything in one JS round-trip ────────────────────────────
      // Single evaluate() instead of N sequential Playwright calls — huge speedup.
      const raw = await page.evaluate(() => {
        // Helpers
        const text  = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.textContent?.trim() ?? null;
        const attr  = (sel: string, a: string) => (document.querySelector(sel) as HTMLElement | null)?.getAttribute(a) ?? null;

        // Name
        const nombre = text('h1');

        // Phone — tel: link is the most reliable signal
        const telLink = document.querySelector('a[href^="tel:"]') as HTMLAnchorElement | null;
        const telefono = telLink?.href?.replace('tel:', '') ?? null;

        // Rating — aria-label "X estrellas" / "X stars"
        const ratingEl = document.querySelector(
          '[aria-label*="stars"],[aria-label*="estrellas"],[aria-label*="Estrellas"],[aria-label*="Stars"]'
        );
        const ratingLabel = ratingEl?.getAttribute('aria-label') ?? null;

        // Reviews count — aria-label "X reseñas" / "X reviews"
        const reviewsEl = document.querySelector(
          '[aria-label*="reseñas"],[aria-label*="Reseñas"],[aria-label*="reviews"],[aria-label*="Reviews"],[aria-label*="opiniones"]'
        );
        const reviewsLabel = reviewsEl?.getAttribute('aria-label') ?? null;

        // Category — page title format is always "Name · Category · Google Maps"
        // Much more reliable than hunting for buttons whose text/position changes
        const titleParts = document.title.split('·').map(s => s.trim());
        const categoria = titleParts.length >= 2 ? titleParts[1] ?? null : null;

        // Address — data-item-id="address" is the canonical selector
        const addressEl = document.querySelector('[data-item-id="address"]') as HTMLElement | null;
        const direccion = addressEl?.textContent?.trim() ?? null;

        // All external links in one pass
        const links: string[] = Array.from(document.querySelectorAll('a[href^="http"]'))
          .map(el => (el as HTMLAnchorElement).href)
          .filter(h => h && !h.includes('google.') && !h.includes('goo.gl'));

        return { nombre, telefono, ratingLabel, reviewsLabel, categoria, direccion, links };
      });

      if (!raw.nombre?.trim()) {
        Logger.warn(`[Google Maps] [${index}/${total}] Sin nombre — saltando`);
        return null;
      }

      Logger.info(`[Google Maps] [${index}/${total}] 🏪 ${raw.nombre.trim()}`);

      // ── Parse extracted values ─────────────────────────────────────────────
      const telefono = raw.telefono ? DataCleaner.cleanPhone(raw.telefono) : null;

      const rating  = raw.ratingLabel  ? (raw.ratingLabel.match(/(\d+[.,]\d+|\d+)/)?.[1]  ?? null) : null;
      const reviews = raw.reviewsLabel ? (raw.reviewsLabel.match(/(\d[\d.,]*)/)?.[1]?.replace(/\./g, '').replace(',', '') ?? null) : null;

      const categoria = raw.categoria ?? null;
      const direccion = raw.direccion ? DataCleaner.cleanAddress(raw.direccion) : null;

      // ── Classify external links ────────────────────────────────────────────
      let sitioWeb:    string | null = null;
      let instagram:   string | null = null;
      let facebookUrl: string | null = null;

      for (const href of raw.links) {
        if (!instagram && href.includes('instagram.com')) {
          instagram = this.extractInstagramHandle(href);
          continue;
        }
        if (!facebookUrl && (href.includes('facebook.com') || href.includes('fb.com'))) {
          facebookUrl = href.split('?')[0];
          continue;
        }
        if (!sitioWeb &&
            !href.includes('instagram.com') && !href.includes('facebook.com') &&
            !href.includes('twitter.com')   && !href.includes('tiktok.com') &&
            !href.includes('youtube.com')   && !href.includes('yelp.com') &&
            !href.includes('whatsapp.com')  && !href.includes('wa.me')) {
          sitioWeb = DataCleaner.cleanUrl(href);
        }
        if (instagram && sitioWeb) break;
      }

      // ── Log what was found ─────────────────────────────────────────────────
      const found: string[] = [];
      if (telefono)    found.push(`📞 ${telefono}`);
      if (rating)      found.push(`⭐ ${rating}`);
      if (reviews)     found.push(`💬 ${reviews} reseñas`);
      if (categoria)   found.push(`🏷 ${categoria.slice(0, 30)}`);
      if (sitioWeb)    found.push(`🌐 ${sitioWeb.slice(0, 40)}`);
      if (instagram)   found.push(`📸 @${instagram}`);
      if (facebookUrl) found.push(`👤 FB`);
      Logger.debug(`[Google Maps]      ${found.length ? found.join('  |  ') : '(sin datos adicionales)'}`);

      const lead: Lead = {
        nombre:       DataCleaner.extractFirstName(raw.nombre.trim()),
        apellido:     DataCleaner.extractLastName(raw.nombre.trim()),
        nombreLocal:  DataCleaner.cleanBusinessName(raw.nombre.trim()),
        keyword,
        categoria:    categoria    ?? undefined,
        ciudad,
        direccion:    direccion    ?? undefined,
        telefono:     telefono     ?? undefined,
        sitioWeb:     sitioWeb     ?? undefined,
        googleMapsUrl: page.url(),
        rating:       rating       ?? undefined,
        reviews:      reviews      ?? undefined,
        instagram:    instagram    ?? undefined,
        instagramUrl: instagram ? `https://www.instagram.com/${instagram}/` : undefined,
        facebookUrl:  facebookUrl  ?? undefined,
        fuente:       'google_maps',
        urlFuente:    page.url(),
        fechaExtraccion: new Date(),
      };

      return lead;
    } catch (error) {
      Logger.error(`[Google Maps] [${index}/${total}] Error: ${error}`);
      return null;
    }
  }

  // ── Main entry point ────────────────────────────────────────────────────────
  async searchBusinesses(options: GoogleMapsSearchOptions): Promise<Lead[]> {
    const leads: Lead[] = [];
    const limite = options.limite ?? 10;
    let page: Page | null = null;

    try {
      Logger.info(`[Google Maps] Buscando: "${options.keyword}" en ${options.ciudad} (límite: ${limite})`);

      page = await this.createPage();
      const query = `${options.keyword} ${options.ciudad}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[role="feed"], a[href*="/maps/place/"]', { timeout: 15000 })
        .catch(() => Logger.warn('[Google Maps] Feed tardó en cargar'));
      await this.randomDelay(1000, 1800);

      const placeUrls = await this.collectPlaceUrls(page, limite);
      Logger.info(`[Google Maps] ${placeUrls.length} lugares encontrados — extrayendo datos...`);

      for (let i = 0; i < placeUrls.length; i++) {
        if (leads.length >= limite) break;
        const lead = await this.extractFromUrl(
          page, placeUrls[i], options.ciudad, options.keyword, i + 1, placeUrls.length,
        );
        // Keep every lead that has a valid name — no web/phone/email is itself
        // a sales signal (opportunity to offer those services).
        if (lead) {
          leads.push(lead);
          const tags = [
            lead.sitioWeb    ? '🌐' : '🚫web',
            lead.telefono    ? '📞' : '',
            lead.instagram   ? '📸' : '',
          ].filter(Boolean).join(' ');
          Logger.success(`[Google Maps] ✅ ${lead.nombreLocal} ${tags} (${leads.length}/${limite})`);
        }
        await this.randomDelay(400, 800);
      }

      Logger.info(`[Google Maps] Completado: ${leads.length} leads extraídos`);
    } catch (error) {
      Logger.error(`[Google Maps] Error en búsqueda: ${error}`);
    } finally {
      if (page) await page.close().catch(() => {});
    }

    return leads;
  }
}
