import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { Lead } from '../types/lead';
import { DataCleaner } from '../services/dataCleaner';
import { Validator } from '../services/validator';
import { USER_AGENTS, DELAYS } from '../config/constants';
import { Logger } from '../utils/logger';

export class WebsiteScraper {
  private getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  private getRandomDelay(): number {
    return Math.floor(Math.random() * (DELAYS.MAX_MS - DELAYS.MIN_MS) + DELAYS.MIN_MS);
  }

  async scrapeWebsite(url: string, businessName: string, ciudad: string): Promise<Lead | null> {
    try {
      Logger.info(`[Website] Scrapeando: ${url}`);

      const response = await axios.get(url, {
        headers: { 'User-Agent': this.getRandomUserAgent() },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data as string);
      const bodyText = $('body').text();

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g;

      const emailMatches = bodyText.match(emailRegex);
      let email = emailMatches ? DataCleaner.cleanEmail(emailMatches[0]) : null;

      const phoneMatches = bodyText.match(phoneRegex);
      let telefono = phoneMatches ? DataCleaner.cleanPhone(phoneMatches[0]) : null;

      // Find and scrape contact page
      const contactHref = $('a').filter((_, el) => {
        const href = $(el).attr('href') ?? '';
        const text = $(el).text().toLowerCase();
        return text.includes('contacto') || text.includes('contact') || href.includes('contact');
      }).first().attr('href');

      if (contactHref) {
        let contactUrl = contactHref;
        if (!contactUrl.startsWith('http')) {
          const base = new URL(url);
          contactUrl = `${base.protocol}//${base.host}${contactUrl.startsWith('/') ? '' : '/'}${contactUrl}`;
        }
        const contactData = await this.scrapeContactPage(contactUrl);
        email = contactData.email ?? email;
        telefono = contactData.telefono ?? telefono;
      }

      if (!email && !telefono) {
        Logger.warn(`[Website] No se encontraron contactos en: ${url}`);
        return null;
      }

      const lead: Lead = {
        nombre: DataCleaner.extractFirstName(businessName),
        apellido: DataCleaner.extractLastName(businessName),
        nombreLocal: DataCleaner.cleanBusinessName(businessName),
        ciudad,
        email: email ?? undefined,
        telefono: telefono ?? undefined,
        fuente: 'website',
        urlFuente: url,
        fechaExtraccion: new Date(),
      };

      return Validator.isLeadComplete(lead) ? lead : null;
    } catch (error) {
      if (error instanceof AxiosError) {
        Logger.error(`[Website] Error HTTP en ${url}: ${error.message}`);
      } else {
        Logger.error(`[Website] Error scrapeando ${url}: ${error}`);
      }
      return null;
    }
  }

  private async scrapeContactPage(url: string): Promise<{ email: string | null; telefono: string | null }> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.getRandomUserAgent() },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data as string);
      const bodyText = $('body').text();

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g;

      const emailMatches = bodyText.match(emailRegex);
      const phoneMatches = bodyText.match(phoneRegex);

      return {
        email: emailMatches ? DataCleaner.cleanEmail(emailMatches[0]) : null,
        telefono: phoneMatches ? DataCleaner.cleanPhone(phoneMatches[0]) : null,
      };
    } catch (error) {
      Logger.error(`[Website] Error scrapeando página de contacto: ${error}`);
      return { email: null, telefono: null };
    }
  }

  async scrapeWebsites(
    sites: Array<{ url: string; nombre: string; ciudad: string }>
  ): Promise<Lead[]> {
    const leads: Lead[] = [];
    for (const site of sites) {
      try {
        const lead = await this.scrapeWebsite(site.url, site.nombre, site.ciudad);
        if (lead) {
          leads.push(lead);
          Logger.success(`[Website] Extraído: ${site.nombre}`);
        }
        await new Promise(resolve => setTimeout(resolve, this.getRandomDelay()));
      } catch (error) {
        Logger.error(`[Website] Error con ${site.url}: ${error}`);
      }
    }
    return leads;
  }
}
