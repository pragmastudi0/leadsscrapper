import { Lead, DeduplicationConfig } from '../types/lead';
import crypto from 'crypto';

export class Deduplicator {
  static generateHash(lead: Lead): string {
    const key = `${lead.nombreLocal}_${lead.ciudad}`;
    return crypto.createHash('md5').update(key.toLowerCase()).digest('hex');
  }

  static generateInstagramHash(instagram: string): string {
    return crypto.createHash('md5').update(instagram.toLowerCase()).digest('hex');
  }

  static generateEmailHash(email: string): string {
    return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  }

  static calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private static levenshteinDistance(s1: string, s2: string): number {
    const costs: Record<number, number> = {};
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  static areDuplicates(lead1: Lead, lead2: Lead, config: DeduplicationConfig): boolean {
    const thresholds = { alta: 0.95, media: 0.85, baja: 0.75 };
    const threshold = thresholds[config.sensibilidad];

    for (const metodo of config.compararPor) {
      if (metodo === 'nombre_direccion') {
        const nameSimilarity = this.calculateSimilarity(lead1.nombreLocal, lead2.nombreLocal);
        const addressMatch = lead1.direccion === lead2.direccion && lead1.ciudad === lead2.ciudad;
        if (nameSimilarity > threshold && addressMatch) return true;
      }
      if (metodo === 'instagram') {
        if (
          lead1.instagram &&
          lead2.instagram &&
          lead1.instagram.toLowerCase() === lead2.instagram.toLowerCase()
        ) return true;
      }
      if (metodo === 'email') {
        if (
          lead1.email &&
          lead2.email &&
          lead1.email.toLowerCase() === lead2.email.toLowerCase()
        ) return true;
      }
    }
    return false;
  }

  static deduplicateLeads(leads: Lead[], config: DeduplicationConfig): Lead[] {
    const unique: Lead[] = [];
    const seen = new Set<string>();

    for (const lead of leads) {
      let isDuplicate = false;
      for (const uniqueLead of unique) {
        if (this.areDuplicates(lead, uniqueLead, config)) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        unique.push(lead);
        seen.add(this.generateHash(lead));
      }
    }
    return unique;
  }
}
