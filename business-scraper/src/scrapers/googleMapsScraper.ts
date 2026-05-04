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
      // Disable images/fonts to speed up loading
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf}', r => r.abort());
    return page;
  }

  async searchBusinesses(options: GoogleMapsSearchOptions): Promise<Lead[]> {
    const leads: Lead[] = [];
    let page: Page | null = null;

    try {
      Logger.info(`[Google Maps] Buscando: "${options.keyword}" en ${options.ciudad}`);

      page = await this.createPage();
      const searchQuery = `${options.keyword} ${options.ciudad}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

      // 'networkidle' never fires on Maps — use 'domcontentloaded' + wait for results
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for the results feed to appear (up to 15s)
      await page.waitForSelector('[role="feed"]', { timeout: 15000 }).catch(() => {
        Logger.warn('[Google Maps] Feed no encontrado, continuando igual...');
      });

      await page.waitForTimeout(this.getRandomDelay());

      // Debug: log candidate selectors so we can adapt if Google changes the HTML
      const debugCounts = await page.evaluate(() => ({
        dataItemId:    document.querySelectorAll('[data-item-id]').length,
        feedChildren:  document.querySelectorAll('[role="feed"] > div').length,
        placeLinks:    document.querySelectorAll('a[href*="/maps/place/"]').length,
        hfpxzc:        document.querySelectorAll('.hfpxzc').length,
        Nv2PK:         document.querySelectorAll('.Nv2PK').length,
      }));
      Logger.debug(`[Google Maps] Selectores encontrados: ${JSON.stringify(debugCounts)}`);

      // Pick whichever selector has results — Maps changes classes frequently
      const CARD_SELECTORS = [
        'a[href*="/maps/place/"]',   // most stable — actual place links
        '.Nv2PK',                    // result card wrapper (2024)
        '.hfpxzc',                   // clickable place row
        '[role="feed"] > div > div', // generic feed children
        '[data-item-id]',            // old selector, kept as fallback
      ];

      let cardSelector = CARD_SELECTORS[0];
      for (const sel of CARD_SELECTORS) {
        const count = await page.locator(sel).count();
        if (count > 0) { cardSelector = sel; break; }
      }
      Logger.debug(`[Google Maps] Usando selector: ${cardSelector}`);

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

      const businessCards = await page.locator(cardSelector).all();
      Logger.info(`[Google Maps] Encontradas ${businessCards.length} tarjetas de negocio`);

      // If cards are <a> links, navigate directly to their href (faster & more reliable)
      const firstTag = await businessCards[0]?.evaluate(el => el.tagName.toLowerCase()).catch(() => 'div');
      const useNavigation = firstTag === 'a';

      for (let i = 0; i < businessCards.length; i++) {
        if (options.limite && leads.length >= options.limite) break;
        try {
          if (useNavigation) {
            const href = await businessCards[i].getAttribute('href').catch(() => null);
            if (!href) continue;
            const fullUrl = href.startsWith('http') ? href : `https://www.google.com${href}`;
            await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          } else {
            await businessCards[i].click();
          }
          await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(800);
          const lead = await this.extractBusinessInfo(page, options.ciudad);
          if (lead && Validator.isLeadComplete(lead)) {
            leads.push(lead);
            Logger.success(`[Google Maps] Extraído: ${lead.nombreLocal}`);
          }
          // Go back to results if we navigated away
          if (useNavigation) await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
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
      if (!nombre?.trim()) return null;

      // Phone: href="tel:..." is the most reliable selector
      const telHref = await page.locator('a[href^="tel:"]').first()
        .getAttribute('href').catch(() => null);
      const telefono = telHref
        ? DataCleaner.cleanPhone(telHref.replace('tel:', ''))
        : null;

      // Website: any external link in the detail panel that isn't google
      const allLinks = await page.locator('a[href^="http"]').all();
      let sitioWeb: string | null = null;
      for (const link of allLinks) {
        const href = await link.getAttribute('href').catch(() => null) ?? '';
        if (href && !href.includes('google.com') && !href.includes('goo.gl')) {
          sitioWeb = DataCleaner.cleanUrl(href);
          break;
        }
      }

      // Address: button that contains the copy-address action
      const addressText = await page
        .locator('button[data-item-id="address"], [data-tooltip*="direcci"], button[aria-label*="irecci"]')
        .first().textContent().catch(() => null) ?? '';
      const direccion = addressText ? DataCleaner.cleanAddress(addressText) : null;

      const lead: Lead = {
        nombre: DataCleaner.extractFirstName(nombre.trim()),
        apellido: DataCleaner.extractLastName(nombre.trim()),
        nombreLocal: DataCleaner.cleanBusinessName(nombre.trim()),
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
