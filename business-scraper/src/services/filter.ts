import { Lead, FiltroLead } from '../types/lead';
import { FORBIDDEN_KEYWORDS } from '../config/constants';

export class Filter {
  static applyFilters(lead: Lead, filtro: FiltroLead): boolean {
    if (!this.passesForbiddenKeywords(lead)) return false;
    if (filtro.excluirCadenas && !this.isNotAChain(lead, filtro.excluirCadenas)) return false;
    if (filtro.soloConInstagram && !lead.instagram) return false;
    if (filtro.soloConEmail && !lead.email) return false;
    if (filtro.soloConTelefono && !lead.telefono) return false;
    if (
      filtro.tiposNegocioIncluidos &&
      filtro.tiposNegocioIncluidos.length > 0 &&
      lead.tipoNegocio &&
      !filtro.tiposNegocioIncluidos.includes(lead.tipoNegocio)
    ) return false;
    if (
      filtro.ciudadesIncluidas &&
      filtro.ciudadesIncluidas.length > 0 &&
      !filtro.ciudadesIncluidas.includes(lead.ciudad)
    ) return false;
    return true;
  }

  private static passesForbiddenKeywords(lead: Lead): boolean {
    const name = lead.nombreLocal.toLowerCase();
    return !FORBIDDEN_KEYWORDS.some(keyword => name.includes(keyword));
  }

  private static isNotAChain(lead: Lead, chainNames: string[]): boolean {
    const name = lead.nombreLocal.toLowerCase();
    return !chainNames.some(chain => name.includes(chain.toLowerCase()));
  }

  static filterLeads(leads: Lead[], filtro: FiltroLead): Lead[] {
    return leads.filter(lead => this.applyFilters(lead, filtro));
  }
}
