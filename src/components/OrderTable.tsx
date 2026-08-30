import React, { useState, useMemo } from 'react';
import {
  Printer,
  Eye,
  Search,
  CheckSquare,
  Square,
  CheckCircle,
  Clock,
  Building2,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileCheck,
  Calendar,
  Filter,
  RotateCcw,
  Copy,
  Trash2,
} from 'lucide-react';
import { Order, StockItem } from '../types';
import {
  getIsraelWeekRange,
  isDateInWeek,
  isDateToday,
  isDateInLastDays,
  isDateInCurrentMonth,
  isDateInCustomRange,
  formatIsraelDate,
} from '../utils/dateUtils';

type PeriodFilterType = 'week' | 'today' | 'last7' | 'last30' | 'month' | 'custom' | 'all';

interface OrderTableProps {
  orders: Order[];
  departments: string[];
  stock: Record<string, StockItem>;
  selectedOrderIds: string[];
  onToggleSelectOrder: (id: string) => void;
  onSelectAllOrders: (selected: boolean) => void;
  onSinglePrint: (order: Order) => void;
  onDirectCopyPrint: (order: Order) => void;
  onPreviewOrder: (order: Order) => void;
  onMassPrint: () => void;
  onTogglePrintedStatus: (orderId: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  isSheetLoaded: boolean;
}

const PERIOD_FILTER_KEY = 'storeprint_orders_period_filter_v1';
const DEPT_FILTER_KEY = 'storeprint_orders_dept_filter_v1';
const STATUS_FILTER_KEY = 'storeprint_orders_status_filter_v1';
const CUSTOM_FROM_KEY = 'storeprint_orders_custom_from_v1';
const CUSTOM_TO_KEY = 'storeprint_orders_custom_to_v1';

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  departments,
  stock,
  selectedOrderIds,
  onToggleSelectOrder,
  onSelectAllOrders,
  onSinglePrint,
  onDirectCopyPrint,
  onPreviewOrder,
  onMassPrint,
  onTogglePrintedStatus,
  onDeleteOrder,
  isSheetLoaded,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    try {
      return localStorage.getItem(DEPT_FILTER_KEY) || 'ALL';
    } catch {
      return 'ALL';
    }
  });

  const [statusFilter, setStatusFilter] = useState<'all' | 'unprinted' | 'printed'>(() => {
    try {
      const saved = localStorage.getItem(STATUS_FILTER_KEY);
      return saved === 'unprinted' || saved === 'printed' ? saved : 'all';
    } catch {
      return 'all';
    }
  });

  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>(() => {
    try {
      const saved = localStorage.getItem(PERIOD_FILTER_KEY);
      const valid: PeriodFilterType[] = ['all', 'today', 'week', 'last7', 'last30', 'month', 'custom'];
      return saved && valid.includes(saved as PeriodFilterType) ? (saved as PeriodFilterType) : 'today';
    } catch {
      return 'today';
    }
  });

  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    try {
      return localStorage.getItem(CUSTOM_FROM_KEY) || '';
    } catch {
      return '';
    }
  });

  const [customToDate, setCustomToDate] = useState<string>(() => {
    try {
      return localStorage.getItem(CUSTOM_TO_KEY) || '';
    } catch {
      return '';
    }
  });

  const handlePeriodChange = (val: PeriodFilterType) => {
    setPeriodFilter(val);
    try {
      localStorage.setItem(PERIOD_FILTER_KEY, val);
    } catch {}
  };

  const handleDeptChange = (val: string) => {
    setSelectedDept(val);
    try {
      localStorage.setItem(DEPT_FILTER_KEY, val);
    } catch {}
  };

  const handleStatusChange = (val: 'all' | 'unprinted' | 'printed') => {
    setStatusFilter(val);
    try {
      localStorage.setItem(STATUS_FILTER_KEY, val);
    } catch {}
  };

  const handleCustomFromChange = (val: string) => {
    setCustomFromDate(val);
    try {
      localStorage.setItem(CUSTOM_FROM_KEY, val);
    } catch {}
  };

  const handleCustomToChange = (val: string) => {
    setCustomToDate(val);
    try {
      localStorage.setItem(CUSTOM_TO_KEY, val);
    } catch {}
  };

  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Current Israel week range
  const currentWeek = useMemo(() => getIsraelWeekRange(), []);

  // Toggle accordion expand/collapse for an order
  const toggleExpand = (id: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter orders by period, search, dept, status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Period / Date filter
      if (periodFilter === 'today') {
        if (!isDateToday(order.parsedDate)) return false;
      } else if (periodFilter === 'week') {
        if (!isDateInWeek(order.parsedDate, currentWeek)) return false;
      } else if (periodFilter === 'last7') {
        if (!isDateInLastDays(order.parsedDate, 7)) return false;
      } else if (periodFilter === 'last30') {
        if (!isDateInLastDays(order.parsedDate, 30)) return false;
      } else if (periodFilter === 'month') {
        if (!isDateInCurrentMonth(order.parsedDate)) return false;
      } else if (periodFilter === 'custom') {
        if (!isDateInCustomRange(order.parsedDate, customFromDate, customToDate)) return false;
      }
      // 'all' includes everything

      // 2. Dept filter
      if (selectedDept !== 'ALL' && order.department !== selectedDept) {
        return false;
      }

      // 3. Printed status filter
      if (statusFilter === 'unprinted' && order.printed) return false;
      if (statusFilter === 'printed' && !order.printed) return false;

      // 4. Search term filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesDept = order.department.toLowerCase().includes(query);
        const matchesTime = order.timestamp.toLowerCase().includes(query);
        const matchesItems = order.items.some((it) => it.name.toLowerCase().includes(query));
        if (!matchesId && !matchesDept && !matchesTime && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    periodFilter,
    currentWeek,
    customFromDate,
    customToDate,
    selectedDept,
    statusFilter,
    searchTerm,
  ]);

  const safeSelectedOrderIds = useMemo(() => {
    return Array.isArray(selectedOrderIds) ? selectedOrderIds : [];
  }, [selectedOrderIds]);

  const isAllSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => safeSelectedOrderIds.includes(o.id));

  // Determine currently selected department
  const selectedOrders = useMemo(() => {
    return orders.filter((o) => safeSelectedOrderIds.includes(o.id));
  }, [orders, safeSelectedOrderIds]);

  const activeSelectedDept = useMemo(() => {
    return selectedOrders.length > 0 ? selectedOrders[0].department : null;
  }, [selectedOrders]);

  const handleToggleSelectSingleDept = (order: Order) => {
    onToggleSelectOrder(order.id);
  };

  const handleSelectAllSingleDept = (select: boolean) => {
    if (!select) {
      onSelectAllOrders(false);
      return;
    }
    const targetDept = selectedDept !== 'ALL' ? selectedDept : filteredOrders[0]?.department;
    if (!targetDept) return;
    const deptOrderIds = filteredOrders
      .filter((o) => o.department === targetDept)
      .map((o) => o.id);
    onSelectAllOrders(deptOrderIds as any);
  };

  // Count printed and pending for filtered set
  const counts = useMemo(() => {
    let printed = 0;
    let unprinted = 0;
    filteredOrders.forEach((o) => {
      if (o.printed) printed++;
      else unprinted++;
    });
    return { all: filteredOrders.length, printed, unprinted };
  }, [filteredOrders]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden" dir="rtl">
      
      {/* Top Filter Bar: Period, Department, Search & Status */}
      <div className="p-4 bg-slate-50/90 border-b border-slate-200 space-y-3">
        
        {/* Row 1: Search & Period Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="חיפוש לפי שם מחלקה, פריט, תאריך או מספר הזמנה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-2xl pr-9 pl-4 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Period Filter Selector */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Period Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-2xl px-3 py-1.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500">תקופה:</span>
              <select
                value={periodFilter}
                onChange={(e) => handlePeriodChange(e.target.value as PeriodFilterType)}
                className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="today">היום בלבד</option>
                <option value="week">השבוע הנוכחי</option>
                <option value="last7">7 ימים אחרונים</option>
                <option value="last30">30 ימים אחרונים</option>
                <option value="month">החודש הנוכחי</option>
                <option value="custom">טווח תאריכים מותאם...</option>
                <option value="all">כל השנה (כל ההזמנות)</option>
              </select>
            </div>

            {/* Custom Date Pickers */}
            {periodFilter === 'custom' && (
              <div className="flex items-center gap-1.5 bg-white border border-sky-300 rounded-2xl px-2.5 py-1 text-xs">
                <span className="text-[11px] font-bold text-slate-500">מ-:</span>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => handleCustomFromChange(e.target.value)}
                  className="text-xs font-semibold focus:outline-none"
                />
                <span className="text-[11px] font-bold text-slate-500">עד:</span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => handleCustomToChange(e.target.value)}
                  className="text-xs font-semibold focus:outline-none"
                />
              </div>
            )}

            {/* Department Select */}
            <div className="relative">
              <select
                value={selectedDept}
                onChange={(e) => handleDeptChange(e.target.value)}
                className="bg-white border border-slate-300 rounded-2xl px-3.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">כל המחלקות ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

          </div>

        </div>

        {/* Row 2: Status Tabs & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/80">
          
          {/* Status Tabs */}
          <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1 text-xs">
            <button
              onClick={() => handleStatusChange('all')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              הכל בתקופה ({counts.all})
            </button>
            <button
              onClick={() => handleStatusChange('unprinted')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === 'unprinted'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ממתינים ({counts.unprinted})
            </button>
            <button
              onClick={() => handleStatusChange('printed')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === 'printed'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              הודפסו ({counts.printed})
            </button>
          </div>

          {/* Active Filter Info & Mass Print */}
          <div className="flex items-center gap-2">
            
            {/* Active Period Badge */}
            <span className="text-[11px] text-slate-500 bg-slate-200/60 border border-slate-300/60 px-2.5 py-1 rounded-xl font-medium hidden sm:inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-sky-600" />
              <span>
                {periodFilter === 'week' && `השבוע: ${currentWeek.formattedRange}`}
                {periodFilter === 'today' && 'סינון: היום בלבד'}
                {periodFilter === 'last7' && 'סינון: 7 ימים אחרונים'}
                {periodFilter === 'last30' && 'סינון: 30 ימים אחרונים'}
                {periodFilter === 'month' && 'סינון: החודש הנוכחי'}
                {periodFilter === 'custom' && 'סינון: טווח מותאם'}
                {periodFilter === 'all' && `כל ההזמנות (${orders.length})`}
              </span>
            </span>

            {/* Mass Print Button (Strictly for single selected department) */}
            {safeSelectedOrderIds.length > 0 && (
              <button
                onClick={onMassPrint}
                className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-xs font-black px-4 py-1.5 rounded-2xl shadow-md shadow-sky-600/20 flex items-center gap-1.5 transition-all transform active:scale-95 animate-pulse cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {activeSelectedDept
                    ? `הדפס הזמנות מחלקת ${activeSelectedDept} (${safeSelectedOrderIds.length})`
                    : `הדפס נבחרים (${safeSelectedOrderIds.length})`}
                </span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
              <th className="py-3.5 px-4 w-12 text-center">
                <button
                  onClick={() => handleSelectAllSingleDept(!isAllSelected)}
                  className="text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                  title={isAllSelected ? 'בטל בחירה' : 'בחר כל הזמנות המחלקה'}
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-sky-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="py-3.5 px-4 w-32">תאריך ושעה</th>
              <th className="py-3.5 px-4 w-48">מחלקה / סקטור</th>
              <th className="py-3.5 px-4">פריטים שהוזמנו</th>
              <th className="py-3.5 px-4 w-28 text-center">כמות פריטים</th>
              <th className="py-3.5 px-4 w-28 text-center">סטטוס</th>
              <th className="py-3.5 px-4 w-36 text-center">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-500">
                  <div className="max-w-md mx-auto space-y-2">
                    <Package className="w-10 h-10 text-slate-300 mx-auto" />
                    <div className="font-bold text-slate-700 text-sm">לא נמצאו הזמנות</div>
                    <p className="text-xs text-slate-400">
                      נסו לשנות את מונח החיפוש, לבחור תקופה אחרת או לסנן לפי מחלקה.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = safeSelectedOrderIds.includes(order.id);
                const isExpanded = expandedOrderIds.has(order.id);

                return (
                  <React.Fragment key={order.id}>
                    <tr
                      className={`transition-colors hover:bg-sky-50/40 ${
                        isSelected
                          ? 'bg-sky-50/70'
                          : order.printed
                          ? 'bg-emerald-50/20'
                          : ''
                      }`}
                    >
                      {/* Selection Checkbox (Single Department Locked) */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleSelectSingleDept(order)}
                          className="text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{order.timestamp}</span>
                        </div>
                      </td>

                      {/* Department with Printed Indicator */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div
                              className={`p-1.5 rounded-xl shrink-0 ${
                                order.printed
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-sky-100 text-sky-700'
                              }`}
                            >
                              <Building2 className="w-4 h-4" />
                            </div>
                            <span className="font-extrabold text-slate-900 text-sm">
                              {order.department}
                            </span>
                            {(order.id.startsWith('pwa-') || order.id.startsWith('order-')) && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 shrink-0">
                                📲 אפליקציה
                              </span>
                            )}
                          </div>
                          {order.printed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-md">
                              <FileCheck className="w-3 h-3" />
                              <span>הודפס למחלקה זו</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Items Preview with Expand/Collapse toggle */}
                      <td className="py-3.5 px-4">
                        {order.items.length === 0 ? (
                          <span className="text-slate-400 italic">לא נבחרו פריטים בהזמנה</span>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Display first 5 items */}
                              {order.items.slice(0, 5).map((item) => {
                                const stockItem = stock[item.name];
                                const isLow = stockItem && stockItem.currentStock < (stockItem.minThreshold || 10);
                                const isOut = stockItem && stockItem.currentStock === 0;

                                return (
                                  <span
                                    key={item.id}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] border transition-colors font-medium ${
                                      isOut
                                        ? 'bg-slate-100 text-slate-600 border-slate-300 line-through'
                                        : isLow
                                        ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                                        : 'bg-slate-50 text-slate-800 border-slate-200'
                                    }`}
                                  >
                                    <span>{item.name}</span>
                                    <span className="font-mono font-bold bg-white px-1.5 py-0.2 rounded-md text-[10px] border border-slate-200">
                                      {item.qty}
                                    </span>
                                  </span>
                                );
                              })}

                              {/* Expand/Collapse Button */}
                              {order.items.length > 5 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(order.id)}
                                  className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold px-2.5 py-1 rounded-xl text-[11px] transition-colors cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <>
                                      <span>הסתר פריטים</span>
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      <span>+{order.items.length - 5} נוספים (הצג הכל)</span>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Items Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-slate-100 text-slate-800 font-black px-3 py-1 rounded-full text-xs border border-slate-200">
                          {order.items.length} פריטים
                        </span>
                      </td>

                      {/* Print Status Badge with Manual Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onTogglePrintedStatus(order.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                            order.printed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                          title="לחץ לשינוי סטטוס הדפסה"
                        >
                          {order.printed ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>הודפס ✓</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>ממתין ⏱</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Action Buttons: Print, Copy Print, Preview, Delete */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Print with Stock Control */}
                          <button
                            onClick={() => onSinglePrint(order)}
                            className="bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-xl shadow-xs transition-transform active:scale-90 cursor-pointer"
                            title="הדפסה ובקרת מלאי"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Direct Copy Print (NO stock deduction guaranteed) */}
                          <button
                            onClick={() => onDirectCopyPrint(order)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 p-2 rounded-xl shadow-xs transition-transform active:scale-90 cursor-pointer"
                            title="הדפסת העתק (ללא קיזוז מהמלאי)"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Preview */}
                          <button
                            onClick={() => onPreviewOrder(order)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition-colors cursor-pointer"
                            title="תצוגה מקדימה"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Delete Order (Safe Deletion) */}
                          {onDeleteOrder && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `האם אתה בטוח שברצונך למחוק את הזמנת מחלקת ${order.department} (${order.timestamp})?`
                                  )
                                ) {
                                  onDeleteOrder(order.id);
                                }
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 p-2 rounded-xl transition-colors cursor-pointer"
                              title="מחק הזמנה זו מהמאגר"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>

                    {/* Expandable Accordion with Complete Item List */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-200">
                        <td colSpan={7} className="p-4 sm:p-5">
                          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                              <div className="font-black text-slate-900 text-xs flex items-center gap-2">
                                <Package className="w-4 h-4 text-sky-600" />
                                <span>
                                  פירוט מלא של כל הפריטים להזמנה של מחלקת {order.department} ({order.items.length} פריטים)
                                </span>
                              </div>
                              <button
                                onClick={() => toggleExpand(order.id)}
                                className="text-slate-400 hover:text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <span>סגור</span>
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                              {order.items.map((item, idx) => {
                                const stockItem = stock[item.name];
                                const isLow = stockItem && stockItem.currentStock < (stockItem.minThreshold || 10);
                                const isOut = stockItem && stockItem.currentStock === 0;

                                return (
                                  <div
                                    key={item.id}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                                      isOut
                                        ? 'bg-slate-50 border-slate-200'
                                        : isLow
                                        ? 'bg-red-50 border-red-200'
                                        : 'bg-slate-50/60 border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <span className="font-mono text-[10px] text-slate-400 font-bold w-5 shrink-0">
                                        #{idx + 1}
                                      </span>
                                      <span className="font-bold text-slate-900 truncate" title={item.name}>
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="bg-sky-600 text-white px-2 py-0.5 rounded-lg font-black text-xs">
                                        {item.qty}
                                      </span>
                                      {stockItem && (
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            isLow
                                              ? 'text-red-700 bg-red-100'
                                              : 'text-slate-500 bg-slate-200'
                                          }`}
                                          title="יתרה במחסן"
                                        >
                                          מלאי: {stockItem.currentStock}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div>
          מוצגות הזמנות: <strong>{filteredOrders.length}</strong> מתוך <strong>{orders.length}</strong>
        </div>
        <div className="text-slate-400">
          * בלחיצה על «הדפסה» נפתח חלון אישור ובקרת מלאי. בלחיצה על «העתק» מודפסת העתקה ללא שום קיזוז מהמלאי
        </div>
      </div>
    </div>
  );
};
