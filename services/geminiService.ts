
import { Supplier } from "../types";

export class CnpjService {
  /**
   * Consulta CNPJ via BrasilAPI. 
   * Retorna os dados ou null se o serviço estiver indisponível/não encontrado.
   */
  async lookupCnpj(cnpj: string): Promise<Partial<Supplier> | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) return null;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) {
        return null; // Silencioso: Se a API falhar, o chamador usa os dados locais/manuais
      }

      const data = await response.json();

      return {
        name: data.razao_social,
        tradeName: data.nome_fantasia || data.razao_social,
        cnpj: data.cnpj,
        address: `${data.logradouro}${data.numero ? ', ' + data.numero : ''}`,
        city: data.municipio,
        state: data.uf
      };
    } catch (error) {
      // Falha de rede ou DNS: retorna null sem erro no console
      return null;
    }
  }
}

export const cnpjService = new CnpjService();
