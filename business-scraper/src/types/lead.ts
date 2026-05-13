export interface Lead {
  // Identity
  nombre: string;
  apellido?: string;
  nombreLocal: string;
  keyword?: string;
  categoria?: string;

  // Location
  ciudad: string;
  direccion?: string;

  // Contact
  email?: string;
  telefono?: string;

  // Web presence
  sitioWeb?: string;

  // Google Maps
  googleMapsUrl?: string;
  rating?: string;
  reviews?: string;

  // Instagram (handle + enriched data)
  instagram?: string;          // username only
  instagramUrl?: string;       // full https://instagram.com/handle
  instagramBio?: string;
  instagramSitioWeb?: string;  // link-in-bio
  instagramTelefono?: string;
  instagramEmail?: string;

  // Other socials
  facebookUrl?: string;
  tiktokUrl?: string;

  // Meta
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
  maxReviews?: number;   // discard leads with more reviews than this (large chains)
}
