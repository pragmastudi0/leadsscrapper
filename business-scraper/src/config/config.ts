import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { FiltroLead, DeduplicationConfig } from '../types/lead';

dotenv.config();

type UserFileConfig = {
  search?: {
    keywords?: string[];
    cities?: string[];
    limit?: number;
  };
};

function loadUserSearchOverrides(): UserFileConfig['search'] | null {
  const configPath = path.join(process.cwd(), 'scraper-user-config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as UserFileConfig;
    return parsed.search ?? null;
  } catch {
    return null;
  }
}

const userSearch = loadUserSearchOverrides();

const envKeywords = (process.env.SEARCH_KEYWORDS ?? 'restaurante,cafetería')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);
const envCities = (process.env.SEARCH_CITIES ?? 'Córdoba,Buenos Aires')
  .split(',')
  .map(c => c.trim())
  .filter(Boolean);
const envLimit = parseInt(process.env.SEARCH_LIMIT ?? '50', 10);

function resolveSearchLimit(): number {
  const fromUser = userSearch?.limit;
  if (typeof fromUser === 'number' && Number.isFinite(fromUser) && fromUser > 0) {
    return Math.max(1, Math.floor(fromUser));
  }
  if (Number.isFinite(envLimit) && envLimit > 0) return envLimit;
  return 50;
}

export const config = {
  search: {
    keywords: (userSearch?.keywords?.length
      ? userSearch.keywords
      : envKeywords
    ).map(k => String(k).trim()).filter(Boolean),
    cities: (userSearch?.cities?.length ? userSearch.cities : envCities)
      .map(c => String(c).trim())
      .filter(Boolean),
    limit: resolveSearchLimit(),
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
    excel: {
      enabled: process.env.EXCEL_EXPORT !== 'false',
      filename: process.env.EXCEL_FILENAME ?? 'leads.xlsx',
    },
  },

  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
};
