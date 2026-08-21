import React, { useState, useMemo } from 'react';
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
  createTenantOrder,
} from '../../services/multiTenantDb';
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
  ArrowLeft,
  ArrowRight,
  Send,
  AlertCircle,
  Sparkles,
  ClipboardList,
  Smartphone,
  Download,
} from 'lucide-react';

interface StaffOrderPortalProps {
  initialTenantId?: string;
  initialDepartment?: string;
  onBackToMain?: () => void;
}

export function StaffOrderPortal({ initialTenantId, initialDepartment, onBackToMain }: StaffOrderPortalProps) {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
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
  const [activeTab, setActiveTab] = useState<'catalog' | 'my_orders'>('catalog');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');

  // Cart State: Map of productId -> MultiTenantOrderItem
  const [cart, setCart] = useState<Record<string, MultiTenantOrderItem>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccessNumber, setOrderSuccessNumber] = useState<string | null>(null);

  // Available Products from Warehouse
  const inventoryItems = useMemo(() => {
    if (!activeTenant || !activeWarehouse) return [];
    return getInventory(activeTenant.id, activeWarehouse.id);
  }, [activeTenant, activeWarehouse]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return inventoryItems;
    const q = searchQuery.toLowerCase();
    return inventoryItems.filter((p) => p.name.toLowerCase().includes(q));
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
  const handleUpdateQty = (product: InventoryProduct, unit: PackagingUnit, delta: number) => {
    setCart((prev) => {
      const existing = prev[product.id] || {
        id: `item-${product.id}`,
        productId: product.id,
        name: product.name,
        orderedQty: 0,
        orderedUnit: unit || product.unit || "יח'",
      };

      const newQty = Math.max(0, existing.orderedQty + delta);
      if (newQty === 0) {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      }

      return {
        ...prev,
        [product.id]: {
          ...existing,
          orderedQty: newQty,
          orderedUnit: unit,
        },
      };
    });
  };

  const handleUnitChange = (product: InventoryProduct, newUnit: PackagingUnit) => {
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

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartmentName.trim()) {
      alert('נא לבחור או להקליד את שם המחלקה המזמינה.');
      return;
    }
    if (cartItemsList.length === 0) {
      alert('סל ההזמנות ריק. נא להוסיף לפחות פריט אחד.');
      return;
    }

    try {
      const newOrder = createTenantOrder(selectedTenantId, {
        tenantId: selectedTenantId,
        warehouseId: activeWarehouse?.id || 'wh-default',
        departmentId: `dept-${Date.now()}`,
        departmentName: selectedDepartmentName.trim(),
        items: cartItemsList,
        totalItemsCount: cartItemsList.length,
        notes: notes.trim() || undefined,
        status: 'NEW',
        source: 'WEB_PORTAL',
        printed: false,
      });

      setOrderSuccessNumber(newOrder.orderNumber);
      setCart({});
      setNotes('');
      setIsCartOpen(false);
    } catch (err: any) {
      alert(err.message || 'שגיאה בשליחת ההזמנה');
    }
  };

  const pastOrders = useMemo(() => {
    return getTenantOrders(selectedTenantId);
  }, [selectedTenantId, orderSuccessNumber]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24" dir="rtl">
      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-4 py-3 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToMain && (
              <button
                onClick={onBackToMain}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition-colors cursor-pointer"
                title="חזרה למסך הראשי"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-white">פורטל הזמנות מחלקות</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 uppercase">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">{activeTenant?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="px-3 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="הורדת והתקנת האפליקציה למסך הבית"
            >
              <Smartphone className="w-3.5 h-3.5 animate-bounce" />
              <span className="hidden sm:inline">התקנת אפליקציה</span>
              <span className="sm:hidden">התקן</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs font-bold">{totalCartCount}</span>
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Success Banner */}
        {orderSuccessNumber && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-sm">ההזמנה נשלחה בהצלחה למחסן!</h4>
                <p className="text-xs text-emerald-300 mt-0.5">
                  מספר הזמנה: <strong className="font-mono">{orderSuccessNumber}</strong>. המחסן קיבל את הדרישה ומכין אותה לליקוט.
                </p>
              </div>
            </div>
            <button
              onClick={() => setOrderSuccessNumber(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Department Selection Bar */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-400" />
              מחלקה / אגף מזמין
            </label>
            <span className="text-[11px] text-slate-400">בחר את המחלקה שלך</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={selectedDepartmentName}
              onChange={(e) => setSelectedDepartmentName(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- בחר מחלקה מהרשימה --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
              <option value="custom">+ הקלד מחלקה אחרת...</option>
            </select>

            {selectedDepartmentName === 'custom' ? (
              <input
                type="text"
                placeholder="הקלד את שם המחלקה"
                onChange={(e) => setSelectedDepartmentName(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            ) : (
              <input
                type="text"
                placeholder="או הקלד ידנית (לדוגמה: ג' 2 סיעוד)"
                value={selectedDepartmentName}
                onChange={(e) => setSelectedDepartmentName(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>
        </div>

        {/* Tabs: Catalog vs My Orders */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>קטלוג פריטים</span>
          </button>

          <button
            onClick={() => setActiveTab('my_orders')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'my_orders'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>מעקב הזמנות ({pastOrders.length})</span>
          </button>
        </div>

        {/* TAB 1: CATALOG */}
        {activeTab === 'catalog' && (
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="חיפוש פריט, תרופה, ציוד מתכלה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
              />
            </div>

            {/* Product Cards List */}
            <div className="space-y-2.5">
              {filteredProducts.map((prod) => {
                const inCart = cart[prod.id];
                const qty = inCart ? inCart.orderedQty : 0;
                const unit = inCart?.orderedUnit || prod.unit || "יח'";

                return (
                  <div
                    key={prod.id}
                    className="bg-slate-800/70 border border-slate-700/70 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md hover:border-slate-600 transition-all"
                  >
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white">{prod.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400 font-mono">
                          יתרה במחסן: <strong className="text-slate-200">{prod.currentStock} {prod.unit || "יח'"}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Packaging Unit & Quantity Selector */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <select
                        value={unit}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          handleUnitChange(prod, newUnit);
                        }}
                        className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-indigo-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        {STANDARD_PACKAGING_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.labelHe}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(prod, unit, -1)}
                          disabled={qty === 0}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-8 text-center font-bold text-sm text-white font-mono">
                          {qty}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleUpdateQty(prod, unit, 1)}
                          className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="py-12 text-center text-slate-400 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                  <Package className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-medium">לא נמצאו פריטים</p>
                  <p className="text-xs text-slate-500 mt-0.5">נסה לחפש פריט אחר</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY ORDERS TRACKING */}
        {activeTab === 'my_orders' && (
          <div className="space-y-3">
            {pastOrders.map((ord) => {
              const statusBg =
                ord.status === 'PRINTED' || ord.printed
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : ord.status === 'ISSUED'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30';

              const statusText =
                ord.status === 'PRINTED' || ord.printed
                  ? 'הודפס / הוכן לניפוק'
                  : ord.status === 'ISSUED'
                  ? 'נופק ונמסר'
                  : 'התקבל במחסן (חדש)';

              return (
                <div
                  key={ord.id}
                  className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 shadow-md space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{ord.orderNumber}</span>
                        <span className="text-xs text-indigo-400 font-medium">({ord.departmentName})</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(ord.createdAt).toLocaleString('he-IL')}
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusBg}`}>
                      {statusText}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/80 text-xs space-y-1.5">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300">
                        <span>{it.name}</span>
                        <span className="font-mono font-bold text-indigo-300">
                          {it.orderedQty} {it.orderedUnit}
                        </span>
                      </div>
                    ))}
                  </div>

                  {ord.notes && (
                    <p className="text-xs text-slate-400 italic">הערות: {ord.notes}</p>
                  )}
                </div>
              );
            })}

            {pastOrders.length === 0 && (
              <div className="py-12 text-center text-slate-400 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium">אין הזמנות קודמות</p>
                <p className="text-xs text-slate-500 mt-0.5">הזמנות שתיצור יופיעו כאן בזמן אמת</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartItemsList.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-2xl font-bold text-sm shadow-2xl shadow-indigo-600/40 flex items-center justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>סל הזמנה: {totalCartCount} פריטים</span>
            </div>
            <span className="flex items-center gap-1 text-xs underline">
              סיום ושליחה למחסן
              <ChevronRight className="w-4 h-4 rotate-180" />
            </span>
          </button>
        </div>
      )}

      {/* CART MODAL / BOTTOM SHEET */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">סיכום הזמנה למחסן</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">מחלקה מזמינה:</span>
                <strong className="text-sm text-white">
                  {selectedDepartmentName || 'לא נבחרה מחלקה (נא לבחור למעלה)'}
                </strong>
              </div>

              {/* Items in Cart */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase text-slate-400">פריטים שהוזמנו</span>
                {cartItemsList.map((item) => (
                  <div
                    key={item.productId}
                    className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-white">{item.name}</span>
                    <span className="font-mono text-indigo-300 font-semibold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                      {item.orderedQty} {item.orderedUnit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  הערות מיוחדות למחסן (דחיפות / בקשות)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="הערות לחלוקה או ליקוט..."
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>שלח הזמנה למחסן</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Install App Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}
