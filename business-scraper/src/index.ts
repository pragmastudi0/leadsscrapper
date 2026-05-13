import * as readline from 'readline';
import { GoogleMapsScraper } from './scrapers/googleMapsScraper';
import { InstagramScraper } from './scrapers/instagramScraper';
import { WebsiteScraper } from './scrapers/websiteScraper';
import { InstagramEnricher } from './scrapers/instagramEnricher';
import { Deduplicator } from './services/deduplicator';
import { Filter } from './services/filter';
import { GoogleSheetsOutput } from './outputs/googleSheets';
import { JSONOutput } from './outputs/jsonOutput';
import { config } from './config/config';
import { Logger } from './utils/logger';
import { Helpers } from './utils/helpers';
import { Lead } from './types/lead';

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function promptSearchParams(): Promise<{ keywords: string[]; cities: string[]; limit: number }> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n\x1b[1m\x1b[34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[1m  LEADS SCRAPPER — Configuración de búsqueda\x1b[0m');
  console.log('\x1b[1m\x1b[34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

  const defaultKeywords = config.search.keywords.join(', ');
  const defaultCities   = config.search.cities.join(', ');
  const defaultLimit    = config.search.limit;

  const kwRaw  = await ask(rl, `\x1b[33m🔑 Keywords\x1b[0m (separadas por coma) [${defaultKeywords}]: `);
  const ctRaw  = await ask(rl, `\x1b[33m📍 Ciudades\x1b[0m (separadas por coma) [${defaultCities}]: `);
  const limRaw = await ask(rl, `\x1b[33m🔢 Cantidad de resultados por búsqueda\x1b[0m [${defaultLimit}]: `);

  rl.close();

  const keywords = kwRaw.trim()
    ? kwRaw.split(',').map(k => k.trim()).filter(Boolean)
    : config.search.keywords;

  const cities = ctRaw.trim()
    ? ctRaw.split(',').map(c => c.trim()).filter(Boolean)
    : config.search.cities;

  const limit = limRaw.trim() && !isNaN(Number(limRaw))
    ? parseInt(limRaw)
    : defaultLimit;

  console.log('\n\x1b[32m✔ Configuración confirmada:\x1b[0m');
  console.log(`  Keywords : ${keywords.join(', ')}`);
  console.log(`  Ciudades : ${cities.join(', ')}`);
  console.log(`  Límite   : ${limit} por búsqueda`);
  console.log(`  Total    : ~${keywords.length * cities.length * limit} leads máx\n`);

  return { keywords, cities, limit };
}

// ── Enrichment pipeline ──────────────────────────────────────────────────────
// Phase 1: visit each lead's website → extract social links
// Phase 2: for each lead with an Instagram handle → enrich profile data

async function enrichLeads(leads: Lead[]): Promise<Lead[]> {
  const websiteScraper = new WebsiteScraper();
  const igEnricher = new InstagramEnricher();

  // ── Phase 1: website → social links ───────────────────────────────────────
  const leadsWithSite = leads.filter(l => l.sitioWeb);
  if (leadsWithSite.length > 0) {
    Logger.info(`[Enrichment] 🌐 Fase 1: enriqueciendo ${leadsWithSite.length} leads con website...`);
    for (const lead of leadsWithSite) {
      try {
        const links = await websiteScraper.extractSocialLinks(lead.sitioWeb!);

        // Only fill in fields that are still empty (don't overwrite Google Maps data)
        if (!lead.instagram && links.instagramUsername) {
          lead.instagram    = links.instagramUsername;
          lead.instagramUrl = links.instagramUrl;
          Logger.success(`[Enrichment]   📸 @${links.instagramUsername} ← ${lead.nombreLocal}`);
        }
        if (!lead.facebookUrl && links.facebookUrl) {
          lead.facebookUrl = links.facebookUrl;
        }
        if (!lead.tiktokUrl && links.tiktokUrl) {
          lead.tiktokUrl = links.tiktokUrl;
        }
        if (!lead.email && links.email) {
          lead.email = links.email;
        }
        if (!lead.telefono && links.telefono) {
          lead.telefono = links.telefono;
        }
      } catch (err) {
        Logger.warn(`[Enrichment] Error enriqueciendo ${lead.nombreLocal}: ${err}`);
      }
      // Polite delay between website requests
      await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
    }
  }

  // ── Phase 2: Instagram handle → profile data ───────────────────────────────
  const leadsWithIG = leads.filter(l => l.instagram);
  if (leadsWithIG.length > 0) {
    Logger.info(`[Enrichment] 📸 Fase 2: enriqueciendo ${leadsWithIG.length} perfiles de Instagram...`);
    for (const lead of leadsWithIG) {
      try {
        const profile = await igEnricher.enrichProfile(lead.instagram!);
        if (profile) {
          if (profile.bio)     lead.instagramBio      = profile.bio;
          if (profile.website) lead.instagramSitioWeb = profile.website;
          if (profile.email)   lead.instagramEmail    = profile.email;
          if (profile.phone)   lead.instagramTelefono = profile.phone;

          // If no email/phone from Google Maps or website, use Instagram's
          if (!lead.email   && profile.email) lead.email   = profile.email;
          if (!lead.telefono && profile.phone) lead.telefono = profile.phone;

          Logger.success(`[Enrichment]   ✅ @${lead.instagram} enriquecido`);
        }
      } catch (err) {
        Logger.warn(`[Enrichment] Error IG @${lead.instagram}: ${err}`);
      }
      // Instagram is rate-sensitive — longer pause
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
    }
  }

  return leads;
}

class BusinessScraper {
  async run(): Promise<void> {
    const startTime = Date.now();

    try {
      const { keywords, cities, limit } = await promptSearchParams();

      Logger.header('BUSINESS SCRAPER - INICIANDO EJECUCIÓN');

      const allLeads: Lead[] = [];

      // ── Google Maps scraper ──────────────────────────────────────────────
      if (config.scrapers.googleMaps.enabled) {
        Logger.info('Ejecutando Google Maps scraper...');
        const gmScraper = new GoogleMapsScraper();

        for (const keyword of keywords) {
          for (const city of cities) {
            try {
              const leads = await gmScraper.searchBusinesses({ keyword, ciudad: city, limite: limit });
              allLeads.push(...leads);
            } catch (error) {
              Logger.error(`Error en búsqueda "${keyword}" en ${city}: ${error}`);
            }
          }
        }

        await gmScraper.close();
      }

      // ── Website + Instagram enrichment ───────────────────────────────────
      if (allLeads.length > 0) {
        Logger.info(`[Enrichment] Iniciando enriquecimiento de ${allLeads.length} leads...`);
        await enrichLeads(allLeads);
        const withIG = allLeads.filter(l => l.instagram).length;
        Logger.success(`[Enrichment] Completado. Leads con Instagram: ${withIG}/${allLeads.length}`);
      }

      // ── Instagram direct scraper (from INSTAGRAM_ACCOUNTS env) ───────────
      if (config.scrapers.instagram.enabled) {
        const accounts = (process.env.INSTAGRAM_ACCOUNTS ?? '')
          .split(',').map(a => a.trim()).filter(Boolean);

        if (accounts.length > 0) {
          Logger.info('Ejecutando Instagram scraper directo...');
          const igScraper = new InstagramScraper();
          try {
            const leads = await igScraper.scrapeProfiles(accounts);
            allLeads.push(...leads);
          } catch (error) {
            Logger.error(`Error en Instagram scraper: ${error}`);
          }
          await igScraper.close();
        } else {
          Logger.warn('Instagram: No hay cuentas configuradas en INSTAGRAM_ACCOUNTS');
        }
      }

      Logger.success(`Total leads antes de deduplicación: ${allLeads.length}`);

      // ── Deduplicate ──────────────────────────────────────────────────────
      Logger.info('Deduplicando leads...');
      const dedupedLeads = Deduplicator.deduplicateLeads(allLeads, config.deduplication);
      const dedupStats = Helpers.getDeduplicationStats(allLeads.length, dedupedLeads.length);
      Logger.success(`Leads únicos: ${dedupedLeads.length} (${dedupStats.removed} removidos, ${dedupStats.percentage}%)`);

      // ── Filter ───────────────────────────────────────────────────────────
      Logger.info('Aplicando filtros...');
      const filteredLeads = Filter.filterLeads(dedupedLeads, config.filters);
      Logger.success(`Leads tras filtrado: ${filteredLeads.length}`);

      // ── Export ───────────────────────────────────────────────────────────
      Logger.info('Exportando resultados...');

      if (config.output.json.enabled) {
        JSONOutput.writeLeads(filteredLeads, config.output.json.filename);
      }
      if (config.output.csv.enabled) {
        JSONOutput.writeLeadsCSV(filteredLeads, config.output.csv.filename);
      }
      if (config.output.googleSheets.enabled && config.output.googleSheets.spreadsheetId) {
        try {
          const sheets = new GoogleSheetsOutput(
            config.output.googleSheets.spreadsheetId,
            config.output.googleSheets.credentialsPath,
          );
          await sheets.writeLeads(filteredLeads);
        } catch (error) {
          Logger.error(`Error exportando a Google Sheets: ${error}`);
        }
      }

      const stats = Helpers.getScrapingStats(filteredLeads);
      Helpers.printStats(stats as Record<string, unknown>);

      const duration = Date.now() - startTime;
      Logger.success(`Ejecución completada en ${Helpers.formatDuration(duration)}`);
    } catch (error) {
      Logger.error(`Error fatal en aplicación: ${error}`);
      process.exit(1);
    }
  }
}

const scraper = new BusinessScraper();
scraper.run().catch(error => {
  Logger.error(`Uncaught error: ${error}`);
  process.exit(1);
});
