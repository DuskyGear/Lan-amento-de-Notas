
import { Supplier, Product } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class GeminiService {
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

  async simulateInvoiceProducts(supplierName: string, supplierActivity: string): Promise<{products: Partial<Product>[], quantities: number[], prices: number[]}> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere uma lista de 4 produtos reais para a empresa "${supplierName}". Responda apenas o JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    price: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{ "items": [] }');
      return {
        products: result.items.map((i: any) => ({ name: i.name, unit: i.unit })),
        quantities: result.items.map((i: any) => i.quantity),
        prices: result.items.map((i: any) => i.price)
      };
    } catch {
      return { products: [{ name: "Item Genérico", unit: "UN" }], quantities: [1], prices: [10.0] };
    }
  }
}

export const geminiService = new GeminiService();
