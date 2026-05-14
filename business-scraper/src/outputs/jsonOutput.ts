import fs from 'fs';
import path from 'path';
import { Lead } from '../types/lead';
import { Logger } from '../utils/logger';

export class JSONOutput {
  static writeLeads(leads: Lead[], filename = 'leads.json'): string {
    try {
      const outputPath = path.join(process.cwd(), 'output', filename);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      const leadsForJson = leads.map(lead => ({
        ...lead,
        fechaExtraccion: lead.fechaExtraccion.toISOString(),
      }));

      fs.writeFileSync(outputPath, JSON.stringify(leadsForJson, null, 2));
      Logger.success(`[JSON] ${leads.length} leads guardados en: ${outputPath}`);
      return outputPath;
    } catch (error) {
      Logger.error(`[JSON] Error guardando archivo: ${error}`);
      throw error;
    }
  }

  static writeLeadsCSV(leads: Lead[], filename = 'leads.csv'): string {
    try {
      const outputPath = path.join(process.cwd(), 'output', filename);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      const headers = [
        'OPORTUNIDAD',
        'Nombre Local',
        'Keyword',
        'Categoría',
        'Ciudad',
        'Dirección',
        'Teléfono',
        'Email',
        'Sitio Web',
        'Google Maps URL',
        'Rating',
        'Reseñas',
        'Instagram Username',
        'Instagram URL',
        'Instagram Bio',
        'Instagram Sitio Web',
        'Instagram Teléfono',
        'Instagram Email',
        'Facebook URL',
        'TikTok URL',
        'Fuente',
        'Fecha Extracción',
      ];

      const csvContent = [
        headers.join(','),
        ...leads.map(lead =>
          [
            this.escapeCsv(lead.oportunidad ?? ''),
            this.escapeCsv(lead.nombreLocal ?? ''),
            this.escapeCsv(lead.keyword ?? ''),
            this.escapeCsv(lead.categoria ?? ''),
            this.escapeCsv(lead.ciudad ?? ''),
            this.escapeCsv(lead.direccion ?? ''),
            this.escapeCsv(lead.telefono ?? ''),
            this.escapeCsv(lead.email ?? ''),
            this.escapeCsv(lead.sitioWeb ?? ''),
            this.escapeCsv(lead.googleMapsUrl ?? lead.urlFuente ?? ''),
            this.escapeCsv(lead.rating ?? ''),
            this.escapeCsv(lead.reviews ?? ''),
            this.escapeCsv(lead.instagram ?? ''),
            this.escapeCsv(lead.instagramUrl ?? ''),
            this.escapeCsv(lead.instagramBio ?? ''),
            this.escapeCsv(lead.instagramSitioWeb ?? ''),
            this.escapeCsv(lead.instagramTelefono ?? ''),
            this.escapeCsv(lead.instagramEmail ?? ''),
            this.escapeCsv(lead.facebookUrl ?? ''),
            this.escapeCsv(lead.tiktokUrl ?? ''),
            this.escapeCsv(lead.fuente ?? ''),
            new Date(lead.fechaExtraccion).toLocaleDateString('es-AR'),
          ].join(',')
        ),
      ].join('\n');

      fs.writeFileSync(outputPath, '﻿' + csvContent); // BOM for Excel UTF-8
      Logger.success(`[CSV] ${leads.length} leads guardados en: ${outputPath}`);
      return outputPath;
    } catch (error) {
      Logger.error(`[CSV] Error guardando archivo: ${error}`);
      throw error;
    }
  }

  private static escapeCsv(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
