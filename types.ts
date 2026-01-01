
export interface Product {
  id: string;
  name: string;
  unit: string;
  ncm?: string;
}

export interface Supplier {
  id: string;
  cnpj: string;
  name: string;
  tradeName: string;
  address: string;
  city: string;
  state: string;
}

export interface Order {
  id: string;
  supplierId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  date: string;
}

export interface AppState {
  orders: Order[];
  suppliers: Supplier[];
  products: Product[];
  isLoading: boolean;
  error: string | null;
}
