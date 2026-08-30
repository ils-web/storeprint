import React, { useState, useMemo, useEffect } from 'react';
import {
  Tenant,
  Warehouse,
  InventoryProduct,
  TenantDepartment,
  MultiTenantOrderItem,
  PackagingUnit,
  STANDARD_PACKAGING_UNITS,
} from '../../types/multiTenant';
import {
  getTenants,
  getWarehouses,
  getInventory,
  getTenantDepartments,
  getTenantOrders,
  saveTenantOrders,
  createTenantOrder,
} from '../../services/multiTenantDb';
import { getDbStock } from '../../services/unifiedDb';
import { loadCloudConfig, submitDepartmentOrderToCloud } from '../../utils/cloudSync';
import { pushOrderToFirestore, subscribeToFirestoreStock } from '../../services/firestoreSync';
import { StockItem } from '../../types';
import { InstallAppModal } from './InstallAppModal';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  Package,
  Building2,
  ArrowRight,
  Send,
  AlertCircle,
  Sparkles,
  ClipboardList,
  Smartphone,
  Download,
  Trash2,
  Users,
  ArrowUp,
  X,
} from 'lucide-react';

interface StaffOrderPortalProps {
  initialTenantId?: string;
  initialDepartment?: string;
  onBackToMain?: () => void;
}

