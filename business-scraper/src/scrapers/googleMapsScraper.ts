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
      await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});

      const nombre = await page.locator('h1').first().textContent().catch(() => null);
      if (!nombre?.trim()) {
        Logger.warn(`[Google Maps] [${index}/${total}] Sin nombre — saltando`);
        return null;
      }

      Logger.info(`[Google Maps] [${index}/${total}] 🏪 ${nombre.trim()}`);

      // ── Phone ──────────────────────────────────────────────────────────────
      const telHref = await page.locator('a[href^="tel:"]').first()
        .getAttribute('href').catch(() => null);
      const telefono = telHref ? DataCleaner.cleanPhone(telHref.replace('tel:', '')) : null;

      // ── Rating & Reviews ───────────────────────────────────────────────────
      // aria-label contains the rating info in multiple locales
      const ratingAriaLabel = await page
        .locator('[aria-label*="stars"], [aria-label*="estrellas"], [aria-label*="Estrellas"]')
        .first().getAttribute('aria-label').catch(() => null);
      const rating = ratingAriaLabel ? (ratingAriaLabel.match(/(\d+[.,]\d+|\d+)/)?.[1] ?? null) : null;

      // Reviews count — button that shows the number of reviews
      const reviewsAriaLabel = await page
        .locator('[aria-label*="reviews"], [aria-label*="reseñas"], [aria-label*="Reseñas"], [aria-label*="opiniones"]')
        .first().getAttribute('aria-label').catch(() => null);
      const reviews = reviewsAriaLabel ? (reviewsAriaLabel.match(/([\d,\.]+)/)?.[1]?.replace(/\D/g, '') ?? null) : null;

      // ── Category ───────────────────────────────────────────────────────────
      // Category appears as a button/link right below the business name
      // Try multiple selectors — Google Maps HTML changes frequently
      const categoryText =
        await page.locator('button[jsaction*="pane.category"]').first().textContent().catch(() => null) ??
        await page.locator('[aria-label*="Category"], [aria-label*="Categoría"]').first().textContent().catch(() => null) ??
        // Fallback: second line of the header area (name is first, category is second)
        await page.locator('div[role="main"] span.fontBodyMedium').first().textContent().catch(() => null);
      const categoria = categoryText?.trim() || null;

      // ── External links (website + Instagram) ───────────────────────────────
      const allLinks = await page.locator('a[href^="http"]').all();
      let sitioWeb: string | null = null;
      let instagram: string | null = null;
      let facebookUrl: string | null = null;

      for (const link of allLinks) {
        const href = (await link.getAttribute('href').catch(() => null)) ?? '';
        if (!href || href.includes('google.') || href.includes('goo.gl')) continue;

        if (!instagram && href.includes('instagram.com')) {
          const handle = this.extractInstagramHandle(href);
          if (handle) instagram = handle;
          continue;
        }

        if (!facebookUrl && (href.includes('facebook.com') || href.includes('fb.com'))) {
          facebookUrl = href.split('?')[0]; // strip tracking params
          continue;
        }

        // First non-Google/non-social link is the website
        if (!sitioWeb &&
            !href.includes('instagram.com') &&
            !href.includes('facebook.com') &&
            !href.includes('twitter.com') &&
            !href.includes('tiktok.com') &&
            !href.includes('youtube.com') &&
            !href.includes('yelp.com')) {
          sitioWeb = DataCleaner.cleanUrl(href);
        }

        if (instagram && sitioWeb) break;
      }

      // ── Address ────────────────────────────────────────────────────────────
      // Try data-item-id first, then aria-label patterns
      const addressText =
        await page.locator('[data-item-id="address"]').first().textContent().catch(() => null) ??
        await page.locator('button[aria-label*="recc"], button[aria-label*="direc"], button[data-tooltip*="direc"]')
          .first().textContent().catch(() => null) ??
        await page.locator('button[data-item-id]').filter({ hasText: /\d/ })
          .first().textContent().catch(() => null);
      const direccion = addressText?.trim() ? DataCleaner.cleanAddress(addressText) : null;

      // ── Log what was found ─────────────────────────────────────────────────
      const found: string[] = [];
      if (telefono)  found.push(`📞 ${telefono}`);
      if (rating)    found.push(`⭐ ${rating}`);
      if (reviews)   found.push(`💬 ${reviews} reseñas`);
      if (categoria) found.push(`🏷 ${categoria.slice(0, 30)}`);
      if (sitioWeb)  found.push(`🌐 ${sitioWeb.slice(0, 40)}`);
      if (instagram) found.push(`📸 @${instagram}`);
      if (facebookUrl) found.push(`👤 FB`);
      Logger.debug(`[Google Maps]      ${found.length ? found.join('  |  ') : '(sin datos adicionales)'}`);

      const lead: Lead = {
        nombre:      DataCleaner.extractFirstName(nombre.trim()),
        apellido:    DataCleaner.extractLastName(nombre.trim()),
        nombreLocal: DataCleaner.cleanBusinessName(nombre.trim()),
        keyword,
        categoria:   categoria ?? undefined,
        ciudad,
        direccion:   direccion  ?? undefined,
        telefono:    telefono   ?? undefined,
        sitioWeb:    sitioWeb   ?? undefined,
        googleMapsUrl: page.url(),
        rating:      rating     ?? undefined,
        reviews:     reviews    ?? undefined,
        instagram:   instagram  ?? undefined,
        instagramUrl: instagram ? `https://www.instagram.com/${instagram}/` : undefined,
        facebookUrl: facebookUrl ?? undefined,
        fuente:      'google_maps',
        urlFuente:   page.url(),
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
        if (lead && Validator.isLeadComplete(lead)) {
          leads.push(lead);
          Logger.success(`[Google Maps] ✅ Lead guardado: ${lead.nombreLocal} (${leads.length}/${limite})`);
        } else if (lead) {
          Logger.warn(`[Google Maps]    Incompleto, descartado: ${lead.nombreLocal}`);
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
