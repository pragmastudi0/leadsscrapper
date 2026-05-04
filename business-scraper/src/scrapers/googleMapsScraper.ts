import { chromium, Browser, Page } from 'playwright';
import { Lead, GoogleMapsSearchOptions } from '../types/lead';
import { DataCleaner } from '../services/dataCleaner';
import { Validator } from '../services/validator';
import { USER_AGENTS, DELAYS } from '../config/constants';
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
      extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9' },
    });
    const page = await context.newPage();
    // Block heavy assets — speeds up each page load significantly
    await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,svg}', r => r.abort());
    return page;
  }

  // ── Step 1: collect all place URLs from the search results list ─────────────
  private async collectPlaceUrls(page: Page, limite: number): Promise<string[]> {
    const seen = new Set<string>();
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(limite / 8) + 2;

    while (seen.size < limite && scrollAttempts < maxScrolls) {
      const links = await page.locator('a[href*="/maps/place/"]').all();

      for (const link of links) {
        const href = await link.getAttribute('href').catch(() => null);
        if (!href) continue;
        // Normalise: strip query params after the place path
        const clean = href.split('?')[0].replace(/^.*\/maps\/place\//, '/maps/place/');
        const full  = href.startsWith('http') ? href : `https://www.google.com${href}`;
        if (!seen.has(clean)) seen.add(full);
        if (seen.size >= limite) break;
      }

      if (seen.size >= limite) break;

      // Scroll the feed down to load more results
      const feed = page.locator('[role="feed"]').first();
      const scrolled = await feed.evaluate(el => {
        const h = el as HTMLElement;
        if (h.scrollTop + h.clientHeight >= h.scrollHeight - 10) return false;
        h.scrollTop += 600;
        return true;
      }).catch(() => false);

      if (!scrolled) break;
      await this.randomDelay(800, 1400);
      scrollAttempts++;
    }

    return Array.from(seen);
  }

  // ── Step 2: visit each place URL directly and extract data ──────────────────
  private async extractFromUrl(page: Page, url: string, ciudad: string): Promise<Lead | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});

      const nombre = await page.locator('h1').first().textContent().catch(() => null);
      if (!nombre?.trim()) return null;

      // Phone — tel: link is the most reliable
      const telHref = await page.locator('a[href^="tel:"]').first()
        .getAttribute('href').catch(() => null);
      const telefono = telHref ? DataCleaner.cleanPhone(telHref.replace('tel:', '')) : null;

      // Website — first external link that's not google.com
      const allLinks = await page.locator('a[href^="http"]').all();
      let sitioWeb: string | null = null;
      for (const link of allLinks) {
        const href = await link.getAttribute('href').catch(() => null) ?? '';
        if (href && !href.includes('google.') && !href.includes('goo.gl')) {
          sitioWeb = DataCleaner.cleanUrl(href);
          break;
        }
      }

      // Address — button with copy-address data attribute
      const addressText = await page
        .locator('[data-item-id="address"], button[data-tooltip*="direcci"], button[aria-label*="irecci"]')
        .first().textContent().catch(() => null) ?? '';
      const direccion = addressText.trim() ? DataCleaner.cleanAddress(addressText) : null;

      const lead: Lead = {
        nombre:      DataCleaner.extractFirstName(nombre.trim()),
        apellido:    DataCleaner.extractLastName(nombre.trim()),
        nombreLocal: DataCleaner.cleanBusinessName(nombre.trim()),
        ciudad,
        direccion:   direccion   ?? undefined,
        telefono:    telefono    ?? undefined,
        fuente:      'google_maps',
        urlFuente:   page.url(),
        fechaExtraccion: new Date(),
      };

      return lead;
    } catch (error) {
      Logger.error(`[Google Maps] Error extrayendo ${url}: ${error}`);
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
      const url = `https://www.google.com/maps/search/${encodeURIComponent(`${options.keyword} ${options.ciudad}`)}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[role="feed"], a[href*="/maps/place/"]', { timeout: 15000 })
        .catch(() => Logger.warn('[Google Maps] Feed tardó en cargar'));
      await this.randomDelay(1000, 1800);

      // Collect URLs first — no navigation yet
      const placeUrls = await this.collectPlaceUrls(page, limite);
      Logger.info(`[Google Maps] ${placeUrls.length} lugares encontrados — extrayendo datos...`);

      // Visit each place directly (no goBack — navigate straight to next URL)
      for (const placeUrl of placeUrls) {
        if (leads.length >= limite) break;
        const lead = await this.extractFromUrl(page, placeUrl, options.ciudad);
        if (lead && Validator.isLeadComplete(lead)) {
          leads.push(lead);
          Logger.success(`[Google Maps] Extraído: ${lead.nombreLocal}`);
        }
        await this.randomDelay(400, 800); // short delay between places
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
