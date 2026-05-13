import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { Lead } from '../types/lead';
import { Logger } from '../utils/logger';

export class ExcelOutput {
  static writeLeads(leads: Lead[], filename = 'leads.xlsx'): string {
    try {
      const outputPath = path.join(process.cwd(), 'output', filename);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      const rows = leads.map(lead => ({
        Nombre: lead.nombre ?? '',
        Apellido: lead.apellido ?? '',
        'Nombre Local': lead.nombreLocal ?? '',
        Ciudad: lead.ciudad ?? '',
        Dirección: lead.direccion ?? '',
        Email: lead.email ?? '',
        Teléfono: lead.telefono ?? '',
        Instagram: lead.instagram ?? '',
        'Tipo de Negocio': lead.tipoNegocio ?? '',
        Productos: lead.productos?.join('; ') ?? '',
        Fuente: lead.fuente ?? '',
        'URL Fuente': lead.urlFuente ?? '',
        'Fecha Extracción': new Date(lead.fechaExtraccion).toISOString(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
      XLSX.writeFile(workbook, outputPath);

      Logger.success(`[Excel] ${leads.length} leads guardados en: ${outputPath}`);
      return outputPath;
    } catch (error) {
      Logger.error(`[Excel] Error guardando archivo: ${error}`);
      throw error;
    }
  }
}
