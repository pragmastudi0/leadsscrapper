import * as readline from 'readline';
import { GoogleMapsScraper } from './scrapers/googleMapsScraper';
import { InstagramScraper } from './scrapers/instagramScraper';
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

class BusinessScraper {
  async run(): Promise<void> {
    const startTime = Date.now();

    try {
      const { keywords, cities, limit } = await promptSearchParams();

      Logger.header('BUSINESS SCRAPER - INICIANDO EJECUCIÓN');

      const allLeads: Lead[] = [];

      // Google Maps scraper
      if (config.scrapers.googleMaps.enabled) {
        Logger.info('Ejecutando Google Maps scraper...');
        const gmScraper = new GoogleMapsScraper();

        for (const keyword of keywords) {
          for (const city of cities) {
            try {
              const leads = await gmScraper.searchBusinesses({
                keyword,
                ciudad: city,
                limite: limit,
              });
              allLeads.push(...leads);
            } catch (error) {
              Logger.error(`Error en búsqueda "${keyword}" en ${city}: ${error}`);
            }
          }
        }

        await gmScraper.close();
      }

      // Instagram scraper
      if (config.scrapers.instagram.enabled) {
        Logger.info('Ejecutando Instagram scraper...');
        const igScraper = new InstagramScraper();

        // Add Instagram handles from env or use empty array (populate as needed)
        const accounts = (process.env.INSTAGRAM_ACCOUNTS ?? '')
          .split(',')
          .map(a => a.trim())
          .filter(Boolean);

        if (accounts.length > 0) {
          try {
            const leads = await igScraper.scrapeProfiles(accounts);
            allLeads.push(...leads);
          } catch (error) {
            Logger.error(`Error en Instagram scraper: ${error}`);
          }
        } else {
          Logger.warn('Instagram: No hay cuentas configuradas en INSTAGRAM_ACCOUNTS');
        }

        await igScraper.close();
      }

      Logger.success(`Total leads antes de deduplicación: ${allLeads.length}`);

      // Deduplicate
      Logger.info('Deduplicando leads...');
      const dedupedLeads = Deduplicator.deduplicateLeads(allLeads, config.deduplication);
      const dedupStats = Helpers.getDeduplicationStats(allLeads.length, dedupedLeads.length);
      Logger.success(`Leads únicos: ${dedupedLeads.length} (${dedupStats.removed} removidos, ${dedupStats.percentage}%)`);

      // Filter
      Logger.info('Aplicando filtros...');
      const filteredLeads = Filter.filterLeads(dedupedLeads, config.filters);
      Logger.success(`Leads tras filtrado: ${filteredLeads.length}`);

      // Export
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
            config.output.googleSheets.credentialsPath
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
