export interface Lead {
  nombre: string;
  apellido?: string;
  nombreLocal: string;
  ciudad: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  instagram?: string;
  tipoNegocio?: string;
  productos?: string[];
  fuente: string;
  urlFuente?: string;
  fechaExtraccion: Date;
  hashUnico?: string;
}

export interface ScrapingResult {
  exito: boolean;
  leads: Lead[];
  errores: string[];
  cantidad: number;
  duracion: number;
}

export interface GoogleMapsSearchOptions {
  keyword: string;
  ciudad: string;
  limite?: number;
}

export interface DeduplicationConfig {
  compararPor: ('nombre_direccion' | 'instagram' | 'email')[];
  sensibilidad: 'alta' | 'media' | 'baja';
}

export interface FiltroLead {
  excluirCadenas?: string[];
  soloConInstagram?: boolean;
  soloNegociosPequenos?: boolean;
  soloConEmail?: boolean;
  soloConTelefono?: boolean;
  tiposNegocioIncluidos?: string[];
  ciudadesIncluidas?: string[];
}
