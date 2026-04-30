import { GoogleAuth } from 'google-auth-library';
import { google, sheets_v4 } from 'googleapis';
import { Lead } from '../types/lead';
import { Logger } from '../utils/logger';

export class GoogleSheetsOutput {
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string;
  private initialized = false;

  constructor(spreadsheetId: string, credentialsPath: string) {
    this.spreadsheetId = spreadsheetId;
    this.init(credentialsPath);
  }

  private async init(credentialsPath: string): Promise<void> {
    try {
      const auth = new GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const authClient = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient as never });
      this.initialized = true;
      Logger.success('[Google Sheets] Autenticación exitosa');
    } catch (error) {
      Logger.error(`[Google Sheets] Error en autenticación: ${error}`);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.sheets) {
      throw new Error('Google Sheets no inicializado. Verifique las credenciales.');
    }
  }

  async createSheet(sheetName: string): Promise<string> {
    await this.ensureInitialized();
    try {
      const response = await this.sheets!.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
      const sheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
      Logger.success(`[Google Sheets] Hoja creada: ${sheetName}`);
      return sheetId?.toString() ?? '';
    } catch (error) {
      Logger.error(`[Google Sheets] Error creando hoja: ${error}`);
      throw error;
    }
  }

  async writeLeads(leads: Lead[], sheetName = 'Leads'): Promise<void> {
    await this.ensureInitialized();
    try {
      const headers = [
        'Nombre', 'Apellido', 'Nombre Local', 'Ciudad', 'Dirección',
        'Email', 'Teléfono', 'Instagram', 'Tipo de Negocio', 'Productos',
        'Fuente', 'URL Fuente', 'Fecha Extracción',
      ];

      const rows = leads.map(lead => [
        lead.nombre ?? '',
        lead.apellido ?? '',
        lead.nombreLocal ?? '',
        lead.ciudad ?? '',
        lead.direccion ?? '',
        lead.email ?? '',
        lead.telefono ?? '',
        lead.instagram ?? '',
        lead.tipoNegocio ?? '',
        lead.productos?.join('; ') ?? '',
        lead.fuente ?? '',
        lead.urlFuente ?? '',
        new Date(lead.fechaExtraccion).toLocaleDateString('es-AR'),
      ]);

      await this.sheets!.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers, ...rows] },
      });

      Logger.success(`[Google Sheets] ${leads.length} leads escritos exitosamente`);
    } catch (error) {
      Logger.error(`[Google Sheets] Error escribiendo datos: ${error}`);
      throw error;
    }
  }

  async clearSheet(sheetName: string): Promise<void> {
    await this.ensureInitialized();
    try {
      await this.sheets!.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
      });
      Logger.success(`[Google Sheets] Datos de "${sheetName}" borrados`);
    } catch (error) {
      Logger.error(`[Google Sheets] Error borrando datos: ${error}`);
    }
  }
}
