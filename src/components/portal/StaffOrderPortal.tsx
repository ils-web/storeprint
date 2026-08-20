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
  addTenantDepartment,
} from '../../services/multiTenantDb';
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
  Send,
  AlertCircle,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

interface StaffOrderPortalProps {
  initialTenantId?: string;
  onBackToMain?: () => void;
}

export function StaffOrderPortal({ initialTenantId, onBackToMain }: StaffOrderPortalProps) {
  const tenants = getTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    initialTenantId || (tenants.length > 0 ? tenants[0].id : '')
  );

  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const warehouses = getWarehouses(selectedTenantId);
  const activeWarehouse = warehouses[0] || null;

  const departments = getTenantDepartments(selectedTenantId);
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string>('');
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
        orderedUnit: unit || product.unit || 'pcs',
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
      alert('Пожалуйста, выберите или укажите ваше отделение.');
      return;
    }
    if (cartItemsList.length === 0) {
      alert('Корзина пуста. Добавьте хотя бы один товар.');
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
      alert(err.message || 'Ошибка отправки заказа');
    }
  };

  const pastOrders = useMemo(() => {
    return getTenantOrders(selectedTenantId);
  }, [selectedTenantId, orderSuccessNumber]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24">
      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-4 py-3 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToMain && (
              <button
                onClick={onBackToMain}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition-colors cursor-pointer"
                title="Назад"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-white">Портал Заказа</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 uppercase">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">{activeTenant?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                <h4 className="font-bold text-white text-sm">Заказ успешно оформлен!</h4>
                <p className="text-xs text-emerald-300 mt-0.5">
                  Номер заказа: <strong className="font-mono">{orderSuccessNumber}</strong>. Склад уже видит вашу заявку и готовит к сборке.
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
              Отделение / Палата
            </label>
            <span className="text-[11px] text-slate-400">Укажите ваше отделение</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={selectedDepartmentName}
              onChange={(e) => setSelectedDepartmentName(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Выберите отделение из списка --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
              <option value="custom">+ Ввести другое отделение...</option>
            </select>

            {selectedDepartmentName === 'custom' ? (
              <input
                type="text"
                placeholder="Введите название отделения"
                onChange={(e) => setSelectedDepartmentName(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            ) : (
              <input
                type="text"
                placeholder="Или напишите вручную (e.g. ג' 2)"
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
            <span>Каталог товаров</span>
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
            <span>История заказов ({pastOrders.length})</span>
          </button>
        </div>

        {/* TAB: CATALOG */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск товара по названию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Products List */}
            <div className="space-y-3">
              {filteredProducts.map((product) => {
                const inCart = cart[product.id];
                const qty = inCart ? inCart.orderedQty : 0;
                const unit = inCart?.orderedUnit || product.unit || 'pcs';

                return (
                  <div
                    key={product.id}
                    className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm hover:border-slate-600 transition-all"
                  >
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-white text-right leading-snug" dir="rtl">
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                        <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-mono">
                          Остаток: {product.currentStock} {product.unit || 'шт'}
                        </span>
                        {product.minThreshold && (
                          <span className="text-[11px] text-slate-500">
                            Мин: {product.minThreshold}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Controls with Packaging Units */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/60">
                      {/* Unit Selector */}
                      <select
                        value={unit}
                        onChange={(e) => handleUnitChange(product, e.target.value as PackagingUnit)}
                        className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-indigo-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        {STANDARD_PACKAGING_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.labelRu} ({u.labelHe})
                          </option>
                        ))}
                      </select>

                      {/* Plus/Minus Counter */}
                      <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700 p-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(product, unit, -1)}
                          disabled={qty <= 0}
                          className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-8 text-center text-xs font-bold text-white font-mono">
                          {qty}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleUpdateQty(product, unit, 1)}
                          className="p-1.5 text-indigo-400 hover:text-white rounded-lg transition-colors cursor-pointer"
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
                  <p className="text-sm font-medium">Товары не найдены</p>
                  <p className="text-xs text-slate-500 mt-1">Попробуйте изменить поисковый запрос</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: MY ORDERS */}
        {activeTab === 'my_orders' && (
          <div className="space-y-3">
            {pastOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-indigo-300">{order.orderNumber}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        order.status === 'PRINTED' || order.status === 'ISSUED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {order.status === 'PRINTED'
                        ? 'Напечатан / В сборке'
                        : order.status === 'ISSUED'
                        ? 'Выдан'
                        : 'Новый заказ'}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-xs text-slate-300">
                  <strong>Отделение:</strong> {order.departmentName}
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-300">
                      <span className="truncate max-w-[200px]">{item.name}</span>
                      <span className="font-mono font-bold text-indigo-400">
                        {item.orderedQty} {item.orderedUnit || 'шт'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {pastOrders.length === 0 && (
              <div className="py-12 text-center text-slate-400 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                <Clock className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium">История заказов пуста</p>
                <p className="text-xs text-slate-500 mt-1">Оформите первый заказ во вкладке "Каталог товаров"</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Sticky Cart Banner */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-3xl mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl shadow-xl shadow-indigo-500/30 flex items-between justify-between font-bold text-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>В корзине: {cartItemsList.length} позиций ({totalCartCount} ед.)</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Оформить заказ</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Modal / Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg text-white">Оформление заявки</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-0.5">Получатель (Отделение):</span>
                <strong className="text-white text-sm">
                  {selectedDepartmentName || 'Не указано (пожалуйста, укажите выше)'}
                </strong>
              </div>

              {/* Items in Cart */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Выбранные позиции ({cartItemsList.length})
                </span>
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2 max-h-48 overflow-y-auto">
                  {cartItemsList.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between text-xs text-slate-200">
                      <span className="truncate max-w-[220px]">{item.name}</span>
                      <span className="font-mono font-bold text-indigo-400">
                        {item.orderedQty} {item.orderedUnit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Примечание для склада (опционально)
                </label>
                <textarea
                  rows={2}
                  placeholder="Срочно к 12:00 / Доставить в процедурную"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm cursor-pointer"
                >
                  Продолжить выбор
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Отправить на склад</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
