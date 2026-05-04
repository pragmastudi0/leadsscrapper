import { REGEX } from '../config/constants';

export class DataCleaner {
  static cleanBusinessName(name: string): string {
    if (!name) return '';
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.áéíóúÁÉÍÓÚñÑüÜ]/g, '')
      .replace(/\b(spa|ver más|\.\.\.)\b/gi, '')
      .trim();
  }

  static cleanAddress(address: string): string {
    if (!address) return '';
    return address
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/,\s*,/g, ',')
      .toUpperCase()
      .trim();
  }

  static cleanPhone(phone: string): string | null {
    if (!phone) return null;
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.includes('+54')) {
      cleaned = cleaned.replace('+54', '');
    } else if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    const match = cleaned.match(/(\d{1,2})(\d{3,4})(\d{4})/);
    if (match) {
      return `+54 ${match[1]} ${match[2]}-${match[3]}`;
    }
    if (cleaned.length >= 8 && cleaned.length <= 15) {
      return `+54 ${cleaned}`;
    }
    return null;
  }

  static cleanEmail(email: string): string | null {
    if (!email) return null;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = email.match(emailRegex);
    if (!match) return null;
    const cleaned = match[0].toLowerCase().trim();
    if (cleaned.includes('..') || cleaned.startsWith('.') || cleaned.endsWith('.')) {
      return null;
    }
    return cleaned;
  }

  static cleanInstagram(instagram: string): string | null {
    if (!instagram) return null;
    const cleaned = instagram
      .replace('@', '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_.-]/g, '');
    if (cleaned.length < 3 || cleaned.length > 30) return null;
    return cleaned;
  }

  static cleanUrl(url: string): string | null {
    if (!url) return null;
    try {
      const formatted = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
      new URL(formatted);
      return formatted;
    } catch {
      return null;
    }
  }

  static cleanBusinessType(type: string): string | null {
    if (!type) return null;
    const cleaned = type.toLowerCase().trim();
    const mapping: Record<string, string> = {
      'restaurante': 'Restaurante',
      'restaurant': 'Restaurante',
      'café': 'Cafetería',
      'coffee': 'Cafetería',
      'peluquería': 'Peluquería',
      'barber': 'Peluquería',
      'farmacia': 'Farmacia',
      'pharmacy': 'Farmacia',
      'tienda': 'Comercio',
      'shop': 'Comercio',
      'oficina': 'Oficina',
      'office': 'Oficina',
    };
    for (const [key, value] of Object.entries(mapping)) {
      if (cleaned.includes(key)) return value;
    }
    return type;
  }

  static extractFirstName(fullName: string): string {
    if (!fullName) return '';
    return fullName.split(' ')[0].trim();
  }

  static extractLastName(fullName: string): string | undefined {
    if (!fullName) return undefined;
    const parts = fullName.trim().split(' ');
    if (parts.length < 2) return undefined;
    return parts.slice(1).join(' ');
  }

  static stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
