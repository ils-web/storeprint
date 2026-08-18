import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Search,
  Plus,
  Minus,
  Download,
  Upload,
  Layers,
  Sparkles,
  Sliders,
  RotateCcw,
  Cloud,
  CloudCheck,
  RefreshCw,
} from 'lucide-react';
import { StockItem, CloudSyncConfig } from '../types';
import { printReorderListHtml } from '../utils/pdfGenerator';
import { exportStockToJson, importStockFromJson } from '../utils/stockManager';

export const PACKAGING_UNITS = [
  { value: "יח'", label: "יח' (יחידות)" },
  { value: "קופסה", label: "קופסה (קופסאות)" },
  { value: "מארז", label: "מארז (מארזים)" },
  { value: "חבילה", label: "חבילה (חבילות)" },
  { value: "גליל", label: "גליל (גלילים)" },
  { value: "בקבוק", label: "בקבוק (בקבוקים)" },
  { value: "דלי", label: "דלי (דליים)" },
  { value: "סט", label: "סט (ערכות)" },
  { value: "זוג", label: "זוג (זוגות)" },
];

interface StockRowInputProps {
  item: StockItem;
  globalThreshold: number;
  onUpdate: (name: string, newQty: number) => void;
}

const StockRowInput: React.FC<StockRowInputProps> = ({ item, globalThreshold, onUpdate }) => {
  const [val, setVal] = useState<string>(String(item.currentStock));
  const [isFocused, setIsFocused] = useState(false);
  const isLow = item.currentStock < (item.minThreshold || globalThreshold);
  const currentUnit = item.unit || "יח'";

  useEffect(() => {
    if (!isFocused) {
      setVal(String(item.currentStock));
    }
  }, [item.currentStock, isFocused]);

  const commit = () => {
    const parsed = parseInt(val, 10);
    const finalQty = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setVal(String(finalQty));
    if (finalQty !== item.currentStock) {
      onUpdate(item.name, finalQty);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-2xl p-1 shadow-2xs">
      {/* -10 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, Math.max(0, item.currentStock - 10))}
        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[10px] transition-colors cursor-pointer"
        title="הורד 10"
      >
        -10
      </button>
      {/* -1 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, Math.max(0, item.currentStock - 1))}
        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
        title="הורד 1"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      {/* Input - commits on Blur or Enter */}
      <div className="relative flex items-center justify-center">
        <input
          type="number"
          min={0}
          value={val}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`w-16 text-center font-black text-sm py-1 rounded-xl border focus:outline-none focus:ring-2 ${
            isLow
              ? 'border-red-400 text-red-700 bg-red-50 focus:ring-red-500'
              : 'border-slate-200 text-slate-900 focus:ring-sky-500'
          }`}
        />
      </div>

      {/* +1 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, item.currentStock + 1)}
        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
        title="הוסף 1"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {/* +10 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, item.currentStock + 10)}
        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[10px] transition-colors cursor-pointer"
        title="הוסף 10"
      >
        +10
      </button>
    </div>
  );
};

interface ThresholdAndUnitInputProps {
  item: StockItem;
  globalThreshold: number;
  onUpdate: (name: string, currentStock: number, minThreshold: number, unit: string) => void;
}

const ThresholdAndUnitInput: React.FC<ThresholdAndUnitInputProps> = ({
  item,
  globalThreshold,
  onUpdate,
}) => {
  const currentTh = item.minThreshold || globalThreshold;
  const currentUnit = item.unit || "יח'";
  const [val, setVal] = useState<string>(String(currentTh));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setVal(String(currentTh));
    }
  }, [currentTh, isFocused]);

  const commitThreshold = () => {
    const parsed = parseInt(val, 10);
    const finalTh = isNaN(parsed) ? 10 : Math.max(1, parsed);
    setVal(String(finalTh));
    if (finalTh !== currentTh) {
      onUpdate(item.name, item.currentStock, finalTh, currentUnit);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    const parsed = parseInt(val, 10);
    const finalTh = isNaN(parsed) ? currentTh : Math.max(1, parsed);
    onUpdate(item.name, item.currentStock, finalTh, newUnit);
  };

  return (
    <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-2xl px-2 py-1 shadow-2xs">
      {/* Min threshold number input */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold text-slate-400">סף:</span>
        <input
          type="number"
          min={1}
          value={val}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            commitThreshold();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-10 text-center text-xs font-black py-0.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          title="סף כמות מינימום לדוח חוסרים"
        />
      </div>

      {/* Packaging / Unit Dropdown Selector */}
      <select
        value={currentUnit}
        onChange={(e) => handleUnitChange(e.target.value)}
        className="bg-white border border-slate-300 text-slate-800 text-[11px] font-bold py-0.5 px-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
        title="בחר סוג אריזה / יחידת מידה"
      >
        {PACKAGING_UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
};

interface WarehouseViewProps {
  stock: Record<string, StockItem>;
  cloudConfig: CloudSyncConfig;
  onOpenCloudModal: () => void;
  onSyncWithCloud: () => void;
  isSyncingCloud: boolean;
  onUpdateStockItem: (name: string, newQty: number, minThreshold?: number, unit?: string) => void;
  onBatchUpdateStock: (updatedStock: Record<string, StockItem>) => void;
  onSetAllStock: (qty: number) => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  stock,
  cloudConfig,
  onOpenCloudModal,
  onSyncWithCloud,
  isSyncingCloud,
  onUpdateStockItem,
  onBatchUpdateStock,
  onSetAllStock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchQtyInput, setBatchQtyInput] = useState<string>('50');

  const stockList = useMemo(() => Object.values(stock), [stock]);

  // Statistics
  const stats = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;

    stockList.forEach((item) => {
      const th = item.minThreshold || globalThreshold;
      if (item.currentStock === 0) {
        out++;
        low++;
      } else if (item.currentStock < th) {
        low++;
      } else {
        ok++;
      }
    });

    return { total: stockList.length, ok, low, out };
  }, [stockList, globalThreshold]);

  // Low stock items list for printing
  const lowStockItems = useMemo(() => {
    return stockList.filter((item) => {
      const th = item.minThreshold || globalThreshold;
      return item.currentStock < th;
    }).sort((a, b) => a.currentStock - b.currentStock);
  }, [stockList, globalThreshold]);

  // Filtered display list
  const filteredItems = useMemo(() => {
    return stockList.filter((item) => {
      const th = item.minThreshold || globalThreshold;

      if (filterType === 'low' && item.currentStock >= th) return false;
      if (filterType === 'out' && item.currentStock > 0) return false;
      if (filterType === 'ok' && item.currentStock < th) return false;

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(q) || String(item.colIndex).includes(q);
      }

      return true;
    }).sort((a, b) => {
      if (filterType === 'low' || filterType === 'out') {
        return a.currentStock - b.currentStock;
      }
      return a.colIndex - b.colIndex;
    });
  }, [stockList, filterType, searchTerm, globalThreshold]);

  const handlePrintReorder = () => {
    printReorderListHtml(lowStockItems, globalThreshold);
  };

  const handleExport = () => {
    const json = exportStockToJson(stock);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storeprint_stock_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = importStockFromJson(content);
      if (parsed) {
        onBatchUpdateStock(parsed);
        alert('הנתונים יובאו בהצלחה!');
      } else {
        alert('שגיאה בקריאת קובץ JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 animate-fadeIn" dir="rtl">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total Items */}
        <div className="bg-white p-4.5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">סה"כ פריטים בקטלוג</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{stats.total}</div>
          </div>
          <div className="p-3.5 bg-slate-100 text-slate-700 rounded-2xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* In Stock */}
        <div className="bg-white p-4.5 rounded-3xl border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">במלאי תקין (≥ {globalThreshold})</div>
            <div className="text-3xl font-black text-emerald-700 mt-1">{stats.ok}</div>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Warning Card */}
        <div className="bg-gradient-to-br from-red-50 to-amber-50 p-4.5 rounded-3xl border border-red-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-red-600 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>דוח חוסרים (&lt; {globalThreshold})</span>
            </div>
            <div className="text-3xl font-black text-red-700 mt-1">{stats.low} פריטים</div>
          </div>
          <button
            onClick={handlePrintReorder}
            disabled={lowStockItems.length === 0}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white p-3 rounded-2xl shadow-md shadow-red-600/20 transition-all transform active:scale-95 cursor-pointer"
            title="הדפס דוח חוסרים / הזמנת רכש"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>

        {/* Zero Stock */}
        <div className="bg-white p-4.5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">אזל מהמלאי (0)</div>
            <div className="text-3xl font-black text-slate-700 mt-1">{stats.out}</div>
          </div>
          <div className="p-3.5 bg-slate-100 text-slate-500 rounded-2xl">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Main Control Panel */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Actions & Filter Toolbar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="חיפוש פריט לפי שם בעברית או מספר..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-2xl pr-9 pl-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Filter Tabs */}
          <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              הכל ({stats.total})
            </button>
            <button
              onClick={() => setFilterType('low')}
              className={`px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer ${
                filterType === 'low'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              ⚠️ חוסרים &lt; {globalThreshold} ({stats.low})
            </button>
            <button
              onClick={() => setFilterType('out')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterType === 'out'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              אזל מהמלאי ({stats.out})
            </button>
            <button
              onClick={() => setFilterType('ok')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterType === 'ok'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              במלאי תקין ({stats.ok})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Cloud Sync Status & Settings Button */}
            <button
              onClick={onOpenCloudModal}
              className={`text-xs font-bold px-3.5 py-2 rounded-2xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                cloudConfig.enabled
                  ? 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title="הגדרות סנכרון ענן"
            >
              <Cloud className={`w-4 h-4 ${cloudConfig.enabled ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>{cloudConfig.enabled ? 'ענן מחובר ☁️' : 'חיבור לענן...'}</span>
            </button>

            {/* Direct Fetch / Pull Stock from Cloud */}
            {cloudConfig.enabled && (
              <button
                onClick={onSyncWithCloud}
                disabled={isSyncingCloud}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-2xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="משיכת נתוני המלאי העדכניים מטבלת ה-Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingCloud ? 'מושך נתונים...' : 'טען מלאי מהענן'}</span>
              </button>
            )}

            {/* Print Reorder Sheet */}
            <button
              onClick={handlePrintReorder}
              disabled={lowStockItems.length === 0}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white text-xs font-black px-4 py-2 rounded-2xl shadow-md shadow-red-600/20 flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>הדפסת דוח חוסרים לרכש ({lowStockItems.length})</span>
            </button>

            {/* Batch Set Stock */}
            <button
              onClick={() => setBatchModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-2xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-600" />
              <span>הגדרת מלאי לכולם</span>
            </button>

            {/* Export JSON */}
            <button
              onClick={handleExport}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-2xl border border-slate-300 transition-colors cursor-pointer"
              title="ייצוא גיבוי מלאי לקובץ"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Import JSON */}
            <label
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-2xl border border-slate-300 transition-colors cursor-pointer"
              title="ייבוא גיבוי מלאי מקובץ"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>

          </div>
        </div>

        {/* Stock Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-3.5 px-4 w-14 text-center">מס'</th>
                <th className="py-3.5 px-4">שם המוצר / פריט (עמודות E..FM בטבלה)</th>
                <th className="py-3.5 px-4 w-52 text-center">יתרת מלאי נוכחית</th>
                <th className="py-3.5 px-4 w-52 text-center">סף מינימום וסוג אריזה</th>
                <th className="py-3.5 px-4 w-48 text-center">סטטוס מלאי</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <Package className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="font-bold text-slate-700 text-sm">לא נמצאו פריטים</div>
                      <p className="text-xs text-slate-400">
                        נסו לשנות את מונח החיפוש או לבחור מסנן אחר.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const th = item.minThreshold || globalThreshold;
                  const isLow = item.currentStock < th;
                  const isOut = item.currentStock === 0;
                  const currentUnit = item.unit || "יח'";

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isOut
                          ? 'bg-slate-50/80'
                          : isLow
                          ? 'bg-red-50/40 hover:bg-red-50/70'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Product Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {item.name}
                        </div>
                      </td>

                      {/* Interactive Stock Adjuster */}
                      <td className="py-3.5 px-4 text-center">
                        <StockRowInput
                          item={item}
                          globalThreshold={globalThreshold}
                          onUpdate={(name, newQty) =>
                            onUpdateStockItem(name, newQty, item.minThreshold || globalThreshold, currentUnit)
                          }
                        />
                      </td>

                      {/* Threshold & Packaging Unit Selector */}
                      <td className="py-3.5 px-4 text-center">
                        <ThresholdAndUnitInput
                          item={item}
                          globalThreshold={globalThreshold}
                          onUpdate={(name, currentStock, minTh, unit) =>
                            onUpdateStockItem(name, currentStock, minTh, unit)
                          }
                        />
                      </td>

                      {/* Status Badge with Custom Packaging Unit */}
                      <td className="py-3.5 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-[11px] font-bold">
                            ⚪ אזל ({item.currentStock} {currentUnit})
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-full text-[11px] font-black animate-pulse">
                            ⚠️ נמוך ({item.currentStock} {currentUnit} &lt; {th})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[11px] font-bold">
                            🟢 תקין ({item.currentStock} {currentUnit})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div>
            מוצגים פריטים: <strong>{filteredItems.length}</strong> מתוך <strong>{stockList.length}</strong>
          </div>
          <div className="text-slate-400">
            * בכל הדפסה רגילה מבוצע קיזוז מהמלאי. בלחיצה על «העתק» לא מבוצע שום קיזוז
          </div>
        </div>

      </div>

      {/* Batch Set Stock Modal */}
      {batchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-sky-600" />
              <span>הגדרת יתרת מלאי לכל הפריטים</span>
            </h3>
            <p className="text-xs text-slate-600">
              ציינו את כמות המלאי ההתחלתית שתוזן <strong>עבור כל הפריטים במחסן</strong>:
            </p>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={batchQtyInput}
                onChange={(e) => setBatchQtyInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-xs font-bold text-slate-500">יחידות</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBatchQtyInput('50')}
                className="py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                50 יח'
              </button>
              <button
                type="button"
                onClick={() => setBatchQtyInput('100')}
                className="py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                100 יח'
              </button>
              <button
                type="button"
                onClick={() => setBatchQtyInput('0')}
                className="py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                איפוס ל-0
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setBatchModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  const qty = parseInt(batchQtyInput, 10);
                  onSetAllStock(isNaN(qty) ? 0 : Math.max(0, qty));
                  setBatchModalOpen(false);
                }}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer"
              >
                החל על כל הפריטים
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
