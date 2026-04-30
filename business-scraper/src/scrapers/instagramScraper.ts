import { chromium, Browser, Page } from 'playwright';
import { Lead } from '../types/lead';
import { DataCleaner } from '../services/dataCleaner';
import { Validator } from '../services/validator';
import { USER_AGENTS, DELAYS } from '../config/constants';
import { Logger } from '../utils/logger';

export class InstagramScraper {
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

  async scrapeProfile(username: string): Promise<Lead | null> {
    let page: Page | null = null;

    try {
      await this.initBrowser();
      const context = await this.browser!.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1080, height: 1920 },
      });
      page = await context.newPage();

      const url = `https://www.instagram.com/${username}/`;
      Logger.info(`[Instagram] Accediendo a: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(this.getRandomDelay());

      const notFoundCount = await page.locator('span:has-text("Usuario no encontrado")').count();
      if (notFoundCount > 0) {
        Logger.warn(`[Instagram] Perfil no encontrado: ${username}`);
        return null;
      }

      // Extract bio text for city/email hints
      const bioText = await page.locator('header section').textContent().catch(() => '') ?? '';

      // Extract phone if exposed
      const phoneLink = await page.locator('a[href^="tel:"]').first().getAttribute('href').catch(() => null);
      const telefono = phoneLink ? DataCleaner.cleanPhone(phoneLink.replace('tel:', '')) : undefined;

      // Extract email if exposed
      const emailLink = await page.locator('a[href^="mailto:"]').first().getAttribute('href').catch(() => null);
      const email = emailLink ? DataCleaner.cleanEmail(emailLink.replace('mailto:', '')) : undefined;

      const lead: Lead = {
        nombre: username,
        nombreLocal: username,
        ciudad: 'Desconocida',
        instagram: DataCleaner.cleanInstagram(username) ?? username,
        email: email ?? undefined,
        telefono: telefono ?? undefined,
        fuente: 'instagram',
        urlFuente: url,
        fechaExtraccion: new Date(),
      };

      // Try to extract city from bio
      const cityMatch = bioText.match(/(?:📍|ubicación:|location:)\s*([^\n,]+)/i);
      if (cityMatch) lead.ciudad = cityMatch[1].trim();

      return Validator.isLeadComplete(lead) ? lead : null;
    } catch (error) {
      Logger.error(`[Instagram] Error scrapeando ${username}: ${error}`);
      return null;
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  async scrapeProfiles(usernames: string[]): Promise<Lead[]> {
    const leads: Lead[] = [];
    for (const username of usernames) {
      try {
        const lead = await this.scrapeProfile(username);
        if (lead) {
          leads.push(lead);
          Logger.success(`[Instagram] Extraído: @${username}`);
        }
        await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
      } catch (error) {
        Logger.error(`[Instagram] Error con ${username}: ${error}`);
      }
    }
    return leads;
  }
}