export function StaffOrderPortal({ initialTenantId, initialDepartment, onBackToMain }: StaffOrderPortalProps) {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const tenants = getTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    initialTenantId || (tenants.length > 0 ? tenants[0].id : '')
  );

  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const warehouses = getWarehouses(selectedTenantId);
  const activeWarehouse = warehouses[0] || null;

  const departments = getTenantDepartments(selectedTenantId);
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string>(
    initialDepartment || (departments.length > 0 ? departments[0].name : '')
  );
  const [patientsCount, setPatientsCount] = useState<string>('');
  const [requesterName, setRequesterName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'catalog' | 'my_orders'>('catalog');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');

  // Cart State: Map of productId -> MultiTenantOrderItem
  const [cart, setCart] = useState<Record<string, MultiTenantOrderItem>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccessNumber, setOrderSuccessNumber] = useState<string | null>(null);
  const [liveStock, setLiveStock] = useState<Record<string, StockItem>>(() => getDbStock());

  // Subscribe to real-time warehouse stock from Firestore
  useEffect(() => {
    const unsub = subscribeToFirestoreStock((newStock) => {
      setLiveStock(newStock);
    }, selectedTenantId);
    return () => {
      if (unsub) unsub();
    };
  }, [selectedTenantId]);

  // Scroll to Top Listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 250);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Available Products: Complete Master Catalog from Warehouse Stock (strictly excluding frozen/inactive items)
  const inventoryItems = useMemo(() => {
    const stockItems = (Object.values(liveStock || {}) || []) as StockItem[];

    if (stockItems.length > 0) {
      return stockItems
        .filter((item) => item.isActive !== false)
        .sort((a, b) => (a.colIndex || 0) - (b.colIndex || 0))
        .map((item, idx) => ({
          id: item.id || item.name,
          warehouseId: activeWarehouse?.id || 'wh-default',
          name: item.name,
          unit: (item.unit as PackagingUnit) || "יח'",
          currentStock: typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0,
          minThreshold: item.minThreshold || 10,
          colIndex: item.colIndex || idx + 1,
          isActive: item.isActive !== false,
          limitByPatients: Boolean(item.limitByPatients),
        }));
    }

    if (!activeTenant || !activeWarehouse) return [];
    return getInventory(activeTenant.id, activeWarehouse.id).filter((p) => p.isActive !== false);
  }, [liveStock, activeTenant, activeWarehouse]);

  // Filtered Products by Search Query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return inventoryItems;
    const q = searchQuery.toLowerCase().trim();
    return inventoryItems.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.unit && p.unit.toLowerCase().includes(q)) ||
      String(p.colIndex).includes(q)
    );
  }, [inventoryItems, searchQuery]);

  // Cart totals
  const cartItemsList: MultiTenantOrderItem[] = useMemo(() => {
    return (Object.values(cart) as MultiTenantOrderItem[]).filter(
      (item) => Boolean(item && item.orderedQty > 0)
    );
  }, [cart]);

  const totalCartCount = useMemo(() => {
    return cartItemsList.reduce((acc, item) => acc + item.orderedQty, 0);
  }, [cartItemsList]);

  // Handlers for cart
  const handleSetQty = (product: any, unit: PackagingUnit, exactQty: number) => {
    const safeQty = Math.max(0, exactQty);
    if (product.limitByPatients && safeQty > 0) {
      const maxAllowed = parseInt(patientsCount, 10);
      if (isNaN(maxAllowed) || maxAllowed <= 0) {
        alert(
          `הפריט "${product.name}" מוגבל לפי כמות המטופלים במחלקה.\nנא להזין תחילה את מספר המטופלים במחלקה בראש הטופס.`
        );
        return;
      }
      if (safeQty > maxAllowed) {
        alert(
          `הכמות המרבית להזמנה עבור "${product.name}" היא ${maxAllowed} יח' (לפי מספר המטופלים הרשום במחלקה).`
        );
        return;
      }
    }

    setCart((prev) => {
      if (safeQty === 0) {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      }

      const existing = prev[product.id] || {
        id: `item-${product.id}`,
        productId: product.id,
        name: product.name,
        orderedQty: 0,
        orderedUnit: unit || product.unit || "יח'",
      };

      return {
        ...prev,
        [product.id]: {
          ...existing,
          orderedQty: safeQty,
          orderedUnit: unit,
        },
      };
    });
  };

  const handleUpdateQty = (product: any, unit: PackagingUnit, delta: number) => {
    const currentQty = cart[product.id]?.orderedQty || 0;
    handleSetQty(product, unit, currentQty + delta);
  };

  const handleUnitChange = (product: any, newUnit: PackagingUnit) => {
    setCart((prev) => {
      if (!prev[product.id]) return prev;
      return {
        ...prev,
        [product.id]: {
          ...prev[product.id],
          orderedUnit: newUnit,
        },
      };
    });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartmentName.trim()) {
      alert('נא לבחור את שם המחלקה');
      return;
    }
    if (cartItemsList.length === 0) {
      alert('סל ההזמנה ריק. נא לבחור לפחות פריט אחד.');
      return;
    }

    try {
      // 1. Submit directly to Google Sheets Cloud
      const cloudConfig = loadCloudConfig();
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        const orderItemsMap: Record<string, { qty: number; unit?: string }> = {};
        cartItemsList.forEach((it) => {
          orderItemsMap[it.name] = { qty: it.orderedQty, unit: it.orderedUnit };
        });

        const formattedNotes = [
          requesterName.trim() ? `שם מזמין/ה: ${requesterName.trim()}` : '',
          notes.trim() ? notes.trim() : '',
        ].filter(Boolean).join(' | ');

        await submitDepartmentOrderToCloud(
          {
            department: selectedDepartmentName.trim(),
            orderedBy: requesterName.trim() || undefined,
            patientsCount: patientsCount.trim() || undefined,
            notes: formattedNotes || undefined,
            items: orderItemsMap,
          },
          cloudConfig
        );
      }

      // 2. Save local order & push to Firestore Real-Time DB
      const newOrder = createTenantOrder(selectedTenantId, {
        tenantId: selectedTenantId,
        warehouseId: activeWarehouse?.id || 'wh-default',
        departmentId: `dept-${Date.now()}`,
        departmentName: selectedDepartmentName.trim(),
        items: cartItemsList,
        totalItemsCount: cartItemsList.length,
        notes: [requesterName.trim() ? `שם מזמין/ה: ${requesterName.trim()}` : '', notes.trim()].filter(Boolean).join(' | '),
        status: 'NEW',
        source: 'WEB_PORTAL',
        printed: false,
      });

      pushOrderToFirestore(newOrder, selectedTenantId).catch(console.warn);

      setOrderSuccessNumber(newOrder.orderNumber);
      setCart({});
      setNotes('');
      setIsCartOpen(false);
      window.dispatchEvent(new Event('storeprint_order_created'));
    } catch (err: any) {
      alert(err.message || 'שגיאה בשליחת ההזמנה');
    }
  };

  const [refreshPastOrdersKey, setRefreshPastOrdersKey] = useState<number>(0);

  const pastOrders = useMemo(() => {
    return getTenantOrders(selectedTenantId);
  }, [selectedTenantId, orderSuccessNumber, refreshPastOrdersKey]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 text-sm selection:bg-indigo-500 selection:text-white" dir="rtl">
      {/* Top Fixed Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-4 py-2.5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBackToMain && (
              <button
                onClick={onBackToMain}
                className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 border border-slate-700 transition-colors cursor-pointer shrink-0"
                title="חזרה למסך הראשי"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm sm:text-base text-white truncate">פורטל הזמנות מחלקות 📋</span>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  {inventoryItems.length} פריטים
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md transition-all cursor-pointer"
              title="התקנת האפליקציה למסך הבית"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">התקן</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>סל ({totalCartCount})</span>
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Sticky Search Bar */}
      {activeTab === 'catalog' && (
        <div className="sticky top-[51px] z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2 shadow-sm">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="חיפוש מהיר של פריט להזמנה לפי שם..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-9 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                  title="נקה חיפוש"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3.5">
        {orderSuccessNumber && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-sm">ההזמנה נשלחה בהצלחה למחסן!</h4>
                <p className="text-xs text-emerald-300 mt-0.5">
                  מספר הזמנה: <strong className="font-mono">{orderSuccessNumber}</strong>. המחסן קיבל את הדרישה ומכין אותה לליקוט.
                </p>
              </div>
            </div>
            <button onClick={() => setOrderSuccessNumber(null)} className="text-xs text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-400" />
              פרטי המחלקה המזמינה
            </label>
            <span className="text-[11px] text-slate-400 font-mono">{inventoryItems.length} פריטים</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-5">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">מחלקה מזמינה *</label>
              <select
                value={selectedDepartmentName}
                onChange={(e) => setSelectedDepartmentName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- בחר מחלקה מהרשימה --</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                <option value="custom">+ הקלד מחלקה אחרת...</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">שם המזמין/ה *</label>
              <input type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">מס' מטופלים</label>
              <input type="number" min="0" value={patientsCount} onChange={(e) => setPatientsCount(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono" />
            </div>
          </div>
          {selectedDepartmentName === 'custom' && (
            <input type="text" placeholder="הקלד את שם המחלקה החדשה" onChange={(e) => setSelectedDepartmentName(e.target.value)} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 mt-1" />
          )}
        </div>

        <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button onClick={() => setActiveTab('catalog')} className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'catalog' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
            <Package className="w-3.5 h-3.5" /> <span>קטלוג פריטים ({inventoryItems.length})</span>
          </button>
          <button onClick={() => setActiveTab('my_orders')} className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'my_orders' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
            <ClipboardList className="w-3.5 h-3.5" /> <span>ההזמנות שלי ({pastOrders.length})</span>
          </button>
        </div>

        {activeTab === 'catalog' && (
          <div className="space-y-3">
            <div className="space-y-2.5">
              {filteredProducts.map((prod, idx) => {
                const inCart = cart[prod.id];
                const qty = inCart ? inCart.orderedQty : 0;
                const unit = inCart?.orderedUnit || prod.unit || "יח'";
                return (
                  <div key={prod.id} className={`bg-slate-900 border rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md transition-all ${qty > 0 ? 'border-indigo-500/80 ring-1 ring-indigo-500/30' : 'border-slate-800 hover:border-slate-700'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">#{prod.colIndex || idx + 1}</span>
                        <h4 className="font-bold text-sm text-white">{prod.name}</h4>
                        {prod.limitByPatients && <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-600/50 px-2 py-0.5 rounded-md font-bold">מוגבל למטופלים</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">יתרה: <strong className="text-slate-200">{prod.currentStock} {prod.unit || "יח'"}</strong></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select value={unit} onChange={(e) => handleUnitChange(prod, e.target.value as PackagingUnit)} className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-indigo-300 font-bold">
                        {STANDARD_PACKAGING_UNITS.map((u) => <option key={u.value} value={u.value}>{u.labelHe}</option>)}
                      </select>
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-700">
                        <button type="button" onClick={() => handleUpdateQty(prod, unit, -1)} disabled={qty === 0} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30"><Minus className="w-3.5 h-3.5" /></button>
                        <input type="number" value={qty} onChange={(e) => handleSetQty(prod, unit, parseInt(e.target.value, 10) || 0)} className="w-12 h-8 text-center font-black text-sm font-mono rounded-lg border bg-slate-900" />
                        <button type="button" onClick={() => handleUpdateQty(prod, unit, 1)} className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'my_orders' && (
          <div className="space-y-3">
            {pastOrders.map((ord) => (
              <div key={ord.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex justify-between">
                  <div>
                    <div className="font-bold text-white text-sm">{ord.orderNumber}</div>
                    <div className="text-xs text-slate-400">{new Date(ord.createdAt).toLocaleString('he-IL')}</div>
                  </div>
                  <button onClick={() => { if(confirm('למחוק?')) { saveTenantOrders(selectedTenantId, pastOrders.filter(o => o.id !== ord.id)); setRefreshPastOrdersKey(k => k+1); } }} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 space-y-1">
                  {ord.items.map((it, idx) => <div key={idx} className="flex justify-between"><span>{it.name}</span><span className="font-bold text-indigo-300">{it.orderedQty} {it.orderedUnit}</span></div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showScrollTop && (
        <button onClick={scrollToTop} className="fixed bottom-20 left-4 z-40 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl transition-all cursor-pointer">
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {cartItemsList.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-40">
          <button onClick={() => setIsCartOpen(true)} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-2xl flex items-center justify-between px-5">
            <span>סל הזמנה: {totalCartCount} פריטים</span>
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 flex items-center justify-between border-b border-slate-800">
              <h3 className="font-bold text-white">סיכום הזמנה</h3>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleSubmitOrder} className="p-6 overflow-y-auto flex-1 space-y-4">
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות למחסן..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white" />
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">שלח הזמנה</button>
            </form>
          </div>
        </div>
      )}

      <InstallAppModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} tenantName={activeTenant?.name} />
    </div>
  );
}
