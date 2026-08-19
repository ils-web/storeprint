import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  Printer,
  Building2,
  User,
  FileText,
  Package,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { StockItem, CloudSyncConfig } from '../types';
import { PACKAGING_UNITS } from './WarehouseView';
import { submitDepartmentOrderToCloud, DepartmentOrderPayload } from '../utils/cloudSync';

interface DepartmentOrderViewProps {
  productHeaders: string[];
  stock: Record<string, StockItem>;
  departments: string[];
  cloudConfig: CloudSyncConfig;
  onOrderSubmitted?: () => void;
}

const SAVED_DEPT_STORAGE_KEY = 'storeprint_saved_department';
const SAVED_REQUESTER_STORAGE_KEY = 'storeprint_saved_requester';

export const DepartmentOrderView: React.FC<DepartmentOrderViewProps> = ({
  productHeaders,
  stock,
  departments,
  cloudConfig,
  onOrderSubmitted,
}) => {
  // Department & Requester Info
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    return localStorage.getItem(SAVED_DEPT_STORAGE_KEY) || (departments[0] || '');
  });
  const [customDept, setCustomDept] = useState<string>('');
  const [isCustomDept, setIsCustomDept] = useState<boolean>(false);
  const [requesterName, setRequesterName] = useState<string>(() => {
    return localStorage.getItem(SAVED_REQUESTER_STORAGE_KEY) || '';
  });
  const [patientsCount, setPatientsCount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showOnlyInCart, setShowOnlyInCart] = useState<boolean>(false);

  // Cart: item name -> { qty: number, unit: string }
  const [cart, setCart] = useState<Record<string, { qty: number; unit: string }>>({});
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderId: string;
    timestamp: string;
    department: string;
    items: { name: string; qty: number; unit: string }[];
    notes?: string;
  } | null>(null);

  // Save selected department to local storage
  useEffect(() => {
    const dept = isCustomDept ? customDept : selectedDept;
    if (dept) localStorage.setItem(SAVED_DEPT_STORAGE_KEY, dept);
  }, [selectedDept, customDept, isCustomDept]);

  useEffect(() => {
    if (requesterName) localStorage.setItem(SAVED_REQUESTER_STORAGE_KEY, requesterName);
  }, [requesterName]);

  // Unique list of departments from previous orders + standard
  const availableDepts = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => {
      const clean = d.trim();
      if (clean && clean.length > 1) set.add(clean);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
  }, [departments]);

  // Cart summary stats
  const cartItemsList = useMemo(() => {
    return Object.keys(cart)
      .filter((name) => cart[name].qty > 0)
      .map((name) => ({
        name,
        qty: cart[name].qty,
        unit: cart[name].unit || stock[name]?.unit || "יח'",
      }));
  }, [cart, stock]);

  const totalCartUnits = useMemo(() => {
    return cartItemsList.reduce((sum, item) => sum + item.qty, 0);
  }, [cartItemsList]);

  // Filtered Catalog
  const filteredProducts = useMemo(() => {
    let list = productHeaders.filter((h) => h.trim().length > 0);

    if (showOnlyInCart) {
      list = list.filter((name) => (cart[name]?.qty || 0) > 0);
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      list = list.filter((name) => name.toLowerCase().includes(q));
    }

    return list;
  }, [productHeaders, searchTerm, showOnlyInCart, cart]);

  // Add / Update item in cart
  const setItemQty = (name: string, newQty: number, unit?: string) => {
    const defaultUnit = stock[name]?.unit || "יח'";
    setCart((prev) => {
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return {
        ...prev,
        [name]: {
          qty: newQty,
          unit: unit || prev[name]?.unit || defaultUnit,
        },
      };
    });
  };

  const stepItemQty = (name: string, delta: number) => {
    const current = cart[name]?.qty || 0;
    setItemQty(name, Math.max(0, current + delta));
  };

  const clearCart = () => {
    setCart({});
  };

  // Submit Order to Google Sheets
  const handleSubmitOrder = async () => {
    const activeDept = (isCustomDept ? customDept : selectedDept).trim();
    if (!activeDept) {
      setSubmitError('נא לבחור או להזין את שם המחלקה המזמינה');
      return;
    }

    if (cartItemsList.length === 0) {
      setSubmitError('סל ההזמנה ריק. נא לבחור לפחות פריט אחד.');
      return;
    }

    if (!cloudConfig.endpointUrl) {
      setSubmitError('קישור הענן (Apps Script) אינו מוגדר. פנה למנהל המחסן.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: DepartmentOrderPayload = {
      department: activeDept,
      orderedBy: requesterName.trim(),
      patientsCount: patientsCount.trim(),
      notes: notes.trim(),
      items: cart,
    };

    try {
      const res = await submitDepartmentOrderToCloud(payload, cloudConfig);
      if (res.success) {
        setSubmittedOrder({
          orderId: res.orderId || `ORD-${Date.now().toString().slice(-6)}`,
          timestamp: res.timestamp || new Date().toLocaleString('he-IL'),
          department: activeDept,
          items: cartItemsList,
          notes: notes.trim(),
        });
        clearCart();
        setIsCartOpen(false);
        if (onOrderSubmitted) onOrderSubmitted();
      } else {
        setSubmitError(res.message || 'שגיאה בשליחת ההזמנה');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'שגיאת תקשורת');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Order Receipt
  const handlePrintReceipt = () => {
    if (!submittedOrder) return;
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4 text-slate-900" dir="rtl">
      
      {/* SUCCESS CONFIRMATION SCREEN */}
      {submittedOrder ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-200 text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              ההזמנה נשלחה בהצלחה למחסן! 🎉
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              ההזמנה נרשמה ישירות בטבלת ה-Google Sheets ותטופל בהקדם על ידי צוות המחסן.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-right text-xs space-y-2 max-w-lg mx-auto">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">מספר אסמכתה:</span>
              <span className="font-mono font-black text-sky-700">{submittedOrder.orderId}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">מחלקה מזמינה:</span>
              <span className="font-bold text-slate-900">{submittedOrder.department}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">זמן שליחה:</span>
              <span className="font-mono text-slate-700">{submittedOrder.timestamp}</span>
            </div>
            {submittedOrder.notes && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">הערות:</span>
                <span className="font-medium text-slate-800">{submittedOrder.notes}</span>
              </div>
            )}
            <div className="pt-2">
              <span className="font-bold text-slate-900 block mb-1.5">פירוט פריטים שהוזמנו ({submittedOrder.items.length}):</span>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {submittedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] bg-white p-1.5 rounded-lg border border-slate-200">
                    <span className="font-medium">{it.name}</span>
                    <span className="font-black text-sky-700">{it.qty} {it.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setSubmittedOrder(null)}
              className="bg-sky-600 hover:bg-sky-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              הזמנה חדשה ➕
            </button>
            <button
              onClick={handlePrintReceipt}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-3 rounded-2xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>הדפס אישור הזמנה</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TOP DEPARTMENT HEADER CARD */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-tr from-sky-500 to-indigo-600 text-white rounded-2xl shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900">
                    טופס הזמנת ציוד למחלקה
                  </h1>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    הזנה ושליחה מהירה ישירות לטבלת המחסן המרכזית
                  </p>
                </div>
              </div>

              {/* Status cloud badge */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>חיבור ישיר למחסן</span>
                </span>
              </div>
            </div>

            {/* Department Selection Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              
              {/* Department Dropdown / Input */}
              <div className="space-y-1 sm:col-span-1">
                <label className="font-black text-slate-700 block">
                  מחלקה / סקטור מזמין: <span className="text-red-500">*</span>
                </label>
                {!isCustomDept ? (
                  <div className="flex gap-1.5">
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      {availableDepts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCustomDept(true)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 rounded-xl border border-slate-300 font-bold"
                      title="הקלד שם מחלקה אחרת"
                    >
                      אחר
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="הקלד שם מחלקה..."
                      value={customDept}
                      onChange={(e) => setCustomDept(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomDept(false)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 rounded-xl border border-slate-300 font-bold"
                    >
                      מרשימה
                    </button>
                  </div>
                )}
              </div>

              {/* Requester Name */}
              <div className="space-y-1 sm:col-span-1">
                <label className="font-black text-slate-700 block">
                  שם המזמין / איש קשר:
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="לדוגמה: אחות אחראית..."
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-8 pl-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Notes / Urgency */}
              <div className="space-y-1 sm:col-span-1">
                <label className="font-black text-slate-700 block">
                  הערות / דחיפות / כמות מטופלים:
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="הערה למחסן..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-8 pl-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* SEARCH & CATALOG TOOLBAR */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              
              {/* Search Field */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="חיפוש פריט לפי שם בעברית או באנגלית..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl pr-10 pl-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Toggle Show Cart Only */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOnlyInCart(!showOnlyInCart)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    showOnlyInCart
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>נבחרו בסל ({cartItemsList.length})</span>
                </button>
              </div>

            </div>
          </div>

          {/* PRODUCT CATALOG LIST / CARDS */}
          <div className="space-y-2.5 pb-24">
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center text-slate-400 space-y-2 border border-slate-200">
                <Package className="w-8 h-8 mx-auto text-slate-300" />
                <div className="font-bold text-sm">לא נמצאו פריטים מתאימים לחיפוש</div>
                <div className="text-xs">נסה לחפש במילים אחרות או נקה את שורת החיפוש</div>
              </div>
            ) : (
              filteredProducts.map((name, index) => {
                const stockItem = stock[name];
                const cartEntry = cart[name];
                const inCartQty = cartEntry?.qty || 0;
                const activeUnit = cartEntry?.unit || stockItem?.unit || "יח'";
                const currentStock = stockItem ? stockItem.currentStock : null;

                return (
                  <div
                    key={name}
                    className={`bg-white rounded-2xl p-3 sm:p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      inCartQty > 0
                        ? 'border-sky-500 bg-sky-50/20 shadow-xs ring-1 ring-sky-400/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Item Info */}
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5 mt-0.5 shrink-0">
                        #{index + 1}
                      </span>
                      <div className="space-y-1">
                        <h3 className="font-black text-xs sm:text-sm text-slate-900 leading-tight">
                          {name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          {/* Warehouse availability indicator */}
                          {currentStock !== null && (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                currentStock > 10
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : currentStock > 0
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              <span>
                                {currentStock > 10
                                  ? '🟢 במלאי'
                                  : currentStock > 0
                                  ? `⚠️ נותרו ${currentStock}`
                                  : '⚪ חסר במחסן'}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Unit Steppers */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      
                      {/* Packaging Unit Selector */}
                      <select
                        value={activeUnit}
                        onChange={(e) => setItemQty(name, inCartQty > 0 ? inCartQty : 1, e.target.value)}
                        className="bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-bold py-1.5 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                        title="בחר סוג אריזה"
                      >
                        {PACKAGING_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>

                      {/* Stepper Buttons */}
                      <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => stepItemQty(name, -1)}
                          disabled={inCartQty <= 0}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 disabled:opacity-30 text-slate-800 font-black text-sm flex items-center justify-center shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={0}
                          value={inCartQty === 0 ? '' : inCartQty}
                          placeholder="0"
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            setItemQty(name, isNaN(parsed) ? 0 : Math.max(0, parsed));
                          }}
                          className="w-12 text-center text-xs font-black text-slate-900 bg-transparent focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => stepItemQty(name, 1)}
                          className="w-8 h-8 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-sm flex items-center justify-center shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* FLOATING BOTTOM CART BAR */}
          {cartItemsList.length > 0 && (
            <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 animate-slideUp">
              <div className="bg-slate-900 text-white rounded-3xl p-3.5 sm:p-4 shadow-2xl border border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                    {cartItemsList.length}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">
                      {totalCartUnits} יח' / פריטים בסל
                    </div>
                    <div className="text-[11px] text-slate-400">
                      למחלקה: {(isCustomDept ? customDept : selectedDept) || 'לא נבחרה'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <span>המשך להזמנה ➔</span>
                </button>
              </div>
            </div>
          )}

          {/* CART & CHECKOUT MODAL */}
          {isCartOpen && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden space-y-4">
                
                {/* Modal Header */}
                <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center space-x-reverse space-x-2.5">
                    <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black">
                        סיכום הזמנה למחלקה
                      </h2>
                      <p className="text-xs text-slate-400">
                        מחלקה: {(isCustomDept ? customDept : selectedDept) || 'לא נבחרה'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-5 space-y-4 max-h-96 overflow-y-auto text-xs">
                  
                  {/* Items List in Cart */}
                  <div className="space-y-2">
                    <div className="font-black text-slate-800 flex justify-between">
                      <span>פריטים שנבחרו:</span>
                      <button
                        onClick={clearCart}
                        className="text-red-600 hover:text-red-700 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>נקה סל</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 border border-slate-200 rounded-2xl p-2 max-h-56 overflow-y-auto">
                      {cartItemsList.map((it) => (
                        <div
                          key={it.name}
                          className="flex items-center justify-between bg-slate-50 p-2 rounded-xl text-xs"
                        >
                          <span className="font-bold text-slate-800 flex-1 pr-1">{it.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded-lg text-xs">
                              {it.qty} {it.unit}
                            </span>
                            <button
                              onClick={() => setItemQty(it.name, 0)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="הסר מהסל"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submission Error Banner */}
                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    חזור לעריכה
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting || cartItemsList.length === 0}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>שולח הזמנה לטבלה...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>🚀 שלח הזמנה למחסן</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
