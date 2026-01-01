
import { Supplier, Product } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Inicialização da IA com a chave fornecida pelo ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class GeminiService {
  async lookupCnpj(cnpj: string): Promise<Partial<Supplier>> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) {
        if (response.status === 404) throw new Error("CNPJ não encontrado.");
        throw new Error("Erro ao consultar BrasilAPI.");
      }

      const data = await response.json();

      return {
        name: data.razao_social,
        tradeName: data.nome_fantasia || data.razao_social,
        cnpj: data.cnpj,
        address: `${data.logradouro}${data.numero ? ', ' + data.numero : ''}${data.complemento ? ' - ' + data.complemento : ''}${data.bairro ? ' (' + data.bairro + ')' : ''}`,
        city: data.municipio,
        state: data.uf
      };
    } catch (error) {
      console.error("BrasilAPI lookup failed:", error);
      throw error;
    }
  }

  async simulateInvoiceProducts(supplierName: string, supplierActivity: string): Promise<{products: Partial<Product>[], quantities: number[], prices: number[]}> {
    // Utiliza o Gemini para gerar uma lista de produtos verossímil baseada no nome e atividade da empresa
    // Isso simula a leitura do XML da NFe quando não temos certificado digital
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Gere uma lista simulada de 3 a 5 produtos que constariam em uma nota fiscal de um fornecedor chamado "${supplierName}" (Atividade provável: ${supplierActivity}). 
        Para cada item, forneça um nome comercial realista, uma unidade de medida comum (UN, KG, LT, CX), uma quantidade típica e um preço unitário realista em Reais.`,
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
                    name: { type: Type.STRING, description: "Nome comercial do produto" },
                    unit: { type: Type.STRING, description: "Sigla da unidade (UN, KG, LT)" },
                    quantity: { type: Type.NUMBER, description: "Quantidade comprada" },
                    price: { type: Type.NUMBER, description: "Preço unitário em reais" }
                  }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{ "items": [] }');
      
      const products: Partial<Product>[] = [];
      const quantities: number[] = [];
      const prices: number[] = [];

      result.items.forEach((item: any) => {
        products.push({
          id: crypto.randomUUID(), // ID temporário
          name: item.name,
          unit: item.unit
        });
        quantities.push(item.quantity);
        prices.push(item.price);
      });

      return { products, quantities, prices };

    } catch (error) {
      console.error("Gemini simulation failed:", error);
      // Fallback simples caso a IA falhe
      return {
        products: [{ name: "Produto Diverso", unit: "UN" }],
        quantities: [1],
        prices: [100.00]
      };
    }
  }
}

export const geminiService = new GeminiService();
