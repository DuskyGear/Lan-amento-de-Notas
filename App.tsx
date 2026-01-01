
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Order, Supplier, Product, AppState } from './types';
import { geminiService } from './services/geminiService';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Helper Functions ---

const isValidCNPJ = (cnpj: string) => {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj === '' || cnpj.length !== 14) return false;

  // Elimina CNPJs conhecidos inválidos
  if (/^(\d)\1+$/.test(cnpj)) return false;

  // Valida DVs
  let size = cnpj.length - 2;
  let numbers = cnpj.substring(0, size);
  let digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
};

const convertBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = () => {
      resolve(fileReader.result as string);
    };
    fileReader.onerror = (error) => {
      reject(error);
    };
  });
};

const formatAccessKey = (value: string) => {
  return value.replace(/\D/g, '')
    .replace(/(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5 $6 $7 $8 $9 $10 $11')
    .slice(0, 54); // 44 chars + spaces
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

const UnitSelector = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const units = [
    { id: 'UN', label: 'Unidade', icon: 'fa-box' },
    { id: 'KG', label: 'Quilo', icon: 'fa-weight-hanging' },
    { id: 'LT', label: 'Litro', icon: 'fa-droplet' },
    { id: 'MT', label: 'Metro', icon: 'fa-ruler-horizontal' },
    { id: 'PC', label: 'Peça', icon: 'fa-puzzle-piece' },
  ];

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {units.map((unit) => (
        <button
          key={unit.id}
          type="button"
          onClick={() => onChange(unit.id)}
          className={`flex items-center space-x-3 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 ${
            value === unit.id 
            ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105' 
            : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-200 hover:bg-slate-50'
          }`}
        >
          <i className={`fas ${unit.icon} text-[10px] sm:text-xs ${value === unit.id ? 'text-indigo-100' : 'text-slate-300'}`}></i>
          <span className="font-bold text-[10px] sm:text-xs uppercase tracking-widest">{unit.label}</span>
        </button>
      ))}
    </div>
  );
};

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
  icon = "fa-search"
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void, 
  options: SearchableOption[],
  placeholder?: string,
  icon?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(s) || 
      (opt.sublabel && opt.sublabel.toLowerCase().includes(s))
    );
  }, [search, options]);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative group" ref={containerRef}>
      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 tracking-widest">
        {label}
      </label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-8 pr-12 py-4 rounded-full border border-slate-200 bg-white shadow-sm cursor-pointer flex items-center justify-between group-focus-within:ring-4 group-focus-within:ring-indigo-100/50 group-focus-within:border-indigo-500 transition-all"
      >
        <span className={`font-semibold truncate ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <i className={`fas ${icon} text-slate-300 group-hover:text-indigo-500 transition-colors text-xs ml-2`}></i>
      </div>

      {isOpen && (
        <div className="absolute z-[60] w-full mt-2 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50">
            <input 
              autoFocus
              className="w-full px-6 py-3 rounded-full border border-slate-200 bg-white outline-none focus:border-indigo-500 text-sm font-semibold text-slate-700"
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
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-8 py-4 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${value === opt.value ? 'bg-indigo-50/50' : ''}`}
                >
                  <p className="font-bold text-slate-700 text-sm">{opt.label}</p>
                  {opt.sublabel && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{opt.sublabel}</p>}
                </div>
              ))
            ) : (
              <div className="px-8 py-10 text-center text-slate-400 italic text-sm">Nenhum resultado encontrado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Notification Component ---
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-indigo-600'
  };

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:bottom-8 sm:right-8 sm:left-auto ${bgColors[type]} text-white px-8 py-5 rounded-2xl sm:rounded-[2rem] shadow-2xl z-[100] flex items-center justify-between space-x-4 animate-in slide-in-from-bottom-10 duration-500`}>
      <div className="flex items-center space-x-4">
        <i className={`fas ${icons[type]} text-xl`}></i>
        <span className="font-bold text-sm tracking-tight">{message}</span>
      </div>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

// --- Login Component ---

const LoginScreen = ({ onLogin }: { onLogin: (u: string, p: string) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-8 sm:p-12 text-center">
          <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-6 shadow-lg shadow-black/20">
            <i className="fas fa-layer-group text-2xl"></i>
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">OrderFlow</h1>
          <p className="text-indigo-200 font-bold text-xs uppercase tracking-widest mb-10">Enterprise Access</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-left group">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-4 mb-2 block group-focus-within:text-white transition-colors">Usuário</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-6 py-4 rounded-full bg-black/20 border border-white/10 text-white font-bold placeholder-white/20 outline-none focus:bg-black/30 focus:border-indigo-400 transition-all pl-12"
                  placeholder="Digite seu usuário"
                />
                <i className="fas fa-user absolute left-5 top-1/2 -translate-y-1/2 text-white/30"></i>
              </div>
            </div>

            <div className="text-left group">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-4 mb-2 block group-focus-within:text-white transition-colors">Senha</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-6 py-4 rounded-full bg-black/20 border border-white/10 text-white font-bold placeholder-white/20 outline-none focus:bg-black/30 focus:border-indigo-400 transition-all pl-12"
                  placeholder="••••••••"
                />
                <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-white/30"></i>
              </div>
            </div>

            <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-5 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-900/50 transition-all active:scale-95 mt-4">
              Entrar
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-white/40 text-[10px] font-bold">© 2024 OrderFlow Systems</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

type View = 'dashboard' | 'suppliers' | 'products' | 'invoices' | 'nfe-import';

interface UserProfile {
  name: string;
  email: string;
  photo: string | null;
}

interface DraftItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [notification, setNotification] = useState<NotificationState | null>(null);
  
  // Menu and Sidebar States
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Administrador do Sistema',
    email: 'admin@orderflow.erp',
    photo: null
  });

  const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);

  // Forms
  const [supplierForm, setSupplierForm] = useState({
    name: '', tradeName: '', cnpj: '', address: '', city: '', state: ''
  });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    name: '', unit: 'UN', ncm: ''
  });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Invoices
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('pt-BR'));
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  
  // NFe Import State
  const [accessKey, setAccessKey] = useState('');
  const [isImportingNfe, setIsImportingNfe] = useState(false);

  // Manual Item Adder
  const [manualItem, setManualItem] = useState({
    productId: '',
    quantity: 1,
    unitPrice: 0
  });

  // Dashboard Analysis State
  const [analysisProductId, setAnalysisProductId] = useState('');
  const [analysisStartDate, setAnalysisStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [analysisEndDate, setAnalysisEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [state, setState] = useState<AppState>({
    orders: [],
    suppliers: [],
    products: [],
    isLoading: false,
    error: null,
  });

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
  };

  // Check auth on load
  useEffect(() => {
    const auth = localStorage.getItem('orderflow_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Real-time CNPJ Validation Logic
  const cnpjValidation = useMemo(() => {
    const clean = supplierForm.cnpj.replace(/\D/g, '');
    if (clean.length === 0) return { status: 'idle', message: 'Digite 14 números' };
    if (clean.length < 14) return { status: 'typing', message: `Faltam ${14 - clean.length} dígitos` };
    if (isValidCNPJ(clean)) return { status: 'valid', message: 'CNPJ Válido' };
    return { status: 'invalid', message: 'CNPJ Inválido (Checksum)' };
  }, [supplierForm.cnpj]);

  useEffect(() => {
    const saved = localStorage.getItem('orderflow_v18');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.userProfile) setUserProfile(parsed.userProfile);
      setState(prev => ({ ...prev, ...parsed }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('orderflow_v18', JSON.stringify({
      orders: state.orders,
      suppliers: state.suppliers,
      products: state.products,
      userProfile: userProfile
    }));
  }, [state.orders, state.suppliers, state.products, userProfile]);

  // Click Outside logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSidebarOpen]);

  // Auth Handlers
  const handleLogin = (u: string, p: string) => {
    if (u === 'user' && p === '123') {
      setIsAuthenticated(true);
      localStorage.setItem('orderflow_auth', 'true');
      notify(`Bem-vindo de volta, ${userProfile.name.split(' ')[0]}!`);
    } else {
      notify("Credenciais inválidas. Tente novamente.", "error");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('orderflow_auth');
    setIsProfileMenuOpen(false);
    notify("Sessão encerrada!", "info");
  };

  // Profile Edit Handlers
  const openEditProfile = () => {
    setTempProfile({ ...userProfile });
    setIsEditProfileOpen(true);
    setIsProfileMenuOpen(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        notify("A imagem deve ter no máximo 2MB", "error");
        return;
      }
      try {
        const base64 = await convertBase64(file);
        setTempProfile({ ...tempProfile, photo: base64 });
      } catch (err) {
        notify("Erro ao processar imagem", "error");
      }
    }
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUserProfile(tempProfile);
    setIsEditProfileOpen(false);
    notify("Perfil atualizado com sucesso!");
  };

  const handleSearchCnpj = async () => {
    if (cnpjValidation.status !== 'valid') return;
    
    setIsSearchingCnpj(true);
    try {
      const data = await geminiService.lookupCnpj(supplierForm.cnpj);
      setSupplierForm(prev => ({
        ...prev,
        cnpj: data.cnpj || prev.cnpj,
        name: data.name || '',
        tradeName: data.tradeName || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || ''
      }));
      notify("Dados do fornecedor importados!", "success");
    } catch (err: any) {
      notify(err.message || "Erro ao consultar CNPJ.", "error");
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  // --- NFe Import Handler ---
  const handleImportNfe = async () => {
    const rawKey = accessKey.replace(/\D/g, '');
    
    if (rawKey.length !== 44) {
      notify("A chave deve ter 44 dígitos.", "error");
      return;
    }

    setIsImportingNfe(true);

    try {
      // 1. Extract Info from Access Key
      const uf = rawKey.substring(0, 2);
      const yymm = rawKey.substring(2, 6);
      const cnpj = rawKey.substring(6, 20);
      
      // 2. Check if Supplier Exists or Fetch Data
      let supplierId = state.suppliers.find(s => s.cnpj === cnpj)?.id;
      let supplierName = "";

      if (!supplierId) {
        // Fetch from API
        try {
          const supData = await geminiService.lookupCnpj(cnpj);
          const newSupplier: Supplier = {
            id: crypto.randomUUID(),
            name: supData.name || 'Fornecedor Desconhecido',
            tradeName: supData.tradeName || '',
            cnpj: cnpj,
            address: supData.address || '',
            city: supData.city || '',
            state: supData.state || ''
          };
          
          setState(prev => ({
            ...prev,
            suppliers: [newSupplier, ...prev.suppliers]
          }));
          
          supplierId = newSupplier.id;
          supplierName = newSupplier.name;
          notify(`Fornecedor ${newSupplier.name} cadastrado automaticamente!`, "success");
        } catch (e) {
          throw new Error("Não foi possível identificar a empresa da chave de acesso.");
        }
      } else {
        supplierName = state.suppliers.find(s => s.id === supplierId)?.name || "";
      }

      // 3. Simulate Products Extraction using Gemini
      // Since we can't actually scrape SEFAZ without a cert, we use AI to predict likely products
      // for this supplier to demonstrate the feature.
      const simulatedData = await geminiService.simulateInvoiceProducts(supplierName, "Comércio Geral");
      
      const newProducts: Product[] = [];
      const newDraftItems: DraftItem[] = [];

      simulatedData.products.forEach((prod, index) => {
        // Check if product exists (simple name check for demo)
        let existingProd = state.products.find(p => p.name.toLowerCase() === prod.name?.toLowerCase());
        
        let prodId = '';
        if (existingProd) {
            prodId = existingProd.id;
        } else {
            const newProd = {
                id: crypto.randomUUID(),
                name: prod.name || 'Produto sem nome',
                unit: prod.unit || 'UN',
                ncm: ''
            };
            newProducts.push(newProd);
            prodId = newProd.id;
        }

        newDraftItems.push({
            id: crypto.randomUUID(),
            productId: prodId,
            quantity: simulatedData.quantities[index],
            unitPrice: simulatedData.prices[index],
            total: simulatedData.quantities[index] * simulatedData.prices[index]
        });
      });

      // Update State
      setState(prev => ({
        ...prev,
        products: [...newProducts, ...prev.products]
      }));

      // Set Invoice Data
      setSelectedSupplierId(supplierId);
      setDraftItems(newDraftItems);
      
      // Format Date from YYMM to Today (since key doesn't have day)
      setInvoiceDate(new Date().toLocaleDateString('pt-BR'));

      notify(`${newDraftItems.length} produtos importados com sucesso!`);
      setCurrentView('invoices'); // Redirect to finish invoice
      setAccessKey('');

    } catch (err: any) {
      notify(err.message || "Erro ao importar NFe.", "error");
    } finally {
      setIsImportingNfe(false);
    }
  };

  const handleExportData = () => {
    if (state.orders.length === 0) {
        notify("Não há dados para exportar.", "info");
        return;
    }

    // Headers
    const headers = ["ID", "Data", "Fornecedor", "CNPJ", "Produto", "Unidade", "Quantidade", "Preço Unitário", "Total"];
    
    // Rows
    const rows = state.orders.map(order => {
        const supplier = state.suppliers.find(s => s.id === order.supplierId);
        const product = state.products.find(p => p.id === order.productId);
        return [
            order.id,
            new Date(order.date).toLocaleDateString('pt-BR'),
            supplier?.name || 'N/A',
            supplier?.cnpj || 'N/A',
            product?.name || 'N/A',
            product?.unit || 'N/A',
            order.quantity.toString().replace('.', ','), // Excel PT-BR format
            order.unitPrice.toFixed(2).replace('.', ','),
            order.total.toFixed(2).replace('.', ',')
        ].map(field => `"${field}"`).join(';'); // Quote fields and use semicolon
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_orderflow_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Relatório exportado com sucesso!");
  };

  const saveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplierId) {
      setState(prev => ({
        ...prev,
        suppliers: prev.suppliers.map(s => s.id === editingSupplierId ? { ...s, ...supplierForm } : s)
      }));
      setEditingSupplierId(null);
      notify("Fornecedor atualizado!");
    } else {
      const newS = { id: crypto.randomUUID(), ...supplierForm };
      setState(prev => ({ ...prev, suppliers: [newS, ...prev.suppliers] }));
      notify("Fornecedor cadastrado!");
    }
    setSupplierForm({ name: '', tradeName: '', cnpj: '', address: '', city: '', state: '' });
  };

  const deleteSupplier = (id: string) => {
    if (state.orders.some(o => o.supplierId === id)) {
      notify("Não é possível remover: Notas vinculadas.", "error");
      return;
    }
    setState(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== id) }));
    notify("Fornecedor removido.", "info");
  };

  const saveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProductId) {
      setState(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === editingProductId ? { ...p, ...productForm } : p)
      }));
      setEditingProductId(null);
      notify("Produto atualizado!");
    } else {
      const newP = { id: crypto.randomUUID(), ...productForm };
      setState(prev => ({ ...prev, products: [newP, ...prev.products] }));
      notify("Produto cadastrado!");
    }
    setProductForm({ name: '', unit: 'UN', ncm: '' });
  };

  const deleteProduct = (id: string) => {
    if (state.orders.some(o => o.productId === id)) {
      notify("Não é possível remover: Item presente em notas.", "error");
      return;
    }
    setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
    notify("Produto removido.", "info");
  };

  const addManualItemToDraft = () => {
    if (!manualItem.productId || manualItem.quantity <= 0) {
      notify("Verifique o produto e a quantidade.", "info");
      return;
    }
    const product = state.products.find(p => p.id === manualItem.productId);
    if (!product) return;

    const newItem: DraftItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      quantity: manualItem.quantity,
      unitPrice: manualItem.unitPrice,
      total: manualItem.quantity * manualItem.unitPrice
    };

    setDraftItems(prev => [...prev, newItem]);
    setManualItem({ productId: '', quantity: 1, unitPrice: 0 });
    notify("Item adicionado.");
  };

  const handleFinalizeInvoice = () => {
    if (!selectedSupplierId || draftItems.length === 0) {
      notify("Dados incompletos.", "error");
      return;
    }

    let savedDate = invoiceDate;
    if (invoiceDate.includes('/')) {
        const [d, m, y] = invoiceDate.split('/');
        savedDate = `${y}-${m}-${d}`;
    }

    const newOrders: Order[] = draftItems.map(item => ({
      id: crypto.randomUUID(),
      supplierId: selectedSupplierId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      date: savedDate
    }));
    setState(prev => ({ ...prev, orders: [...newOrders, ...prev.orders] }));
    setDraftItems([]);
    setSelectedSupplierId('');
    notify("Nota Fiscal registrada!");
    setCurrentView('dashboard');
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    let formatted = value;
    if (value.length > 2) formatted = value.slice(0, 2) + '/' + value.slice(2);
    if (value.length > 4) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    setInvoiceDate(formatted);
  };

  const inputBaseStyle = "w-full px-6 py-4 rounded-full border border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-100/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-400 text-slate-700 font-semibold appearance-none sm:px-8";
  const numericInputStyle = "w-full px-6 py-4 rounded-full border border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-100/50 focus:border-indigo-500 outline-none transition-all text-slate-700 font-bold appearance-none sm:px-8";
  const dateInputStyle = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold outline-none focus:border-indigo-500 appearance-none sm:rounded-full sm:px-6";

  const getSupplierName = (id: string) => state.suppliers.find(s => s.id === id)?.name || 'Fornecedor Excluído';
  const getProductName = (id: string) => state.products.find(p => p.id === id)?.name || 'Produto Excluído';

  const supplierOptions = useMemo(() => state.suppliers.map(s => ({
    value: s.id,
    label: s.name,
    sublabel: s.cnpj
  })), [state.suppliers]);

  const productOptions = useMemo(() => state.products.map(p => ({
    value: p.id,
    label: p.name,
    sublabel: p.unit
  })), [state.products]);

  const analysisData = useMemo(() => {
    if (!analysisProductId) return [];
    
    return state.orders
      .filter(o => 
        o.productId === analysisProductId && 
        o.date >= analysisStartDate && 
        o.date <= analysisEndDate
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(o => ({
        date: new Date(o.date).toLocaleDateString('pt-BR'),
        price: o.unitPrice,
        supplier: getSupplierName(o.supplierId)
      }));
  }, [state.orders, analysisProductId, analysisStartDate, analysisEndDate]);

  const bestSupplierInfo = useMemo(() => {
    if (!analysisProductId) return null;
    
    const filteredOrders = state.orders.filter(o => 
      o.productId === analysisProductId && 
      o.date >= analysisStartDate && 
      o.date <= analysisEndDate
    );

    if (filteredOrders.length === 0) return null;

    const bestOrder = filteredOrders.reduce((min, curr) => curr.unitPrice < min.unitPrice ? curr : min, filteredOrders[0]);
    
    return {
      supplierName: getSupplierName(bestOrder.supplierId),
      price: bestOrder.unitPrice,
      date: new Date(bestOrder.date).toLocaleDateString('pt-BR')
    };
  }, [state.orders, analysisProductId, analysisStartDate, analysisEndDate]);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-house-chimney' },
    { id: 'nfe-import', label: 'Importar NFe', icon: 'fa-qrcode' },
    { id: 'suppliers', label: 'Fornecedores', icon: 'fa-handshake' },
    { id: 'products', label: 'Catálogo', icon: 'fa-boxes-stacked' },
    { id: 'invoices', label: 'Lançar Notas', icon: 'fa-file-invoice-dollar' },
  ];

  if (!isAuthenticated) {
    return (
      <>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 relative overflow-hidden text-slate-800">
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsEditProfileOpen(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 pb-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Editar Perfil</h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={saveProfile} className="p-8 space-y-8">
              <div className="flex flex-col items-center">
                <div 
                  className="relative group cursor-pointer" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-32 h-32 rounded-full border-4 border-slate-100 overflow-hidden shadow-lg group-hover:border-indigo-200 transition-colors">
                    {tempProfile.photo ? (
                      <img src={tempProfile.photo} className="w-full h-full object-cover" alt="Profile" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300 text-4xl">
                        <i className="fas fa-user"></i>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="fas fa-camera text-white text-2xl"></i>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                </div>
                <p className="mt-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Alterar Foto</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-4 tracking-widest">Nome de Exibição</label>
                <input 
                  required 
                  value={tempProfile.name} 
                  onChange={e => setTempProfile({...tempProfile, name: e.target.value})} 
                  className={inputBaseStyle} 
                  placeholder="Seu nome"
                />
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-full font-black uppercase text-sm tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-100">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" />
      )}

      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-100 flex flex-col shadow-2xl transition-transform duration-300 z-50 lg:relative lg:translate-x-0 lg:w-80 lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fas fa-layer-group text-lg"></i></div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">OrderFlow</h1>
              <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Enterprise ERP</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 p-2"><i className="fas fa-times"></i></button>
        </div>
        <nav className="flex-1 p-6 space-y-2 lg:p-8 lg:space-y-4">
          {navigationItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => { setCurrentView(item.id as View); setIsSidebarOpen(false); }} 
              className={`w-full flex items-center space-x-4 px-6 py-4 rounded-full transition-all duration-300 ${
                currentView === item.id 
                ? 'bg-indigo-600 text-white shadow-xl' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <i className={`fas ${item.icon} w-5`}></i>
              <span className="font-bold">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 sm:px-8 lg:px-12 relative z-30 shrink-0">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600"><i className="fas fa-bars"></i></button>
            <span className="text-slate-900 font-black text-lg sm:text-xl capitalize tracking-tight truncate max-w-[150px] sm:max-w-none">
              {currentView.replace('-', ' ')}
            </span>
          </div>
          
          <div className="relative" ref={profileMenuRef}>
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className={`flex items-center space-x-3 p-1 pr-3 rounded-full border-2 transition-all duration-300 group ${
                isProfileMenuOpen 
                ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                : 'border-slate-100 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="text-right hidden sm:block pl-2">
                <p className="text-[10px] font-black text-slate-900 leading-none">{userProfile.name}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px] border-2 border-white overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                {userProfile.photo ? <img src={userProfile.photo} className="w-full h-full object-cover" /> : <i className="fas fa-user"></i>}
              </div>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-[70]">
                <div className="p-6 pb-4 border-b border-slate-50 bg-slate-50/50">
                  <p className="font-black text-slate-800 text-sm truncate">{userProfile.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase truncate mt-1">{userProfile.email}</p>
                </div>
                <div className="p-2 space-y-1">
                  <button 
                    onClick={openEditProfile}
                    className="w-full flex items-center space-x-4 px-5 py-3 rounded-2xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-bold text-sm"
                  >
                    <i className="fas fa-user-edit text-xs"></i>
                    <span>Editar Perfil</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-4 px-5 py-3 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all font-black text-sm"
                  >
                    <i className="fas fa-power-off text-xs"></i>
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12">
          {currentView === 'dashboard' && (
             <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12 animate-in fade-in duration-700 pb-20">
               
               {/* Export Button Row */}
               <div className="flex justify-end">
                 <button onClick={handleExportData} className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95">
                   <i className="fas fa-file-export"></i>
                   <span>Exportar CSV</span>
                 </button>
               </div>

               {/* Dashboard Stats Grid */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
                 {[
                   { label: 'Total Notas', val: `R$ ${state.orders.reduce((a,b)=>a+b.total, 0).toLocaleString('pt-BR')}`, icon: 'fa-dollar-sign', color: 'bg-indigo-50 text-indigo-600' },
                   { label: 'Lançamentos', val: state.orders.length, icon: 'fa-receipt', color: 'bg-blue-50 text-blue-600' },
                   { label: 'Fornecedores', val: state.suppliers.length, icon: 'fa-building', color: 'bg-emerald-50 text-emerald-600' },
                   { label: 'Produtos', val: state.products.length, icon: 'fa-box', color: 'bg-orange-50 text-orange-600' },
                 ].map((s, i) => (
                   <div key={i} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4 hover:shadow-md transition-shadow">
                     <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${s.color}`}><i className={`fas ${s.icon} text-lg sm:text-xl`}></i></div>
                     <div className="min-w-0">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{s.label}</p>
                       <p className="text-lg sm:text-xl font-black text-slate-800 truncate">{s.val}</p>
                     </div>
                   </div>
                 ))}
               </div>

               {/* Analysis Section */}
               <div className="bg-white p-6 sm:p-12 rounded-3xl sm:rounded-[3.5rem] shadow-xl border border-slate-100">
                 <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 sm:mb-10 gap-6">
                    <SectionTitle icon="fa-chart-line">Histórico de Preços</SectionTitle>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-4 block">Início</label>
                        <input type="date" value={analysisStartDate} onChange={e => setAnalysisStartDate(e.target.value)} className={dateInputStyle} />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-4 block">Fim</label>
                        <input type="date" value={analysisEndDate} onChange={e => setAnalysisEndDate(e.target.value)} className={dateInputStyle} />
                      </div>
                    </div>
                 </div>

                 <div className="mb-8 sm:mb-10 max-w-xl">
                   <SearchableSelect 
                    label="Escolha um produto para analisar" 
                    value={analysisProductId} 
                    onChange={val => setAnalysisProductId(val)} 
                    options={productOptions}
                    placeholder="Buscar produto..."
                   />
                 </div>

                 {analysisProductId ? (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
                     <div className="lg:col-span-2 bg-slate-50/50 p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100">
                        <div className="h-[250px] sm:h-[300px] w-full">
                          {analysisData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={analysisData}>
                                <defs>
                                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} dy={10} hide={window.innerWidth < 640} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} tickFormatter={(val) => `R$${val}`} />
                                <Tooltip 
                                  contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem', backgroundColor: 'white'}}
                                  itemStyle={{fontWeight: 800, color: '#4f46e5', fontSize: '12px'}}
                                  labelStyle={{fontWeight: 900, marginBottom: '0.25rem', color: '#1e293b', fontSize: '11px'}}
                                />
                                <Area type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
                               <i className="fas fa-chart-area text-4xl mb-4 opacity-20"></i>
                               <p className="font-bold text-xs">Sem dados para este período.</p>
                            </div>
                          )}
                        </div>
                     </div>
                     <div className="flex flex-col gap-6">
                        {bestSupplierInfo ? (
                          <div className="bg-indigo-600 p-8 rounded-2xl sm:p-10 sm:rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                             <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 mb-2 text-indigo-100">Melhor Compra</p>
                             <h4 className="text-xl font-black mb-6 leading-tight text-white line-clamp-2">{bestSupplierInfo.supplierName}</h4>
                             <div className="flex items-end justify-between">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest opacity-80 text-indigo-100">Menor Valor</p>
                                  <p className="text-2xl font-black tracking-tighter text-white">R$ {bestSupplierInfo.price.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] font-black uppercase tracking-widest opacity-80 text-indigo-100">Data</p>
                                  <p className="text-[10px] font-bold text-white">{bestSupplierInfo.date}</p>
                                </div>
                             </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center flex-1">
                             <i className="fas fa-search text-slate-300 text-3xl mb-4"></i>
                             <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Nenhuma compra</p>
                          </div>
                        )}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 sm:p-8 sm:rounded-[2.5rem]">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Métricas Rápidas</p>
                           <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                 <span className="text-[11px] font-bold text-slate-500">Transações</span>
                                 <span className="text-[11px] font-black text-slate-800">{analysisData.length}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-[11px] font-bold text-slate-500">Média</span>
                                 <span className="text-[11px] font-black text-indigo-600">
                                    R$ {(analysisData.reduce((acc, curr) => acc + curr.price, 0) / (analysisData.length || 1)).toFixed(2)}
                                 </span>
                              </div>
                           </div>
                        </div>
                     </div>
                   </div>
                 ) : (
                   <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 sm:py-20 sm:rounded-[2.5rem]">
                      <i className="fas fa-mouse-pointer text-slate-200 text-4xl mb-6"></i>
                      <p className="text-slate-500 font-black text-sm">Selecione um produto acima.</p>
                   </div>
                 )}
               </div>

               {/* Recent Orders Table */}
               <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-slate-50 font-black text-slate-700 flex justify-between items-center">
                    <span className="text-sm">Lançamentos Recentes</span>
                    <i className="fas fa-history text-slate-300"></i>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Data</th>
                          <th className="px-6 py-4">Fornecedor</th>
                          <th className="px-6 py-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {state.orders.length === 0 ? (
                           <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400 text-xs font-bold">Nenhum registro.</td></tr>
                        ) : state.orders.slice(0, 10).map(o => (
                          <tr key={o.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4 text-[11px] font-bold text-slate-500">{new Date(o.date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-black text-slate-800 text-[11px] truncate max-w-[120px]">{getSupplierName(o.supplierId)}</td>
                            <td className="px-6 py-4 text-right font-black text-indigo-600 text-[11px]">R$ {o.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               </div>
             </div>
          )}
          
          {/* Nova Aba de Importação de NFe */}
          {currentView === 'nfe-import' && (
             <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-6 duration-500 pb-20">
               <div className="bg-white p-6 sm:p-12 rounded-3xl sm:rounded-[3.5rem] shadow-xl border border-slate-100 text-center">
                 <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-2xl mx-auto mb-6">
                   <i className="fas fa-qrcode"></i>
                 </div>
                 <h2 className="text-2xl font-black text-slate-800 mb-2">Importar Nota Fiscal</h2>
                 <p className="text-slate-400 font-bold text-sm mb-10">Digite a Chave de Acesso de 44 dígitos</p>
                 
                 <div className="max-w-2xl mx-auto relative">
                   <input 
                    type="text" 
                    value={accessKey}
                    onChange={(e) => setAccessKey(formatAccessKey(e.target.value))}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-6 text-center font-mono text-lg sm:text-xl font-bold text-slate-700 tracking-wider outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                    placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                    maxLength={54} // 44 digits + 10 spaces
                   />
                   <div className="mt-4 flex justify-end text-[10px] font-black uppercase tracking-widest text-slate-400">
                     {accessKey.replace(/\D/g, '').length} / 44
                   </div>
                 </div>

                 <div className="mt-12">
                   <button 
                    onClick={handleImportNfe}
                    disabled={isImportingNfe || accessKey.replace(/\D/g, '').length !== 44}
                    className="w-full sm:w-auto px-16 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                   >
                     {isImportingNfe ? (
                       <span className="flex items-center space-x-3">
                         <i className="fas fa-spinner fa-spin"></i>
                         <span>Processando...</span>
                       </span>
                     ) : (
                       <span>Buscar e Importar</span>
                     )}
                   </button>
                 </div>
                 
                 <div className="mt-10 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 text-left">
                    <div className="flex items-start space-x-4">
                      <i className="fas fa-info-circle text-blue-500 mt-1"></i>
                      <div>
                        <p className="text-blue-800 font-bold text-xs mb-1">Nota sobre Importação</p>
                        <p className="text-blue-600/80 text-[11px] leading-relaxed">
                          O sistema identificará o fornecedor automaticamente pelo CNPJ contido na chave. 
                          Devido a restrições de segurança da SEFAZ, os itens serão <strong className="text-blue-800">simulados via IA</strong> com base no perfil da empresa para fins de demonstração.
                        </p>
                      </div>
                    </div>
                 </div>
               </div>
             </div>
          )}

          {currentView === 'suppliers' && (
            <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12 animate-in slide-in-from-bottom-6 duration-500 pb-20">
               <div className="bg-white p-6 sm:p-12 rounded-3xl sm:rounded-[3.5rem] shadow-xl border border-slate-100">
                 <SectionTitle icon="fa-building-circle-check">{editingSupplierId ? 'Editar' : 'Novo'} Fornecedor</SectionTitle>
                 <form onSubmit={saveSupplier} className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2">
                   <div className="md:col-span-2">
                     <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 sm:ml-8 tracking-widest">
                       CNPJ (Validado em tempo real)
                     </label>
                     <div className="flex flex-col sm:flex-row gap-4">
                       <div className="flex-1 relative">
                        <input 
                          required 
                          value={supplierForm.cnpj} 
                          onChange={e => setSupplierForm({...supplierForm, cnpj: e.target.value.replace(/\D/g, '').slice(0, 14)})} 
                          className={`${inputBaseStyle} ${
                            cnpjValidation.status === 'valid' ? 'border-emerald-500 focus:border-emerald-500 ring-emerald-50' : 
                            cnpjValidation.status === 'invalid' ? 'border-rose-500 focus:border-rose-500 ring-rose-50' : ''
                          }`} 
                          placeholder="00000000000000" 
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                          {cnpjValidation.status === 'valid' && <i className="fas fa-check-circle text-emerald-500"></i>}
                          {cnpjValidation.status === 'invalid' && <i className="fas fa-exclamation-circle text-rose-500"></i>}
                        </div>
                        {/* Real-time status badge */}
                        <div className="mt-2 ml-6 flex items-center space-x-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            cnpjValidation.status === 'valid' ? 'bg-emerald-50 text-emerald-600' : 
                            cnpjValidation.status === 'invalid' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                          }`}>
                            {cnpjValidation.message}
                          </span>
                        </div>
                       </div>
                       
                       {!editingSupplierId && (
                        <button 
                          type="button" 
                          onClick={handleSearchCnpj} 
                          disabled={isSearchingCnpj || cnpjValidation.status !== 'valid'} 
                          className={`px-8 h-14 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-lg flex items-center justify-center active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed`}
                        >
                          {isSearchingCnpj ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-arrow-down mr-2"></i>}
                          <span className="font-bold uppercase text-[10px] tracking-widest">Consultar</span>
                        </button>
                       )}
                     </div>
                   </div>
                   <div className="md:col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 sm:ml-8 tracking-widest">Razão Social</label><input required value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} className={inputBaseStyle} /></div>
                   <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 sm:ml-8 tracking-widest">UF</label><input required value={supplierForm.state} onChange={e => setSupplierForm({...supplierForm, state: e.target.value.toUpperCase()})} maxLength={2} className={inputBaseStyle} /></div>
                   <div className="md:col-span-2 flex justify-center sm:justify-end pt-8 sm:pt-10 border-t border-slate-50">
                     <button type="submit" className="w-full sm:w-auto bg-slate-900 text-white px-12 py-5 rounded-full font-black text-sm uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-xl">{editingSupplierId ? 'Atualizar' : 'Salvar'}</button>
                   </div>
                 </form>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                 {state.suppliers.map(s => (
                   <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><i className="fas fa-building"></i></div>
                       <div className="flex space-x-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => {setEditingSupplierId(s.id); setSupplierForm({ ...s }); window.scrollTo({top:0, behavior:'smooth'});}} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><i className="fas fa-pen text-[10px]"></i></button>
                         <button onClick={() => deleteSupplier(s.id)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"><i className="fas fa-trash-can text-[10px]"></i></button>
                       </div>
                     </div>
                     <h4 className="font-black text-slate-800 text-sm truncate pr-16">{s.name}</h4>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</p>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {currentView === 'products' && (
            <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12 animate-in slide-in-from-bottom-6 duration-500 pb-20">
               <div className="bg-white p-6 sm:p-12 rounded-3xl sm:rounded-[3.5rem] shadow-xl border border-slate-100">
                 <SectionTitle icon="fa-box-open">{editingProductId ? 'Editar' : 'Novo'} Produto</SectionTitle>
                 <form onSubmit={saveProduct} className="space-y-6 sm:space-y-8">
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 sm:ml-8 tracking-widest">Nome do Produto</label>
                     <input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className={inputBaseStyle} placeholder="Descrição comercial" />
                   </div>
                   
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 ml-6 sm:ml-8 tracking-widest">Unidade de Medida</label>
                      <UnitSelector value={productForm.unit} onChange={val => setProductForm({...productForm, unit: val})} />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 sm:ml-8 tracking-widest">NCM (Opcional)</label>
                      <input value={productForm.ncm} onChange={e => setProductForm({...productForm, ncm: e.target.value})} className={inputBaseStyle} placeholder="Código fiscal..." />
                   </div>
                   
                   <div className="flex justify-center sm:justify-end pt-8 sm:pt-10 border-t border-slate-50">
                     <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white px-12 py-5 rounded-full font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl">{editingProductId ? 'Atualizar' : 'Catalogar'}</button>
                   </div>
                 </form>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                 {state.products.map(p => (
                   <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:rotate-12 transition-transform"><i className="fas fa-box text-sm"></i></div>
                       <div className="flex space-x-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => {setEditingProductId(p.id); setProductForm({ name: p.name, unit: p.unit, ncm: p.ncm || '' }); window.scrollTo({top:0, behavior:'smooth'});}} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><i className="fas fa-pen text-[10px]"></i></button>
                         <button onClick={() => deleteProduct(p.id)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"><i className="fas fa-trash-can text-[10px]"></i></button>
                       </div>
                     </div>
                     <h4 className="font-black text-slate-800 text-sm truncate mb-2">{p.name}</h4>
                     <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">{p.unit}</span>
                        {p.ncm && <span className="text-[9px] font-bold text-slate-400 uppercase truncate">NCM: {p.ncm}</span>}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {currentView === 'invoices' && (
            <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12 animate-in slide-in-from-bottom-6 duration-500 pb-20">
               {/* Invoice Header Form */}
               <div className="bg-white p-6 sm:p-12 rounded-3xl sm:rounded-[3.5rem] shadow-xl border border-slate-100">
                 <SectionTitle icon="fa-file-invoice">Informações Básicas</SectionTitle>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                   <SearchableSelect 
                    label="Fornecedor" 
                    value={selectedSupplierId} 
                    onChange={val => setSelectedSupplierId(val)} 
                    options={supplierOptions}
                    placeholder="Selecione..."
                   />
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 sm:ml-8 tracking-widest">Data de Entrada</label>
                     <div className="relative">
                       <input required type="text" value={invoiceDate} onChange={handleDateChange} placeholder="DD/MM/AAAA" className={inputBaseStyle} />
                       <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 hidden sm:block"><i className="fas fa-calendar-alt text-xs"></i></div>
                     </div>
                   </div>
                 </div>
               </div>

               {/* Item Adder Form */}
               <div className="bg-indigo-600/5 p-6 sm:p-12 rounded-3xl sm:rounded-[3.5rem] border border-indigo-100/50">
                 <SectionTitle icon="fa-plus-circle text-indigo-600">Lançar Item</SectionTitle>
                 <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-end">
                    <div className="md:col-span-12 xl:col-span-5">
                      <SearchableSelect 
                        label="Produto" 
                        value={manualItem.productId} 
                        onChange={val => setManualItem({ ...manualItem, productId: val })} 
                        options={productOptions}
                        placeholder="Buscar item..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:col-span-8 xl:col-span-5">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 tracking-widest">Qtd.</label>
                        <input type="number" value={manualItem.quantity} onChange={e => setManualItem({ ...manualItem, quantity: Number(e.target.value) })} className={numericInputStyle} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-6 tracking-widest">Unitário</label>
                        <input type="number" step="0.01" value={manualItem.unitPrice} onChange={e => setManualItem({ ...manualItem, unitPrice: Number(e.target.value) })} className={numericInputStyle} />
                      </div>
                    </div>
                    <div className="md:col-span-4 xl:col-span-2">
                      <button onClick={addManualItemToDraft} className="w-full h-14 sm:h-[60px] bg-indigo-600 text-white rounded-full font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all active:scale-95">Lançar</button>
                    </div>
                 </div>
               </div>

               {/* Draft Table */}
               <div className="bg-white rounded-3xl sm:rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden">
                 <div className="p-6 sm:p-10 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-black text-slate-800 text-lg sm:text-xl tracking-tight">Produtos</h3>
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest">{draftItems.length} Itens</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/50 text-slate-400 font-black text-[9px] uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Item</th>
                          <th className="px-6 py-4 text-center">Qtd.</th>
                          <th className="px-6 py-4 text-right">Total</th>
                          <th className="px-6 py-4 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {draftItems.length === 0 ? <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-400 italic text-xs">Vazio.</td></tr> : draftItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-black text-slate-800 text-xs truncate max-w-[150px]">{getProductName(item.productId)}</td>
                            <td className="px-6 py-4 text-center font-bold text-slate-700 text-xs">{item.quantity}</td>
                            <td className="px-6 py-4 text-right font-black text-indigo-600 text-xs">R$ {item.total.toFixed(2)}</td>
                            <td className="px-6 py-4 text-center"><button onClick={()=>setDraftItems(draftItems.filter(i=>i.id!==item.id))} className="text-rose-500"><i className="fas fa-trash-alt text-xs"></i></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
                 <div className="p-8 sm:p-12 bg-slate-900 flex flex-col items-center justify-between text-white gap-6 sm:flex-row">
                   <div className="text-center sm:text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Total da Nota</p>
                      <h4 className="text-3xl sm:text-5xl font-black tracking-tighter">R$ {draftItems.reduce((a,b)=>a+b.total, 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h4>
                   </div>
                   <button 
                    onClick={handleFinalizeInvoice} 
                    className="w-full sm:w-auto px-12 py-5 sm:px-20 sm:py-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black uppercase text-sm tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed" 
                    disabled={draftItems.length===0 || !selectedSupplierId}
                   >
                     <span>Finalizar</span>
                   </button>
                 </div>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
