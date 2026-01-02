
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Order, Supplier, Product, AppState, Branch } from './types';
import { cnpjService } from './services/geminiService';
import { createClient } from '@supabase/supabase-js';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// --- Supabase Config ---
const SUPABASE_URL = 'https://supabase.santosapp.com.br';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY3MzIyODAwLCJleHAiOjE5MjUwODkyMDB9.UFuabFakxO4zmc_C_K_ksUZNfdtUAxaSvUytS0ofiAk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helper Functions ---

const normalizeStr = (s: string) => s ? s.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

const parseBrazilianValue = (val: any) => {
  if (typeof val === 'number') return val;
  const s = String(val || '').trim();
  // Remove R$, espaços e converte formato brasileiro para float
  return parseFloat(s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

const formatCompactCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDocument = (doc: string) => {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

const parseFlexibleDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  
  // Tratamento para datas do Excel (número serial)
  if (typeof val === 'number' && val > 30000) {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  const s = String(val).trim();
  
  // Tratamento DD/MM/AAAA ou DD/MM/AA
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      // Verifica se é uma data válida antes de retornar
      const iso = `${y}-${m}-${d}`;
      if (!isNaN(Date.parse(iso))) return iso;
    }
  }
  
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) return new Date(parsed).toISOString().split('T')[0];
  
  return new Date().toISOString().split('T')[0];
};

// --- Shared Components ---

const SectionTitle = ({ children, icon }: { children?: React.ReactNode, icon: string }) => (
  <div className="flex items-center space-x-2 mb-6">
    <div className="bg-indigo-50 p-2.5 rounded-2xl">
      <i className={`fas ${icon} text-indigo-600 text-sm`}></i>
    </div>
    <h2 className="text-xl font-bold text-gray-800 tracking-tight">{children}</h2>
  </div>
);

interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

const SearchableSelect = ({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder = "Pesquisar...",
  variant = "default"
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void, 
  options: SearchableOption[],
  placeholder?: string,
  variant?: "default" | "small"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const s = normalizeStr(search);
    return options.filter(opt => 
      normalizeStr(opt.label).includes(s) || 
      (opt.sublabel && normalizeStr(opt.sublabel).includes(s))
    );
  }, [search, options]);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative group" ref={containerRef}>
      {label && <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 tracking-widest">{label}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`${variant === 'small' ? 'px-6 py-3' : 'px-8 py-4'} w-full rounded-full border border-slate-200 bg-white shadow-sm cursor-pointer flex items-center justify-between transition-all group-focus-within:border-indigo-500`}
      >
        <span className={`font-semibold truncate text-sm ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-300 text-[10px] ml-2`}></i>
      </div>

      {isOpen && (
        <div className="absolute z-[60] w-full mt-2 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50">
            <input 
              autoFocus
              className="w-full px-6 py-3 rounded-full border border-slate-200 bg-white outline-none text-sm font-semibold text-slate-700"
              placeholder="Digite para filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div 
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); setSearch(''); }}
                  className={`px-8 py-4 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${value === opt.value ? 'bg-indigo-50/50' : ''}`}
                >
                  <p className="font-bold text-slate-700 text-sm">{opt.label}</p>
                  {opt.sublabel && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{opt.sublabel}</p>}
                </div>
              ))
            ) : (
              <div className="px-8 py-10 text-center text-slate-400 italic text-sm">Sem resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const colors = { success: 'bg-emerald-500', error: 'bg-rose-500', info: 'bg-indigo-600' };
  return (
    <div className={`fixed bottom-8 right-8 ${colors[type]} text-white px-8 py-5 rounded-[2rem] shadow-2xl z-[100] flex items-center space-x-4 animate-in slide-in-from-bottom-10`}>
      <i className="fas fa-info-circle text-xl"></i>
      <span className="font-bold text-sm">{message}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100"><i className="fas fa-times"></i></button>
    </div>
  );
};

