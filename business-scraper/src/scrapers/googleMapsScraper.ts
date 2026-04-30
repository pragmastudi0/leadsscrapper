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

  private getRandomDelay(): number {
    return Math.floor(Math.random() * (DELAYS.MAX_MS - DELAYS.MIN_MS) + DELAYS.MIN_MS);
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
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9' },
    });
    return context.newPage();
  }

  async searchBusinesses(options: GoogleMapsSearchOptions): Promise<Lead[]> {
    const leads: Lead[] = [];
    let page: Page | null = null;

    try {
      Logger.info(`[Google Maps] Buscando: "${options.keyword}" en ${options.ciudad}`);

      page = await this.createPage();
      const searchQuery = `${options.keyword} ${options.ciudad}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(this.getRandomDelay());

      // Scroll to load more results
      let previousHeight = 0;
      let scrollCount = 0;
      const maxScrolls = options.limite ? Math.ceil(options.limite / 20) : 5;

      while (scrollCount < maxScrolls) {
        const feed = page.locator('[role="feed"]').first();
        const currentHeight = await feed.evaluate(el => (el as HTMLElement).scrollHeight).catch(() => 0);
        if (currentHeight === previousHeight) break;
        await feed.evaluate(el => { (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight; }).catch(() => {});
        previousHeight = currentHeight;
        scrollCount++;
        await page.waitForTimeout(this.getRandomDelay());
      }

      // Extract business cards
      const businessCards = await page.locator('[data-item-id]').all();
      Logger.info(`[Google Maps] Encontradas ${businessCards.length} tarjetas de negocio`);

      for (let i = 0; i < businessCards.length; i++) {
        if (options.limite && leads.length >= options.limite) break;
        try {
          await businessCards[i].click();
          await page.waitForTimeout(500);
          const lead = await this.extractBusinessInfo(page, options.ciudad);
          if (lead && Validator.isLeadComplete(lead)) {
            leads.push(lead);
            Logger.success(`[Google Maps] Extraído: ${lead.nombreLocal}`);
          }
        } catch (error) {
          Logger.error(`[Google Maps] Error extrayendo tarjeta ${i}: ${error}`);
        }
      }

      Logger.info(`[Google Maps] Completado: ${leads.length} leads extraídos`);
    } catch (error) {
      Logger.error(`[Google Maps] Error en búsqueda: ${error}`);
    } finally {
      if (page) await page.close().catch(() => {});
    }

    return leads;
  }

  private async extractBusinessInfo(page: Page, ciudad: string): Promise<Lead | null> {
    try {
      const nombre = await page.locator('h1').first().textContent().catch(() => null);
      if (!nombre) return null;

      // Extract phone
      let telefono: string | null = null;
      const phoneEl = page.locator('button[aria-label*="Llamar"], a[href^="tel:"]').first();
      const phoneAttr = await phoneEl.getAttribute('aria-label').catch(() => null)
        ?? await phoneEl.getAttribute('href').catch(() => null) ?? '';
      if (phoneAttr) telefono = DataCleaner.cleanPhone(phoneAttr);

      // Extract website
      let sitioWeb: string | null = null;
      const websiteEl = page.locator('a[data-tooltip*="Sitio web"], a[href^="http"]').first();
      const websiteHref = await websiteEl.getAttribute('href').catch(() => null) ?? '';
      if (websiteHref) sitioWeb = DataCleaner.cleanUrl(websiteHref);

      // Extract address
      let direccion: string | null = null;
      const addressEl = page.locator('button[data-tooltip*="Copiar dirección"], button[aria-label*="direccion"]').first();
      const addressText = await addressEl.textContent().catch(() => null) ?? '';
      if (addressText) direccion = DataCleaner.cleanAddress(addressText);

      const lead: Lead = {
        nombre: DataCleaner.extractFirstName(nombre),
        apellido: DataCleaner.extractLastName(nombre),
        nombreLocal: DataCleaner.cleanBusinessName(nombre),
        ciudad,
        direccion: direccion ?? undefined,
        telefono: telefono ?? undefined,
        fuente: 'google_maps',
        urlFuente: page.url(),
        fechaExtraccion: new Date(),
      };

      return lead;
    } catch (error) {
      Logger.error(`[Google Maps] Error extrayendo info: ${error}`);
      return null;
    }
  }
}
