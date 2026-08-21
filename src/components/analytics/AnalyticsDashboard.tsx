import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Building2,
  Package,
  Calendar,
  Filter,
  Printer,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  Sparkles,
  Flame,
  Snowflake,
  FileSpreadsheet,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { Order, StockItem } from '../../types';
import {
  getIsraelWeekRange,
  isDateInWeek,
  isDateToday,
  isDateInLastDays,
  isDateInCurrentMonth,
  isDateInCustomRange,
} from '../../utils/dateUtils';

type AnalyticsPeriod = 'week' | 'today' | 'last7' | 'last30' | 'month' | 'custom' | 'all';

interface AnalyticsDashboardProps {
  orders: Order[];
  stock: Record<string, StockItem>;
  departments: string[];
  tenantName?: string;
}

/**
 * Safely extracts a numeric quantity from any cell value (e.g. "12 קרטון" -> 12, 5 -> 5, "0" -> 0)
 */
function parseNumericQty(qty: any): number {
  if (typeof qty === 'number') {
    return isNaN(qty) ? 0 : qty;
  }
  if (!qty) return 0;
  const str = String(qty).trim();
  const match = str.match(/(\d+(\.\d+)?)/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  orders,
  stock,
  departments,
  tenantName = 'מרכז רפואי',
}) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const currentWeek = useMemo(() => getIsraelWeekRange(), []);

  // Filter orders by selected period
  const periodOrders = useMemo(() => {
    return orders.filter((order) => {
      if (period === 'today') return isDateToday(order.parsedDate);
      if (period === 'week') return isDateInWeek(order.parsedDate, currentWeek);
      if (period === 'last7') return isDateInLastDays(order.parsedDate, 7);
      if (period === 'last30') return isDateInLastDays(order.parsedDate, 30);
      if (period === 'month') return isDateInCurrentMonth(order.parsedDate);
      if (period === 'custom') return isDateInCustomRange(order.parsedDate, customFrom, customTo);
      return true; // 'all'
    });
  }, [orders, period, currentWeek, customFrom, customTo]);

  // Aggregate statistics per department
  const departmentStats = useMemo(() => {
    const deptMap: Record<
      string,
      {
        deptName: string;
        orderCount: number;
        totalItemsCount: number;
        itemsBreakdown: Record<string, number>;
        lastOrderDate: string;
      }
    > = {};

    // Initialize with known departments
    departments.forEach((d) => {
      if (d) {
        deptMap[d] = {
          deptName: d,
          orderCount: 0,
          totalItemsCount: 0,
          itemsBreakdown: {},
          lastOrderDate: '',
        };
      }
    });

    // Populate from orders
    periodOrders.forEach((order) => {
      const d = order.department || 'לא צוין';
      if (!deptMap[d]) {
        deptMap[d] = {
          deptName: d,
          orderCount: 0,
          totalItemsCount: 0,
          itemsBreakdown: {},
          lastOrderDate: order.timestamp,
        };
      }

      deptMap[d].orderCount += 1;
      if (!deptMap[d].lastOrderDate || order.timestamp > deptMap[d].lastOrderDate) {
        deptMap[d].lastOrderDate = order.timestamp;
      }

      order.items.forEach((item) => {
        const numQty = parseNumericQty(item.qty);
        deptMap[d].totalItemsCount += numQty;
        deptMap[d].itemsBreakdown[item.name] =
          (deptMap[d].itemsBreakdown[item.name] || 0) + numQty;
      });
    });

    return Object.values(deptMap).sort((a, b) => b.totalItemsCount - a.totalItemsCount);
  }, [periodOrders, departments]);

  // Aggregate product consumption statistics
  const productStats = useMemo(() => {
    const pMap: Record<
      string,
      {
        productName: string;
        totalOrderedQty: number;
        ordersCount: number;
        orderingDepts: Set<string>;
        currentStock: number;
        unit: string;
      }
    > = {};

    // Initialize with all active stock products
    Object.values(stock).forEach((sItem) => {
      if (sItem && sItem.isActive !== false) {
        pMap[sItem.name] = {
          productName: sItem.name,
          totalOrderedQty: 0,
          ordersCount: 0,
          orderingDepts: new Set<string>(),
          currentStock: sItem.currentStock || 0,
          unit: sItem.unit || "יח'",
        };
      }
    });

    // Accumulate from orders
    periodOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!pMap[item.name]) {
          const s = stock[item.name];
          pMap[item.name] = {
            productName: item.name,
            totalOrderedQty: 0,
            ordersCount: 0,
            orderingDepts: new Set<string>(),
            currentStock: s?.currentStock || 0,
            unit: s?.unit || "יח'",
          };
        }
        const numQty = parseNumericQty(item.qty);
        pMap[item.name].totalOrderedQty += numQty;
        pMap[item.name].ordersCount += 1;
        pMap[item.name].orderingDepts.add(order.department);
      });
    });

    const all = Object.values(pMap);

    const topOrdered = [...all]
      .filter((p) => p.totalOrderedQty > 0)
      .sort((a, b) => b.totalOrderedQty - a.totalOrderedQty);

    const lowOrNoOrders = [...all]
      .filter((p) => p.totalOrderedQty === 0 || p.totalOrderedQty <= 5)
      .sort((a, b) => a.totalOrderedQty - b.totalOrderedQty);

    return { all, topOrdered, lowOrNoOrders };
  }, [periodOrders, stock]);

  // Global KPIs
  const totalOrdersCount = periodOrders.length;
  const totalUnitsDelivered = useMemo(() => {
    return periodOrders.reduce(
      (acc, ord) =>
        acc +
        ord.items.reduce((iAcc, item) => iAcc + parseNumericQty(item.qty), 0),
      0
    );
  }, [periodOrders]);

  const activeDeptsCount = useMemo(() => {
    const set = new Set(periodOrders.map((o) => o.department));
    return set.size;
  }, [periodOrders]);

  const maxDeptUnits = useMemo(() => {
    return departmentStats.length > 0 ? Math.max(1, departmentStats[0].totalItemsCount) : 1;
  }, [departmentStats]);

  // Filtered department list for table
  const filteredDeptStats = useMemo(() => {
    let list = departmentStats;
    if (selectedDeptFilter !== 'ALL') {
      list = list.filter((d) => d.deptName === selectedDeptFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.deptName.toLowerCase().includes(q) ||
          Object.keys(d.itemsBreakdown).some((item) => item.toLowerCase().includes(q))
      );
    }
    return list;
  }, [departmentStats, selectedDeptFilter, searchQuery]);

  // Printable Report Generation
  const handlePrintReport = () => {
    const printWin = window.open('', '_blank', 'width=950,height=800');
    if (!printWin) {
      alert('נא לאפשר חלונות קופצים בדפדפן כדי להדפיס את הדוח.');
      return;
    }

    const periodLabels: Record<AnalyticsPeriod, string> = {
      week: `השבוע הנוכחי (${currentWeek.formattedRange})`,
      today: 'היום בלבד',
      last7: '7 ימים אחרונים',
      last30: '30 ימים אחרונים',
      month: 'החודש הנוכחי',
      custom: `טווח מותאם (${customFrom || 'התחלה'} עד ${customTo || 'היום'})`,
      all: 'כל הזמנים',
    };

    const periodName = periodLabels[period];

    const html = `
      <!DOCTYPE html>
      <html lang="he" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>דוח ריכוז אספקה וצריכה מחלקתית - ${tenantName}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 10px;
            direction: rtl;
            font-size: 12px;
          }
          .header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title { font-size: 20px; font-weight: 900; color: #0369a1; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .meta-box {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 16px;
          }
          .meta-item { text-align: center; }
          .meta-label { font-size: 10px; color: #64748b; font-weight: bold; }
          .meta-val { font-size: 18px; font-weight: 900; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold; }
          td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: right; }
          tr:nth-child(even) td { background: #f8fafc; }
          .section-title { font-size: 14px; font-weight: bold; color: #0f172a; margin: 16px 0 8px 0; border-right: 4px solid #0284c7; padding-right: 8px; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 11px; color: #64748b; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">דוח ריכוז אספקה וצריכה מחלקתית 📊</h1>
            <div class="subtitle">${tenantName} | תקופה: <strong>${periodName}</strong></div>
          </div>
          <div style="text-align: left; font-size: 10px; color: #64748b;">
            הופק בתאריך: ${new Date().toLocaleString('he-IL')}
          </div>
        </div>

        <div class="meta-box">
          <div class="meta-item">
            <div class="meta-label">סה"כ הזמנות בתקופה</div>
            <div class="meta-val">${totalOrdersCount}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">סה"כ פריטים שסופקו</div>
            <div class="meta-val">${totalUnitsDelivered.toLocaleString('he-IL')}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">מחלקות פעילות</div>
            <div class="meta-val">${activeDeptsCount}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">פריט מוביל</div>
            <div class="meta-val" style="font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${productStats.topOrdered[0]?.productName || 'אין נתונים'}
            </div>
          </div>
        </div>

        <div class="section-title">1. ריכוז פעילות לפי מחלקות</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>שם המחלקה</th>
              <th style="width: 90px; text-align: center;">מספר הזמנות</th>
              <th style="width: 110px; text-align: center;">סה"כ פריטים שנופקו</th>
              <th style="width: 130px; text-align: center;">הזמנה אחרונה</th>
            </tr>
          </thead>
          <tbody>
            ${departmentStats
              .map(
                (d, idx) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: bold;">${d.deptName}</td>
                <td style="text-align: center;">${d.orderCount}</td>
                <td style="text-align: center; font-weight: bold; color: #0284c7;">${d.totalItemsCount.toLocaleString('he-IL')}</td>
                <td style="text-align: center; font-size: 10px;">${d.lastOrderDate || '—'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="section-title">2. עשרת הפריטים המובילים בצריכה 🔥</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>שם הפריט</th>
              <th style="width: 90px; text-align: center;">כמות שנופקה</th>
              <th style="width: 90px; text-align: center;">יחידת אריזה</th>
              <th style="width: 110px; text-align: center;">מחלקות שהזמינו</th>
              <th style="width: 90px; text-align: center;">יתרה במחסן</th>
            </tr>
          </thead>
          <tbody>
            ${productStats.topOrdered
              .slice(0, 10)
              .map(
                (p, idx) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: bold;">${p.productName}</td>
                <td style="text-align: center; font-weight: bold; color: #16a34a;">${p.totalOrderedQty.toLocaleString('he-IL')}</td>
                <td style="text-align: center;">${p.unit}</td>
                <td style="text-align: center;">${p.orderingDepts.size} מחלקות</td>
                <td style="text-align: center;">${p.currentStock.toLocaleString('he-IL')}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>חתימת מנהל מחסן / לוגיסטיקה: ___________________</div>
          <div>עמוד 1 מתוך 1 | StorePrint Medical Warehouse System</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Controls & Filter Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-sky-600" />
              <span>דוחות וסטטיסטיקת צריכה מחלקתית</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              ניתוח צריכת פריטים ואספקה לפי מחלקות, זיהוי פריטים מובילים ודרישות מחסן
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReport}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-black px-4 py-2.5 rounded-2xl shadow-md shadow-sky-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>הדפס דוח אספקה מרוכז (A4)</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Period Selector */}
          <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1">
            <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>תקופת דוח:</span>
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="week">השבוע הנוכחי ({currentWeek.formattedRange})</option>
              <option value="today">היום בלבד</option>
              <option value="last7">7 ימים אחרונים</option>
              <option value="last30">30 ימים אחרונים</option>
              <option value="month">החודש הנוכחי</option>
              <option value="custom">טווח תאריכים מותאם אישית</option>
              <option value="all">כל הזמנים ({orders.length} הזמנות)</option>
            </select>
          </div>

          {/* Custom Date Range (If custom selected) */}
          {period === 'custom' ? (
            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">מתאריך:</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">עד תאריך:</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>
            </div>
          ) : (
            /* Department Filter */
            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>סינון מחלקה:</span>
              </label>
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="ALL">כל המחלקות ({departmentStats.length})</option>
                {departmentStats.map((d) => (
                  <option key={d.deptName} value={d.deptName}>
                    {d.deptName} ({d.totalItemsCount.toLocaleString('he-IL')} פריטים)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search inside stats */}
          <div className="sm:col-span-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1">
            <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>חיפוש מהיר בדוח:</span>
            </label>
            <input
              type="text"
              placeholder="חפש מחלקה, תרופה, ציוד או פריט מתכלה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-3xl p-5 shadow-md flex items-center justify-between overflow-hidden">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-sky-100 uppercase tracking-wider">הזמנות בתקופה</div>
            <div className="text-3xl font-black mt-1 font-mono">{totalOrdersCount}</div>
            <div className="text-[11px] text-sky-100 mt-1 truncate">מתוך {orders.length} בכל הזמנים</div>
          </div>
          <div className="p-3 bg-white/15 rounded-2xl shrink-0">
            <Calendar className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-3xl p-5 shadow-md flex items-center justify-between overflow-hidden">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-indigo-100 uppercase tracking-wider">סה"כ פריטים שסופקו</div>
            <div className="text-3xl font-black mt-1 font-mono">
              {totalUnitsDelivered.toLocaleString('he-IL')}
            </div>
            <div className="text-[11px] text-indigo-100 mt-1">יחידות ואריזות</div>
          </div>
          <div className="p-3 bg-white/15 rounded-2xl shrink-0">
            <Package className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-5 shadow-md flex items-center justify-between overflow-hidden">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider">מחלקות פעילות</div>
            <div className="text-3xl font-black mt-1 font-mono">{activeDeptsCount}</div>
            <div className="text-[11px] text-emerald-100 mt-1 truncate">מתוך {departments.length} מחלקות</div>
          </div>
          <div className="p-3 bg-white/15 rounded-2xl shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-3xl p-5 shadow-md flex items-center justify-between overflow-hidden">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-amber-100 uppercase tracking-wider">פריט מוביל 🔥</div>
            <div
              className="text-base font-black mt-1 truncate"
              title={productStats.topOrdered[0]?.productName || 'אין נתונים'}
            >
              {productStats.topOrdered[0]?.productName || 'אין נתונים'}
            </div>
            <div className="text-[11px] text-amber-100 mt-1">
              {productStats.topOrdered[0]?.totalOrderedQty.toLocaleString('he-IL') || 0} יח' נופקו
            </div>
          </div>
          <div className="p-3 bg-white/15 rounded-2xl shrink-0">
            <Flame className="w-6 h-6 text-white" />
          </div>
        </div>

      </div>

      {/* Main Grid: Department Ranking & Top/Slow Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Department Activity Table & Bars (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-600" />
              <span>דירוג צריכה לפי מחלקות (מי מזמינה הכי הרבה / הכי מעט)</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {filteredDeptStats.length} מחלקות
            </span>
          </div>

          <div className="space-y-3">
            {filteredDeptStats.map((dept, idx) => {
              const pct = maxDeptUnits > 0 ? Math.round((dept.totalItemsCount / maxDeptUnits) * 100) : 0;
              const isExpanded = expandedDept === dept.deptName;

              return (
                <div
                  key={dept.deptName}
                  className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-3.5 transition-all hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-slate-900 text-sm truncate">
                          {dept.deptName}
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {dept.orderCount} הזמנות | אחרונה: {dept.lastOrderDate || 'אין'}
                        </span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="font-black text-sky-700 text-sm font-mono">
                        {dept.totalItemsCount.toLocaleString('he-IL')}{' '}
                        <span className="text-xs font-normal text-slate-500">פריטים</span>
                      </div>
                      <button
                        onClick={() => setExpandedDept(isExpanded ? null : dept.deptName)}
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-0.5 mt-0.5 cursor-pointer"
                      >
                        <span>{isExpanded ? 'הסתר פירוט' : 'הצג פירוט פריטים'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2.5">
                    <div
                      className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>

                  {/* Expandable Breakdown of Items Ordered by this Dept */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-2 animate-in fade-in">
                      <div className="font-bold text-slate-700 text-[11px]">
                        פירוט פריטים שנופקו למחלקת {dept.deptName}:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {Object.entries(dept.itemsBreakdown).map(([itemName, qty]) => (
                          <div
                            key={itemName}
                            className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-[11px]"
                          >
                            <span className="text-slate-800 font-medium truncate">{itemName}</span>
                            <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                              {qty.toLocaleString('he-IL')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredDeptStats.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                לא נמצאו נתונים למחלקות לפי הסינון שנבחר.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Product Breakdown (Top vs Slow) (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Top 10 Most Ordered Products */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span>הפריטים המוזמנים ביותר 🔥</span>
              </h3>
              <span className="text-xs font-bold text-slate-400">TOP 10</span>
            </div>

            <div className="space-y-2">
              {productStats.topOrdered.slice(0, 10).map((p, idx) => (
                <div
                  key={p.productName}
                  className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center font-bold text-slate-400 font-mono">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate" title={p.productName}>
                        {p.productName}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        הוזמן ע"י {p.orderingDepts.size} מחלקות
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <div className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {p.totalOrderedQty.toLocaleString('he-IL')} {p.unit}
                    </div>
                  </div>
                </div>
              ))}

              {productStats.topOrdered.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  אין פריטים שהוזמנו בתקופה זו.
                </div>
              )}
            </div>
          </div>

          {/* Slow-Moving / Rare Products */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-sky-500" />
                <span>פריטים ללא תנועה / צריכה נמוכה ❄️</span>
              </h3>
              <span className="text-xs font-bold text-slate-400">דרישה נמוכה</span>
            </div>

            <p className="text-xs text-slate-500">
              פריטים אלו כמעט ולא הוזמנו בתקופה שנבחרה (מסייע במניעת פגי תוקף והזמנות עודפות):
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {productStats.lowOrNoOrders.slice(0, 10).map((p) => (
                <div
                  key={p.productName}
                  className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-medium text-slate-800 truncate" title={p.productName}>
                    {p.productName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500">
                      מלאי: <strong>{p.currentStock.toLocaleString('he-IL')}</strong>
                    </span>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg">
                      {p.totalOrderedQty === 0 ? '0 הזמנות' : `${p.totalOrderedQty.toLocaleString('he-IL')} יח'`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
