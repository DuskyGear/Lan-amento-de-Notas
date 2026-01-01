
import { Supplier, Product } from "../types";

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
    // Simulação local (Mock) para substituir a chamada à IA
    // Isso garante que o fluxo funcione para demonstração sem dependências externas complexas
    
    // Simula um pequeno atraso de rede
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockProducts = [
        { name: `Produto Padrão A - ${supplierName}`, unit: 'UN', price: 150.00, qty: 10 },
        { name: `Material de Consumo B`, unit: 'CX', price: 89.90, qty: 5 },
        { name: `Serviço ou Insumo C`, unit: 'UN', price: 45.50, qty: 20 },
        { name: `Item Especializado D`, unit: 'KG', price: 12.00, qty: 100 }
    ];

    const products: Partial<Product>[] = [];
    const quantities: number[] = [];
    const prices: number[] = [];

    mockProducts.forEach((item) => {
      products.push({
        id: crypto.randomUUID(),
        name: item.name,
        unit: item.unit
      });
      quantities.push(item.qty);
      prices.push(item.price);
    });

    return { products, quantities, prices };
  }
}

export const geminiService = new GeminiService();
