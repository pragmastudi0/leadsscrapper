// Chrome 122 (Jan 2024) — current enough to not stand out, stable enough to match real traffic
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
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

// Instagram system paths — never valid business handles
export const INSTAGRAM_EXCLUDED_HANDLES = new Set([
  'p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts',
  'about', 'legal', 'privacy', 'help', 'press', 'api', 'oauth',
  'direct', 'login', 'shoppingapi', 'locations', 'directory',
  'hashtag', 'challenge', 'developer', 'blog', 'business', 'ads',
  'jobs', 'creators', 'safety', 'data-policy', 'terms', 'lite',
  'ar', 'en', 'es', 'pt', 'fr', 'de', 'it', 'ja', 'ko', 'zh',
  'share', 'web', 'null', 'undefined', 'instagram',
]);

// Link aggregators / bio pages — require Playwright to render
export const LINK_AGGREGATORS = [
  'linktr.ee',
  'linktree.com',
  'beacons.ai',
  'bio.site',
  'campsite.bio',
  'lnk.bio',
  'taplink.cc',
  'snipfeed.co',
  'solo.to',
  'ffm.to',
  'bento.me',
  'msha.ke',
  'allmylinks.com',
  'withkoji.com',
  'milkshake.app',
  'shorby.com',
  'contactinbio.com',
  'link.bio',
  'magic.ly',
  'shor.by',
  'haystack.me',
];

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
