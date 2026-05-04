import { Lead } from '../types/lead';

export class Helpers {
  static getDeduplicationStats(original: number, deduplicated: number): {
    removed: number;
    percentage: number;
  } {
    const removed = original - deduplicated;
    const percentage = original > 0 ? (removed / original) * 100 : 0;
    return { removed, percentage: Math.round(percentage * 100) / 100 };
  }

  static getScrapingStats(leads: Lead[]): {
    totalLeads: number;
    conEmail: number;
    conTelefono: number;
    conInstagram: number;
    conDireccion: number;
    porFuente: Record<string, number>;
  } {
    const stats = {
      totalLeads: leads.length,
      conEmail: 0,
      conTelefono: 0,
      conInstagram: 0,
      conDireccion: 0,
      porFuente: {} as Record<string, number>,
    };

    for (const lead of leads) {
      if (lead.email) stats.conEmail++;
      if (lead.telefono) stats.conTelefono++;
      if (lead.instagram) stats.conInstagram++;
      if (lead.direccion) stats.conDireccion++;
      stats.porFuente[lead.fuente] = (stats.porFuente[lead.fuente] ?? 0) + 1;
    }

    return stats;
  }

  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  static printStats(stats: Record<string, unknown>): void {
    console.log('\n' + '='.repeat(50));
    console.log('ESTADÍSTICAS');
    console.log('='.repeat(50));
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === 'object' && value !== null) {
        console.log(`\n${key}:`);
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          console.log(`  ${subKey}: ${subValue}`);
        }
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('='.repeat(50) + '\n');
  }
}
