import dotenv from 'dotenv';
import { FiltroLead, DeduplicationConfig } from '../types/lead';

dotenv.config();

export const config = {
  search: {
    keywords: (process.env.SEARCH_KEYWORDS ?? 'restaurante,cafetería').split(',').map(k => k.trim()),
    cities: (process.env.SEARCH_CITIES ?? 'Córdoba,Buenos Aires').split(',').map(c => c.trim()),
    limit: parseInt(process.env.SEARCH_LIMIT ?? '50'),
  },

  scrapers: {
    googleMaps: {
      enabled: true,
      headless: process.env.GOOGLE_MAPS_HEADLESS !== 'false',
      timeout: parseInt(process.env.GOOGLE_MAPS_TIMEOUT ?? '30000'),
    },
    instagram: {
      enabled: true,
      headless: process.env.INSTAGRAM_HEADLESS !== 'false',
      timeout: parseInt(process.env.INSTAGRAM_TIMEOUT ?? '20000'),
    },
    website: {
      enabled: true,
      timeout: 10000,
    },
  },

  filters: {
    excluirCadenas: ['mcdonalds', 'burger king', 'starbucks'],
    soloConInstagram: false,
    soloConEmail: false,
    soloConTelefono: false,
  } as FiltroLead,

  deduplication: {
    compararPor: ['nombre_direccion', 'instagram', 'email'],
    sensibilidad: 'media',
  } as DeduplicationConfig,

  output: {
    googleSheets: {
      enabled: process.env.GOOGLE_SHEETS_ENABLED === 'true',
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '',
      credentialsPath: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH ?? './credentials.json',
    },
    json: {
      enabled: true,
      filename: 'leads.json',
    },
    csv: {
      enabled: true,
      filename: 'leads.csv',
    },
  },

  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
};