const LoginScreen = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async () => {
    setIsLoading(true);
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Preencha email e senha.');
      setIsLoading(false);
      return;
    }

    try {
      if (isRegister) {
        if (!username) {
          setErrorMsg('Preencha o nome de usuário.');
          setIsLoading(false);
          return;
        }

        const { data: existingUser } = await supabase.from('users').select('*').eq('email', email).single();
        if (existingUser) {
          setErrorMsg('Este email já está cadastrado.');
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.from('users').insert({
          email,
          username,
          password // Nota: Em produção, usar hash ou Supabase Auth
        });

        if (error) throw error;
        
        alert('Cadastro realizado com sucesso! Faça login.');
        setIsRegister(false);
        setPassword('');
      } else {
        const { data, error } = await supabase.from('users').select('*').eq('email', email).eq('password', password).single();
        
        if (error || !data) {
          setErrorMsg('Email ou senha inválidos.');
        } else {
          onLoginSuccess();
        }
      }
    } catch (err) {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-12 text-center relative">
        <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-6 shadow-lg"><i className="fas fa-layer-group text-2xl"></i></div>
        <h1 className="text-3xl font-black text-white mb-2">Cotify ERP</h1>
        <p className="text-white/60 text-sm font-semibold mb-8 uppercase tracking-widest">{isRegister ? 'Criar Nova Conta' : 'Acesso ao Sistema'}</p>
        
        <form onSubmit={e => { e.preventDefault(); handleAuth(); }} className="space-y-4">
          {isRegister && (
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-6 py-4 rounded-full bg-black/20 border border-white/10 text-white placeholder-white/40 outline-none transition-all focus:bg-black/40" placeholder="Nome de Usuário" />
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 rounded-full bg-black/20 border border-white/10 text-white placeholder-white/40 outline-none transition-all focus:bg-black/40" placeholder="Seu Email" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 rounded-full bg-black/20 border border-white/10 text-white placeholder-white/40 outline-none transition-all focus:bg-black/40" placeholder="Sua Senha" />
          
          {errorMsg && <div className="text-rose-400 text-xs font-bold bg-rose-500/10 py-2 rounded-lg">{errorMsg}</div>}

          <button type="submit" disabled={isLoading} className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white py-5 rounded-full font-black uppercase tracking-widest shadow-xl transition-all mt-4">
            {isLoading ? 'Processando...' : (isRegister ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/10">
          <button onClick={() => { setIsRegister(!isRegister); setErrorMsg(''); }} className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            {isRegister ? 'Já tem uma conta? Fazer Login' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
};

type View = 'dashboard' | 'suppliers' | 'products' | 'nfe-import' | 'nfe-manual' | 'branches' | 'product-details';

const COLORS = ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [notification, setNotification] = useState<{message: string, type: 'success'|'error'|'info'} | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [state, setState] = useState<AppState>({ orders: [], suppliers: [], products: [], branches: [], isLoading: false, error: null });
  const [dashboardBranchFilter, setDashboardBranchFilter] = useState('all');
  const [importTargetBranchId, setImportTargetBranchId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // States para CRUD de Unidades
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState({ docType: 'CNPJ', doc: '', name: '', tradeName: '' });

  // States para CRUD de Fornecedores
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({ docType: 'CNPJ', doc: '', name: '', tradeName: '' });

  // States para Catálogo de Produtos
  const [productSearch, setProductSearch] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', unit: '' });

  // States para Lançamento Manual de Nota
  const [manualNote, setManualNote] = useState({
    branchId: '',
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    items: [] as { productId: string, quantity: number, unitPrice: number }[]
  });
  const [manualItemForm, setManualItemForm] = useState({ productId: '', quantity: 1, unitPrice: 0 });

  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => setNotification({ message, type });

  // --- Data Sync with Supabase ---
  const fetchAllData = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [b, s, p, o] = await Promise.all([
        supabase.from('branches').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('orders').select('*').order('date', { ascending: false })
      ]);
      setState({ 
        branches: b.data || [], 
        suppliers: s.data || [], 
        products: p.data || [], 
        orders: o.data || [], 
        isLoading: false, 
        error: null 
      });
    } catch (err) {
      notify("Erro ao conectar ao banco de dados", "error");
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    if (localStorage.getItem('cotify_auth') === 'true') setIsAuthenticated(true);
    // Initial fetch from Supabase
    if (isAuthenticated) fetchAllData();
  }, [isAuthenticated]);

  // --- Handlers para Unidades ---

  const handleOpenAddBranch = () => {
    setEditingBranchId(null);
    setBranchForm({ docType: 'CNPJ', doc: '', name: '', tradeName: '' });
    setShowAddBranch(true);
  };

  const handleOpenEditBranch = (branch: Branch) => {
    setEditingBranchId(branch.id);
    setBranchForm({ 
      docType: branch.cnpj.length === 11 ? 'CPF' : 'CNPJ', 
      doc: branch.cnpj, 
      name: branch.name, 
      tradeName: branch.tradeName 
    });
    setShowAddBranch(true);
  };

  const handleSaveBranch = async () => {
    const cleanDoc = branchForm.doc.replace(/\D/g, '');
    const requiredLen = branchForm.docType === 'CNPJ' ? 14 : 11;
    if (cleanDoc.length !== requiredLen) return notify(`${branchForm.docType} inválido`, "error");
    if (!branchForm.name.trim()) return notify("Nome obrigatório", "error");

    const payload = {
      cnpj: cleanDoc,
      name: branchForm.name,
      "tradeName": branchForm.tradeName || branchForm.name
    };

    let error;
    if (editingBranchId) {
      const res = await supabase.from('branches').update(payload).eq('id', editingBranchId);
      error = res.error;
    } else {
      const res = await supabase.from('branches').insert(payload);
      error = res.error;
    }

    if (error) {
      notify("Erro ao salvar unidade.", "error");
    } else {
      notify(editingBranchId ? "Unidade atualizada!" : "Unidade cadastrada!");
      setShowAddBranch(false);
      fetchAllData();
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta unidade? Todos os lançamentos vinculados a ela também serão removidos.")) {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) notify("Erro ao excluir.", "error");
      else {
        notify("Unidade excluída.", "info");
        fetchAllData();
      }
    }
  };

  // --- Handlers para Fornecedores ---

  const handleOpenAddSupplier = () => {
    setEditingSupplierId(null);
    setSupplierForm({ docType: 'CNPJ', doc: '', name: '', tradeName: '' });
    setShowAddSupplier(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setSupplierForm({ 
      docType: supplier.cnpj.length === 11 ? 'CPF' : 'CNPJ', 
      doc: supplier.cnpj, 
      name: supplier.name, 
      tradeName: supplier.tradeName || supplier.name
    });
    setShowAddSupplier(true);
  };

  const handleSaveSupplier = async () => {
    const cleanDoc = supplierForm.doc.replace(/\D/g, '');
    const requiredLen = supplierForm.docType === 'CNPJ' ? 14 : 11;
    if (cleanDoc.length !== requiredLen) return notify(`${supplierForm.docType} inválido`, "error");
    if (!supplierForm.name.trim()) return notify("Nome obrigatório", "error");

    const payload = {
      cnpj: cleanDoc,
      name: supplierForm.name,
      "tradeName": supplierForm.tradeName || supplierForm.name
    };

    let error;
    if (editingSupplierId) {
      const res = await supabase.from('suppliers').update(payload).eq('id', editingSupplierId);
      error = res.error;
    } else {
      const res = await supabase.from('suppliers').insert(payload);
      error = res.error;
    }

    if (error) {
      notify("Erro ao salvar fornecedor.", "error");
    } else {
      notify(editingSupplierId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
      setShowAddSupplier(false);
      fetchAllData();
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (window.confirm("Excluir este fornecedor removerá todos os registros de compras vinculados a ele. Continuar?")) {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) notify("Erro ao excluir.", "error");
      else {
        notify("Fornecedor removido.", "info");
        fetchAllData();
      }
    }
  };

  // --- Handlers para Produtos ---

  const handleSaveProduct = async () => {
    const { error } = await supabase.from('products').insert({
      name: productForm.name || 'Produto sem nome',
      unit: productForm.unit || 'UN'
    });

    if (error) notify("Erro ao adicionar produto.", "error");
    else {
      notify("Produto adicionado ao catálogo!");
      setShowAddProduct(false);
      setProductForm({ name: '', unit: '' });
      fetchAllData();
    }
  };

  // --- Handlers para Lançamento Manual de Nota ---

  const addManualItem = () => {
    if (!manualItemForm.productId) return notify("Selecione um produto", "error");
    if (manualItemForm.quantity <= 0) return notify("Quantidade inválida", "error");
    if (manualItemForm.unitPrice < 0) return notify("Preço inválido", "error");

    setManualNote(prev => ({
      ...prev,
      items: [...prev.items, { ...manualItemForm }]
    }));
    setManualItemForm({ productId: '', quantity: 1, unitPrice: 0 });
  };

  const removeManualItem = (index: number) => {
    setManualNote(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const saveManualNote = async () => {
    if (!manualNote.branchId) return notify("Selecione a unidade", "error");
    if (!manualNote.supplierId) return notify("Selecione o fornecedor", "error");
    if (manualNote.items.length === 0) return notify("Adicione ao menos um produto", "error");

    const newOrders = manualNote.items.map(item => ({
      "branchId": manualNote.branchId,
      "supplierId": manualNote.supplierId,
      "productId": item.productId,
      quantity: item.quantity,
      "unitPrice": item.unitPrice,
      total: item.quantity * item.unitPrice,
      date: manualNote.date
    }));

    const { error } = await supabase.from('orders').insert(newOrders);

    if (error) {
      notify("Erro ao lançar nota.", "error");
    } else {
      notify("Nota fiscal lançada com sucesso!");
      setManualNote({
        branchId: '',
        supplierId: '',
        date: new Date().toISOString().split('T')[0],
        items: []
      });
      setCurrentView('dashboard');
      fetchAllData();
    }
  };

  // --- Outros Handlers ---

  const quickLookup = async (type: 'branch' | 'supplier') => {
    const form = type === 'branch' ? branchForm : supplierForm;
    const cleanDoc = form.doc.replace(/\D/g, '');
    if (form.docType === 'CNPJ' && cleanDoc.length === 14) {
      setIsSearchingCnpj(true);
      const data = await cnpjService.lookupCnpj(cleanDoc);
      if (data) {
        if (type === 'branch') setBranchForm(prev => ({ ...prev, name: data.name || '', tradeName: data.tradeName || '' }));
        else setSupplierForm(prev => ({ ...prev, name: data.name || '', tradeName: data.tradeName || '' }));
        notify("Dados encontrados!");
      }
      setIsSearchingCnpj(false);
    }
  };

  const processBulkData = async (rawData: any[], targetBranchId: string) => {
    if (!targetBranchId) return notify("Selecione a unidade!", "error");
    if (!rawData || rawData.length === 0) return notify("O arquivo está vazio.", "error");

    setIsImporting(true);

    // Mapeamento Inteligente de Cabeçalhos
    // Identifica quais chaves do objeto correspondem aos campos que precisamos
    const headers = Object.keys(rawData[0]);
    
    // Função auxiliar para encontrar a chave correta com base em sinônimos
    const findHeader = (keywords: string[]) => {
      return headers.find(h => 
        keywords.some(k => normalizeStr(h).includes(normalizeStr(k)))
      );
    };

    // Mapa de colunas detectadas
    const colMap = {
      cnpj: findHeader(['cnpj', 'cpf', 'documento', 'fornecedor', 'emitente']),
      product: findHeader(['produto', 'descricao', 'item', 'discriminacao', 'descri']),
      date: findHeader(['data', 'emissao', 'dt', 'compra']),
      qty: findHeader(['qtd', 'quantidade', 'quant', 'unidades']),
      unit: findHeader(['unid', 'un', 'ud']),
      unitPrice: findHeader(['unitario', 'unit', 'vl. un', 'valor un', 'vlr un']),
      total: findHeader(['total', 'valor total', 'vl. tot', 'vlr tot'])
    };

    // Validação de colunas obrigatórias
    if (!colMap.product) {
      setIsImporting(false);
      return notify("Não foi encontrada uma coluna de 'Produto' ou 'Descrição'.", "error");
    }
    if (!colMap.unitPrice && !colMap.total) {
      setIsImporting(false);
      return notify("Não foi encontrada uma coluna de 'Valor Unitário' ou 'Valor Total'.", "error");
    }
    
    // Precisamos buscar dados atuais para evitar duplicatas nos cadastros auxiliares
    const { data: currentSuppliers } = await supabase.from('suppliers').select('*');
    const { data: currentProducts } = await supabase.from('products').select('*');
    
    const localSuppliers = [...(currentSuppliers || [])];
    const localProducts = [...(currentProducts || [])];
    const newOrders = [];
    let skippedCount = 0;

    for (const row of rawData) {
      const supplierCnpjRaw = colMap.cnpj ? String(row[colMap.cnpj] || '') : '';
      const supplierCnpj = supplierCnpjRaw.replace(/\D/g, '');
      const productName = colMap.product ? String(row[colMap.product] || '').trim() : '';
      
      // Se não tiver nome do produto, pula (linha vazia ou inválida)
      if (!productName) {
        skippedCount++;
        continue;
      }

      // Lógica de Fornecedor
      let supplierId = null;
      if (supplierCnpj) {
        let supplier = localSuppliers.find(s => s.cnpj === supplierCnpj);
        if (!supplier) {
          // Se tiver coluna de Razão Social no CSV, tentamos achar, senão usamos genérico
          const possibleName = row[findHeader(['razao', 'nome', 'fornecedor']) || ''] || 'Fornecedor Novo';
          
          const { data: newSup } = await supabase.from('suppliers').insert({
            cnpj: supplierCnpj, 
            name: String(possibleName),
            "tradeName": ''
          }).select().single();
          
          if (newSup) {
            supplier = newSup;
            localSuppliers.push(newSup);
          }
        }
        if (supplier) supplierId = supplier.id;
      }
      
      // Se não achou CNPJ, tenta usar um fornecedor "DIVERSOS" ou avisa
      if (!supplierId) {
         // Lógica opcional: Se quiser permitir importação sem CNPJ, crie um fornecedor padrão.
         // Por enquanto, vamos pular se não identificar fornecedor ou criar um placeholder se for muito necessário.
         // Vamos criar um fornecedor genérico se não existir
         let genericSup = localSuppliers.find(s => s.name === 'FORNECEDOR DIVERSOS');
         if (!genericSup) {
            const { data: newGen } = await supabase.from('suppliers').insert({
               cnpj: '00000000000000',
               name: 'FORNECEDOR DIVERSOS',
               "tradeName": 'Importação'
            }).select().single();
            genericSup = newGen;
            if (newGen) localSuppliers.push(newGen);
         }
         if (genericSup) supplierId = genericSup.id;
      }

      // Lógica de Produto
      let product = localProducts.find(p => normalizeStr(p.name) === normalizeStr(productName));
      if (!product) {
        const unitVal = colMap.unit ? String(row[colMap.unit] || 'UN') : 'UN';
        const { data: newProd } = await supabase.from('products').insert({
          name: productName, 
          unit: unitVal.substring(0, 10) // Limita tamanho
        }).select().single();
        if (newProd) {
          product = newProd;
          localProducts.push(newProd);
        }
      }

      // Tratamento de Valores e Data
      const rawDate = colMap.date ? (row[colMap.date] || '') : '';
      const date = parseFlexibleDate(rawDate);

      const qty = colMap.qty ? parseBrazilianValue(row[colMap.qty]) : 1;
      let unitPrice = colMap.unitPrice ? parseBrazilianValue(row[colMap.unitPrice]) : 0;
      let total = colMap.total ? parseBrazilianValue(row[colMap.total]) : 0;

      // Cálculo de fallback se faltar um dos valores
      if (total === 0 && unitPrice > 0) total = qty * unitPrice;
      if (unitPrice === 0 && total > 0 && qty > 0) unitPrice = total / qty;

      if (supplierId && product) {
        newOrders.push({ 
          "supplierId": supplierId, 
          "productId": product.id, 
          "branchId": targetBranchId, 
          quantity: qty || 1, 
          "unitPrice": unitPrice, 
          total: total, 
          date 
        });
      }
    }

    if (newOrders.length > 0) {
      const { error } = await supabase.from('orders').insert(newOrders);
      if (error) {
        console.error(error);
        notify("Erro ao salvar dados no banco.", "error");
      } else {
        notify(`Importação concluída! ${newOrders.length} registros salvos. ${skippedCount > 0 ? `(${skippedCount} linhas ignoradas)` : ''}`);
        fetchAllData();
        setCurrentView('dashboard');
      }
    } else {
      notify("Nenhum dado válido encontrado para importar. Verifique as colunas.", "info");
    }

    setIsImporting(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // Se o usuário cancelou a seleção
    if (!file) return;

    // Reset imediato do valor do input para permitir selecionar o mesmo arquivo novamente
    // caso ocorra um erro ou o usuário queira repetir a ação.
    if (fileInputRef.current) {
        // Guardamos a referência mas não limpamos AGORA se formos usar o evento 'e', 
        // mas aqui estamos usando o objeto 'file' já extraído.
        // É seguro limpar aqui para garantir que o onChange dispare no futuro.
        e.target.value = ''; 
    }

    // Validação antecipada da unidade
    if (!importTargetBranchId) {
      notify("Selecione a unidade antes de escolher o arquivo.", "error");
      return;
    }

    setIsImporting(true);

    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        Papa.parse(file, { 
          header: true, 
          skipEmptyLines: true,
          encoding: "ISO-8859-1", // Ajuda com acentos em arquivos Excel CSV brasileiros
          complete: async (res) => {
            await processBulkData(res.data, importTargetBranchId);
          },
          error: (err) => {
             console.error(err);
             notify("Erro ao ler arquivo CSV. Verifique a formatação.", "error");
             setIsImporting(false);
          }
        });
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
           notify("Arquivo Excel vazio ou inválido.", "error");
           setIsImporting(false);
        } else {
           const firstSheetName = workbook.SheetNames[0];
           const worksheet = workbook.Sheets[firstSheetName];
           // defval: '' garante que células vazias venham como string vazia, evitando undefined
           const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
           await processBulkData(jsonData, importTargetBranchId);
        }
      }
    } catch (error) {
      console.error(error);
      notify("Erro crítico ao processar arquivo.", "error");
      setIsImporting(false);
    }
  };

  const filteredOrders = useMemo(() => dashboardBranchFilter === 'all' ? state.orders : state.orders.filter(o => o.branchId === dashboardBranchFilter), [state.orders, dashboardBranchFilter]);
  
  const stats = useMemo(() => ({
    total: filteredOrders.reduce((a, b) => a + Number(b.total), 0),
    count: filteredOrders.length,
    suppliers: new Set(filteredOrders.map(o => o.supplierId)).size,
    branches: new Set(filteredOrders.map(o => o.branchId)).size
  }), [filteredOrders]);

  const dashboardChartsData = useMemo(() => {
    const supplierCounts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const s = state.suppliers.find(sup => sup.id === o.supplierId);
      const name = s ? s.name : 'Desconhecido';
      supplierCounts[name] = (supplierCounts[name] || 0) + 1;
    });
    const pieData = Object.entries(supplierCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const productMinPrices: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const p = state.products.find(prod => prod.id === o.productId);
      if (p) {
        if (!productMinPrices[p.name] || o.unitPrice < productMinPrices[p.name]) {
          productMinPrices[p.name] = o.unitPrice;
        }
      }
    });
    const barData = Object.entries(productMinPrices)
      .map(([name, price]) => ({ name, price }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    return { pieData, barData };
  }, [filteredOrders, state.suppliers, state.products]);

  const branchOptions = useMemo(() => state.branches.map(b => ({ value: b.id, label: b.name, sublabel: formatDocument(b.cnpj) })), [state.branches]);
  const supplierOptions = useMemo(() => state.suppliers.map(s => ({ value: s.id, label: s.name, sublabel: formatDocument(s.cnpj) })), [state.suppliers]);
  const productOptions = useMemo(() => state.products.map(p => ({ value: p.id, label: p.name, sublabel: p.unit })), [state.products]);

  const productData = useMemo(() => {
    if (!selectedProductId) return null;
    const product = state.products.find(p => p.id === selectedProductId);
    const history = state.orders
      .filter(o => o.productId === selectedProductId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(o => ({
        date: new Date(o.date).toLocaleDateString('pt-BR'),
        price: o.unitPrice,
        supplier: state.suppliers.find(s => s.id === o.supplierId)?.name || 'Desconhecido'
      }));
    const bestOrder = [...state.orders].filter(o => o.productId === selectedProductId).sort((a, b) => a.unitPrice - b.unitPrice)[0];
    const bestSupplier = bestOrder ? state.suppliers.find(s => s.id === bestOrder.supplierId) : null;
    return { product, history, bestSupplier, bestPrice: bestOrder?.unitPrice };
  }, [selectedProductId, state.orders, state.suppliers, state.products]);

  const filteredProductsList = useMemo(() => {
    if (!productSearch) return state.products;
    const s = normalizeStr(productSearch);
    return state.products.filter(p => normalizeStr(p.name).includes(s));
  }, [state.products, productSearch]);

  const manualNoteTotal = useMemo(() => manualNote.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0), [manualNote.items]);

  if (!isAuthenticated) return <LoginScreen onLoginSuccess={() => (setIsAuthenticated(true), localStorage.setItem('cotify_auth', 'true'))} />;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
      {notification && <Toast {...notification} onClose={() => setNotification(null)} />}
      
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-100 flex flex-col shadow-2xl transition-transform lg:relative lg:translate-x-0 z-50 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-slate-50 flex items-center space-x-3">
          <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fas fa-layer-group text-lg"></i></div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">Cotify ERP</h1>
        </div>
        <nav className="p-6 space-y-2 flex-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
            { id: 'nfe-import', label: 'Importar Planilha', icon: 'fa-file-import' },
            { id: 'nfe-manual', label: 'Lançar Nota', icon: 'fa-file-signature' },
            { id: 'branches', label: 'Minhas Unidades', icon: 'fa-building' },
            { id: 'suppliers', label: 'Fornecedores', icon: 'fa-handshake' },
            { id: 'products', label: 'Catálogo Produtos', icon: 'fa-boxes-stacked' },
          ].map(item => (
            <button key={item.id} onClick={() => { setCurrentView(item.id as View); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-4 px-6 py-4 rounded-full transition-all ${currentView === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
              <i className={`fas ${item.icon} w-5`}></i><span className="font-semibold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-50">
           <button onClick={() => { setIsAuthenticated(false); localStorage.removeItem('cotify_auth'); }} className="w-full flex items-center space-x-4 px-6 py-4 rounded-full text-slate-400 hover:text-rose-500 transition-colors">
              <i className="fas fa-power-off w-5"></i><span className="font-semibold text-sm">Sair</span>
           </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600"><i className="fas fa-bars"></i></button>
            <span className="text-slate-900 font-black text-xl capitalize tracking-tight">{currentView.replace('-', ' ')}</span>
            {state.isLoading && <span className="text-xs font-bold text-indigo-500 uppercase animate-pulse ml-4">Sincronizando...</span>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-10 bg-slate-50/50">
          {currentView === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-10">
              <div className="w-full max-w-xs">
                <SearchableSelect label="Filtrar por Unidade" value={dashboardBranchFilter} onChange={setDashboardBranchFilter} options={[{value: 'all', label: 'Todas as Unidades'}, ...branchOptions]} variant="small" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Gasto Total', val: formatCompactCurrency(stats.total), icon: 'fa-coins', color: 'bg-indigo-50 text-indigo-600', large: true },
                  { label: 'Notas Lançadas', val: stats.count, icon: 'fa-receipt', color: 'bg-blue-50 text-blue-600' },
                  { label: 'Fornecedores', val: stats.suppliers, icon: 'fa-handshake', color: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Unidades', val: stats.branches, icon: 'fa-building', color: 'bg-orange-50 text-orange-600' }
                ].map((s, i) => (
                  <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center space-x-4 min-w-0 overflow-hidden">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${s.color}`}><i className={`fas ${s.icon} text-lg`}></i></div>
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{s.label}</p>
                      <p className={`font-black text-slate-800 break-words leading-tight ${s.large ? 'text-xl' : 'text-2xl'}`}>{s.val}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center">
                    <i className="fas fa-chart-pie text-indigo-600 mr-3"></i> Pedidos por Fornecedor
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dashboardChartsData.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {dashboardChartsData.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center">
                    <i className="fas fa-tags text-indigo-600 mr-3"></i> Produtos mais Baratos (Unitário)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardChartsData.barData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 9, fontWeight: 'bold', fill: '#64748b'}} />
                        <Tooltip formatter={(value: number) => formatCompactCurrency(value)} contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}} />
                        <Bar dataKey="price" fill="#4f46e5" radius={[0, 10, 10, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50 font-black text-slate-800 flex justify-between items-center bg-white">
                  <span>Movimentações Recentes (Supabase)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <tr><th className="px-8 py-5">Data</th><th className="px-8 py-5">Unidade</th><th className="px-8 py-5">Fornecedor</th><th className="px-8 py-5 text-right">Valor</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredOrders.length === 0 ? <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium italic">Sem dados.</td></tr> : 
                        filteredOrders.slice(0, 50).map(o => (
                          <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(o.date).toLocaleDateString('pt-BR')}</td>
                            <td className="px-8 py-5 font-black text-slate-800 text-xs truncate max-w-[150px]">{state.branches.find(b => b.id === o.branchId)?.name || 'N/A'}</td>
                            <td className="px-8 py-5 font-semibold text-slate-600 text-xs truncate max-w-[150px]">{state.suppliers.find(s => s.id === o.supplierId)?.name || 'N/A'}</td>
                            <td className="px-8 py-5 text-right font-black text-indigo-600 text-xs">{formatCompactCurrency(Number(o.total))}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentView === 'nfe-manual' && (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <SectionTitle icon="fa-file-signature">Lançamento de Nota Fiscal</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <SearchableSelect label="Minha Unidade" value={manualNote.branchId} onChange={(val) => setManualNote(p => ({ ...p, branchId: val }))} options={branchOptions} />
                  <SearchableSelect label="Fornecedor" value={manualNote.supplierId} onChange={(val) => setManualNote(p => ({ ...p, supplierId: val }))} options={supplierOptions} />
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 tracking-widest">Data de Lançamento</label>
                    <input type="date" value={manualNote.date} onChange={(e) => setManualNote(p => ({ ...p, date: e.target.value }))} className="px-8 py-4 w-full rounded-full border border-slate-200 bg-white shadow-sm outline-none focus:border-indigo-500 font-semibold text-sm text-slate-700" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 mb-8 flex items-center">
                  <i className="fas fa-plus-circle text-indigo-600 mr-3"></i> Adicionar Produtos à Nota
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  <div className="md:col-span-2">
                    <SearchableSelect label="Escolher Produto do Catálogo" value={manualItemForm.productId} onChange={(val) => setManualItemForm(p => ({ ...p, productId: val }))} options={productOptions} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 tracking-widest">Quantidade</label>
                    <input type="number" value={manualItemForm.quantity} onChange={(e) => setManualItemForm(p => ({ ...p, quantity: Number(e.target.value) }))} className="px-8 py-4 w-full rounded-full border border-slate-200 bg-white shadow-sm outline-none focus:border-indigo-500 font-semibold text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 tracking-widest">Preço Unitário</label>
                    <input type="number" step="0.01" value={manualItemForm.unitPrice} onChange={(e) => setManualItemForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} className="px-8 py-4 w-full rounded-full border border-slate-200 bg-white shadow-sm outline-none focus:border-indigo-500 font-semibold text-sm" placeholder="R$ 0,00" />
                  </div>
                </div>
                <button onClick={addManualItem} className="mt-8 bg-indigo-50 text-indigo-600 px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all w-full md:w-auto">
                  <i className="fas fa-plus mr-2"></i> Adicionar Item à Nota
                </button>

                {manualNote.items.length > 0 && (
                  <div className="mt-12 overflow-x-auto rounded-[2rem] border border-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        <tr><th className="px-8 py-4">Produto</th><th className="px-8 py-4">Qtd</th><th className="px-8 py-4">Unitário</th><th className="px-8 py-4">Total</th><th className="px-8 py-4 text-center">Ação</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {manualNote.items.map((item, idx) => {
                          const p = state.products.find(prod => prod.id === item.productId);
                          return (
                            <tr key={idx} className="text-sm">
                              <td className="px-8 py-4 font-bold text-slate-800">{p?.name}</td>
                              <td className="px-8 py-4 font-semibold text-slate-500">{item.quantity} {p?.unit}</td>
                              <td className="px-8 py-4 font-semibold text-slate-500">{formatCompactCurrency(item.unitPrice)}</td>
                              <td className="px-8 py-4 font-black text-indigo-600">{formatCompactCurrency(item.quantity * item.unitPrice)}</td>
                              <td className="px-8 py-4 text-center">
                                <button onClick={() => removeManualItem(idx)} className="text-rose-400 hover:text-rose-600"><i className="fas fa-trash"></i></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-indigo-600 text-white font-black">
                        <tr>
                          <td colSpan={3} className="px-8 py-5 text-right uppercase tracking-widest text-xs opacity-80">Total da Nota:</td>
                          <td className="px-8 py-5 text-lg">{formatCompactCurrency(manualNoteTotal)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {manualNote.items.length > 0 && (
                <div className="flex justify-end">
                  <button onClick={saveManualNote} className="bg-emerald-500 text-white px-12 py-5 rounded-full font-black text-sm uppercase tracking-widest shadow-xl hover:bg-emerald-400 transition-all flex items-center">
                    <i className="fas fa-check-circle text-xl mr-3"></i> Finalizar e Lançar Nota
                  </button>
                </div>
              )}
            </div>
          )}

          {currentView === 'branches' && (
            <div className="max-w-6xl mx-auto space-y-12">
              <div className="flex justify-between items-center">
                <SectionTitle icon="fa-building">Minhas Unidades</SectionTitle>
                <button onClick={handleOpenAddBranch} className="bg-indigo-600 text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-500 transition-all">
                   <i className="fas fa-plus mr-2"></i> Adicionar Unidade
                </button>
              </div>
              {showAddBranch && (
                <div className="bg-white p-10 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="font-black text-xl">{editingBranchId ? 'Editar Unidade' : 'Novo Cadastro Manual'}</h3>
                    <div className="flex bg-slate-100 p-1.5 rounded-full">
                       <button onClick={() => setBranchForm(p => ({ ...p, docType: 'CNPJ' }))} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${branchForm.docType === 'CNPJ' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>CNPJ</button>
                       <button onClick={() => setBranchForm(p => ({ ...p, docType: 'CPF' }))} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${branchForm.docType === 'CPF' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>CPF</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">{branchForm.docType === 'CNPJ' ? 'CNPJ da Empresa' : 'CPF do Responsável'}</label>
                       <div className="relative">
                        <input type="text" value={branchForm.doc} onChange={e => setBranchForm(p => ({ ...p, doc: e.target.value }))} onBlur={() => quickLookup('branch')} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" placeholder={branchForm.docType === 'CNPJ' ? "00.000.000/0000-00" : "000.000.000-00"} />
                        {isSearchingCnpj && <div className="absolute right-6 top-1/2 -translate-y-1/2"><i className="fas fa-spinner fa-spin text-indigo-600"></i></div>}
                       </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">Razão Social / Nome Completo</label>
                      <input type="text" value={branchForm.name} onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">Nome Fantasia (Opcional)</label>
                      <input type="text" value={branchForm.tradeName} onChange={e => setBranchForm(p => ({ ...p, tradeName: e.target.value }))} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" />
                    </div>
                  </div>
                  <div className="flex space-x-4 mt-10">
                    <button onClick={handleSaveBranch} className="flex-1 bg-indigo-600 text-white h-[60px] rounded-full font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95">Salvar Unidade</button>
                    <button onClick={() => setShowAddBranch(false)} className="bg-slate-100 text-slate-500 h-[60px] px-8 rounded-full font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {state.branches.map(b => (
                  <div key={b.id} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-lg transition-all relative">
                    <div className="flex justify-between items-start mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600"><i className={`fas ${b.cnpj.length === 11 ? 'fa-user-tie' : 'fa-building-circle-check'} text-2xl`}></i></div>
                      <div className="flex space-x-2">
                         <button onClick={() => handleOpenEditBranch(b)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center"><i className="fas fa-pencil text-[10px]"></i></button>
                         <button onClick={() => handleDeleteBranch(b.id)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center"><i className="fas fa-trash text-[10px]"></i></button>
                      </div>
                    </div>
                    <h4 className="font-black text-slate-800 text-lg mb-2 truncate">{b.name}</h4>
                    <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">{formatDocument(b.cnpj)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === 'suppliers' && (
            <div className="max-w-6xl mx-auto space-y-12">
              <div className="flex justify-between items-center">
                <SectionTitle icon="fa-handshake">Fornecedores</SectionTitle>
                <button onClick={handleOpenAddSupplier} className="bg-indigo-600 text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-500 transition-all">
                   <i className="fas fa-plus mr-2"></i> Adicionar Fornecedor
                </button>
              </div>
              {showAddSupplier && (
                <div className="bg-white p-10 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="font-black text-xl">{editingSupplierId ? 'Editar Fornecedor' : 'Novo Fornecedor Manual'}</h3>
                    <div className="flex bg-slate-100 p-1.5 rounded-full">
                       <button onClick={() => setSupplierForm(p => ({ ...p, docType: 'CNPJ' }))} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${supplierForm.docType === 'CNPJ' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>CNPJ</button>
                       <button onClick={() => setSupplierForm(p => ({ ...p, docType: 'CPF' }))} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${supplierForm.docType === 'CPF' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>CPF</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">Documento</label>
                       <div className="relative">
                        <input type="text" value={supplierForm.doc} onChange={e => setSupplierForm(p => ({ ...p, doc: e.target.value }))} onBlur={() => quickLookup('supplier')} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" placeholder={supplierForm.docType === 'CNPJ' ? "00.000.000/0000-00" : "000.000.000-00"} />
                        {isSearchingCnpj && <div className="absolute right-6 top-1/2 -translate-y-1/2"><i className="fas fa-spinner fa-spin text-indigo-600"></i></div>}
                       </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">Razão Social</label>
                      <input type="text" value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">Nome Fantasia (Opcional)</label>
                      <input type="text" value={supplierForm.tradeName} onChange={e => setSupplierForm(p => ({ ...p, tradeName: e.target.value }))} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" />
                    </div>
                  </div>
                  <div className="flex space-x-4 mt-10">
                    <button onClick={handleSaveSupplier} className="flex-1 bg-indigo-600 text-white h-[60px] rounded-full font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95">Salvar Fornecedor</button>
                    <button onClick={() => setShowAddSupplier(false)} className="bg-slate-100 text-slate-500 h-[60px] px-8 rounded-full font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {state.suppliers.map(s => (
                  <div key={s.id} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative group">
                    <div className="flex justify-between items-start mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400"><i className="fas fa-truck-fast text-2xl"></i></div>
                      <div className="flex space-x-2">
                         <button onClick={() => handleOpenEditSupplier(s)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center"><i className="fas fa-pencil text-[10px]"></i></button>
                         <button onClick={() => handleDeleteSupplier(s.id)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center"><i className="fas fa-trash text-[10px]"></i></button>
                      </div>
                    </div>
                    <h4 className="font-black text-slate-800 text-lg mb-2 truncate">{s.name}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{formatDocument(s.cnpj)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === 'products' && (
            <div className="max-w-6xl mx-auto space-y-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <SectionTitle icon="fa-boxes-stacked">Catálogo de Produtos</SectionTitle>
                <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-2xl justify-end">
                  <div className="relative flex-1">
                    <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                    <input type="text" placeholder="Pesquisar produto pelo nome..." className="w-full pl-14 pr-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-semibold text-sm shadow-sm" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                  </div>
                  <button onClick={() => setShowAddProduct(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-500 transition-all shrink-0">
                     <i className="fas fa-plus mr-2"></i> Adicionar Produto
                  </button>
                </div>
              </div>
              {showAddProduct && (
                <div className="bg-white p-10 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl animate-in zoom-in-95 duration-200">
                  <h3 className="font-black text-xl mb-10">Novo Produto Manual</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">Nome do Produto</label>
                      <input type="text" value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" placeholder="Ex: Cimento CP-II 50kg" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-6 tracking-widest">Unidade de Medida</label>
                      <input type="text" value={productForm.unit} onChange={e => setProductForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-8 py-4 rounded-full border border-slate-200 focus:border-indigo-500 outline-none font-bold" placeholder="Ex: UN, KG, SC, LT" />
                    </div>
                  </div>
                  <div className="flex space-x-4 mt-10">
                    <button onClick={handleSaveProduct} className="flex-1 bg-indigo-600 text-white h-[60px] rounded-full font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all shadow-lg">Salvar Produto</button>
                    <button onClick={() => setShowAddProduct(false)} className="bg-slate-100 text-slate-500 h-[60px] px-8 rounded-full font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProductsList.length === 0 ? <div className="col-span-full py-20 text-center text-slate-400 font-bold border-4 border-dashed border-slate-100 rounded-[3rem]">{productSearch ? "Nenhum produto encontrado." : "Nenhum produto cadastrado."}</div> : filteredProductsList.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProductId(p.id); setCurrentView('product-details'); }} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-left hover:border-indigo-300 transition-all group">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 font-black text-[10px] group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase">{p.unit}</div>
                    <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{p.name}</h4>
                    <p className="text-[10px] font-black text-slate-300 uppercase mt-4 group-hover:text-indigo-500">Ver Histórico <i className="fas fa-chevron-right ml-1"></i></p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentView === 'product-details' && productData && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center space-x-4 mb-8">
                <button onClick={() => setCurrentView('products')} className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><i className="fas fa-arrow-left"></i></button>
                <h2 className="text-2xl font-black text-slate-800">Detalhes do Produto</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-lg text-slate-800 mb-8">Evolução de Preço Unitário</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={productData.history}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} tickFormatter={(v) => `R$${v}`} />
                          <Tooltip contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem'}} itemStyle={{fontWeight: 'bold', fontSize: '12px'}} labelStyle={{fontSize: '10px', color: '#94a3b8', marginBottom: '4px'}} />
                          <Area type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 font-black text-slate-800">Histórico de Compras</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                          <tr><th className="px-8 py-4">Data</th><th className="px-8 py-4">Fornecedor</th><th className="px-8 py-4 text-right">Preço Un.</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {productData.history.slice().reverse().map((h, i) => (
                            <tr key={i} className="text-xs hover:bg-slate-50/50">
                              <td className="px-8 py-4 text-slate-500 font-bold">{h.date}</td>
                              <td className="px-8 py-4 text-slate-800 font-black">{h.supplier}</td>
                              <td className="px-8 py-4 text-right text-indigo-600 font-black">R$ {h.price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="bg-indigo-600 p-10 rounded-[3rem] shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10 text-8xl"><i className="fas fa-award"></i></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Recomendação de Compra</p>
                    <h3 className="text-xl font-black mb-10 leading-tight">Melhor Fornecedor</h3>
                    {productData.bestSupplier ? (
                      <div>
                        <p className="text-3xl font-black mb-2">{productData.bestSupplier.name}</p>
                        <p className="text-sm font-bold opacity-80 mb-8">{formatDocument(productData.bestSupplier.cnpj)}</p>
                        <div className="bg-white/20 p-6 rounded-2xl backdrop-blur-sm">
                          <p className="text-[10px] font-black uppercase opacity-60 mb-1">Menor Preço Registrado</p>
                          <p className="text-2xl font-black">{formatCompactCurrency(productData.bestPrice || 0)}</p>
                        </div>
                      </div>
                    ) : <p className="italic opacity-60">Sem dados suficientes.</p>}
                  </div>
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Informações do Produto</p>
                    <p className="text-lg font-black text-slate-800 mb-6">{productData.product?.name}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Unidade</p><p className="font-black text-slate-700">{productData.product?.unit}</p></div>
                      <div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Lançamentos</p><p className="font-black text-slate-700">{productData.history.length}</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'nfe-import' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white p-12 sm:p-20 rounded-[4rem] shadow-xl border border-slate-100 text-center">
                <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 text-4xl mx-auto mb-10"><i className="fas fa-file-invoice"></i></div>
                <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tighter">Importar Planilha</h2>
                <p className="text-slate-400 font-medium text-lg mb-14">Os lançamentos respeitarão as datas contidas no arquivo.</p>
                <div className="max-w-md mx-auto space-y-10 text-left">
                  <SearchableSelect label="1. Empresa Tomadora" value={importTargetBranchId} onChange={setImportTargetBranchId} options={branchOptions} />
                  <div className={`p-10 rounded-[3rem] border-2 border-dashed flex flex-col items-center ${importTargetBranchId ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                    <i className="fas fa-cloud-upload-alt text-4xl text-indigo-400 mb-6"></i>
                    <input type="file" ref={fileInputRef} className="hidden" id="file" onChange={handleFileUpload} disabled={!importTargetBranchId || isImporting} />
                    <label htmlFor="file" className={`px-10 py-5 bg-indigo-600 text-white rounded-full font-black text-xs uppercase cursor-pointer ${!importTargetBranchId ? 'pointer-events-none' : 'hover:bg-indigo-500'}`}>
                      {isImporting ? 'Processando...' : 'Selecionar Arquivo'}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
