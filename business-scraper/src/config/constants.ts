export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
];

export const DELAYS = {
  MIN_MS: 1000,
  MAX_MS: 3000,
  BETWEEN_REQUESTS: 2000,
};

export const REGEX = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE_AR: /(\+54|0)?[ ]?(\d{2,4})?[ ]?(\d{3,4})?[ ]?(\d{4})/g,
  PHONE_GENERIC: /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g,
  INSTAGRAM: /@([a-zA-Z0-9_.-]+)/g,
  URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
};

export const GOOGLE_MAPS_SELECTORS = {
  BUSINESS_CARDS: '[data-item-id]',
  NAME: 'div[class*="fontHeadlineSmall"]',
  RATING: 'span[aria-label*="stars"]',
  ADDRESS: 'div[class*="fontBodySmall"]',
  PHONE: 'span[class*="phone"]',
  WEBSITE: 'a[data-url*="http"]',
};

export const INSTAGRAM_SELECTORS = {
  BIO: 'header section',
  PHONE: 'a[href^="tel:"]',
  EMAIL: 'a[href^="mailto:"]',
  EXTERNAL_LINK: 'a[href^="http"]',
};

export const FORBIDDEN_KEYWORDS = [
  'mcdonalds',
  'burger king',
  'starbucks',
  'coca cola',
  'cadena',
  'mall',
  'shopping',
  'franquicia',
];

export const SCRAPING_LIMITS = {
  MAX_PAGES: 50,
  MAX_PER_SOURCE: 500,
  TIMEOUT_MS: 30000,
};
