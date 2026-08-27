import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  SlidersHorizontal,
  QrCode,
  Smartphone,
  Siren,
  PauseCircle,
  PlayCircle,
  Eye,
  EyeOff,
  Edit,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { StockItem, CloudSyncConfig } from '../types';
import { printReorderListHtml } from '../utils/pdfGenerator';
import { exportStockToJson, importStockFromJson } from '../utils/stockManager';
import { PhoneQRModal } from './PhoneQRModal';
import { ItemModal } from './ItemModal';

export const PACKAGING_UNITS = [
  { value: "יח'", label: "יח' (יחידות)" },
  { value: "קרטון", label: "קרטון (קרטונים / קופסה גדולה)" },
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
  isMobile?: boolean;
}

const StockRowInput: React.FC<StockRowInputProps> = ({ item, globalThreshold, onUpdate, isMobile = false }) => {
  const safeStock = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
  const [val, setVal] = useState<string>(String(safeStock));
  const [isFocused, setIsFocused] = useState(false);
  const isLow = safeStock < (item.minThreshold || globalThreshold);

  useEffect(() => {
    if (!isFocused) {
      const current = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      setVal(String(current));
    }
  }, [item.currentStock, isFocused]);

  const commit = () => {
    const parsed = parseInt(val, 10);
    const finalQty = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setVal(String(finalQty));
    if (finalQty !== safeStock) {
      onUpdate(item.name, finalQty);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs shrink-0 ${
        isMobile ? 'w-full justify-between py-1.5 px-2' : ''
      }`}
    >
      {/* -10 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, Math.max(0, safeStock - 10))}
        className={`flex items-center justify-center rounded-lg bg-slate-100 active:bg-slate-300 hover:bg-slate-200 text-slate-800 font-black transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10 text-xs' : 'w-6 h-6 text-[10px]'
        }`}
        title="הורד 10"
      >
        -10
      </button>

      {/* -1 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, Math.max(0, safeStock - 1))}
        className={`flex items-center justify-center rounded-lg bg-slate-100 active:bg-slate-300 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10' : 'w-6 h-6'
        }`}
        title="הורד 1"
      >
        <Minus className={isMobile ? 'w-4 h-4' : 'w-3 h-3'} />
      </button>

      {/* Input - commits on Blur or Enter, with mobile numeric keypad and no clipped numbers */}
      <div className="relative flex items-center justify-center shrink-0">
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
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
          className={`w-14 sm:w-16 min-w-[54px] px-1 text-center font-black rounded-lg border focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            isMobile ? 'text-base py-1.5' : 'text-xs py-0.5'
          } ${
            isLow
              ? 'border-red-400 text-red-700 bg-red-50 focus:ring-red-500'
              : 'border-slate-300 text-slate-900 bg-white focus:ring-sky-500'
          }`}
        />
      </div>

      {/* +1 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, safeStock + 1)}
        className={`flex items-center justify-center rounded-lg bg-sky-50 active:bg-sky-200 hover:bg-sky-100 text-sky-700 font-bold transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10' : 'w-6 h-6'
        }`}
        title="הוסף 1"
      >
        <Plus className={isMobile ? 'w-4 h-4' : 'w-3 h-3'} />
      </button>

      {/* +10 */}
      <button
        type="button"
        onClick={() => onUpdate(item.name, safeStock + 10)}
        className={`flex items-center justify-center rounded-lg bg-sky-100 active:bg-sky-300 hover:bg-sky-200 text-sky-800 font-black transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10 text-xs' : 'w-6 h-6 text-[10px]'
        }`}
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
  isEmergencyMode?: boolean;
  onUpdate: (name: string, currentStock: number, minThreshold: number, unit: string) => void;
  isMobile?: boolean;
}

const ThresholdAndUnitInput: React.FC<ThresholdAndUnitInputProps> = ({
  item,
  globalThreshold,
  isEmergencyMode = false,
  onUpdate,
  isMobile = false,
}) => {
  const safeStock = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
  const safeTh = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : (globalThreshold || 10);
  const emergencyTh = safeTh * 3;
  const currentUnit = item.unit || "יח'";
  const [val, setVal] = useState<string>(String(safeTh));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      const current = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : (globalThreshold || 10);
      setVal(String(current));
    }
  }, [item.minThreshold, globalThreshold, isFocused]);

  const commitThreshold = () => {
    const parsed = parseInt(val, 10);
    const finalTh = isNaN(parsed) ? 10 : Math.max(1, parsed);
    setVal(String(finalTh));
    if (finalTh !== safeTh) {
      onUpdate(item.name, safeStock, finalTh, currentUnit);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    const parsed = parseInt(val, 10);
    const finalTh = isNaN(parsed) ? safeTh : Math.max(1, parsed);
    onUpdate(item.name, safeStock, finalTh, newUnit);
  };

  return (
    <div
      className={`inline-flex items-center gap-1 border rounded-xl px-1.5 py-0.5 shadow-2xs shrink-0 ${
        isEmergencyMode
          ? 'bg-red-50/80 border-red-300 ring-1 ring-red-400'
          : 'bg-slate-50 border-slate-300'
      } ${isMobile ? 'w-full justify-between py-1.5 px-2' : ''}`}
    >
      {/* Min threshold number input */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold text-slate-500">
          {isEmergencyMode ? 'שגרה:' : 'סף:'}
        </span>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
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
          className="w-11 sm:w-12 min-w-[42px] text-center text-xs font-black py-0.5 px-0.5 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title="סף כמות מינימום לדוח חוסרים"
        />
        {isEmergencyMode && (
          <span className="text-[9px] font-black text-red-600 bg-red-100 px-1 py-0.5 rounded border border-red-300">
            X3: {emergencyTh}
          </span>
        )}
      </div>

      {/* Packaging / Unit Dropdown Selector */}
      <div className="flex items-center gap-1">
        <select
          value={currentUnit}
          onChange={(e) => handleUnitChange(e.target.value)}
          className="bg-white border border-slate-300 text-slate-900 text-xs font-bold py-0.5 px-1 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-2xs"
          title="בחר סוג אריזה / יחידת מידה"
        >
          {PACKAGING_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

import { DepartmentQRPrintModal } from './portal/DepartmentQRPrintModal';
import { MobileStockQRModal } from './mobile/MobileStockQRModal';
import { printEmergencyReorderListHtml } from '../utils/emergencyPdfGenerator';

interface WarehouseViewProps {
  stock: Record<string, StockItem>;
  departments?: string[];
  tenantId?: string;
  tenantName?: string;
  isEmergencyMode?: boolean;
  onOpenEmergencyConfirm?: () => void;
  cloudConfig: CloudSyncConfig;
  onOpenCloudModal: () => void;
  onSyncWithCloud: () => void;
  isSyncingCloud: boolean;
  onUpdateStockItem: (
    name: string,
    newQty: number,
    minThreshold?: number,
    unit?: string,
    isActive?: boolean,
    limitByPatients?: boolean
  ) => void;
  onBatchUpdateStock: (updatedStock: Record<string, StockItem | number>) => void;
  onSetAllStock: (qty: number) => void;
  onSaveFullItem?: (savedItem: StockItem, oldNameOrId?: string) => void;
  onDeleteItem?: (idOrName: string) => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  stock,
  departments = [],
  tenantId,
  tenantName,
  isEmergencyMode = false,
  onOpenEmergencyConfirm,
  cloudConfig,
  onOpenCloudModal,
  onSyncWithCloud,
  isSyncingCloud,
  onUpdateStockItem,
  onBatchUpdateStock,
  onSetAllStock,
  onSaveFullItem,
  onDeleteItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'ok' | 'inactive'>('all');
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchQtyInput, setBatchQtyInput] = useState<string>('50');
  const [isDeptQRModalOpen, setIsDeptQRModalOpen] = useState(false);
  const [isMobileStockQRModalOpen, setIsMobileStockQRModalOpen] = useState(false);

  const stockList = useMemo(() => Object.values(stock), [stock]);

  // Helper to calculate effective threshold (x3 in emergency mode)
  const getEffectiveTh = useCallback((item: StockItem) => {
    const baseTh = item.minThreshold || globalThreshold;
    return isEmergencyMode ? baseTh * 3 : baseTh;
  }, [globalThreshold, isEmergencyMode]);

  // Statistics (excluding inactive items from shortage counts)
  const stats = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;
    let inactive = 0;

    stockList.forEach((item) => {
      if (item.isActive === false) {
        inactive++;
        return;
      }
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      if (safeQty === 0) {
        out++;
        low++;
      } else if (safeQty < th) {
        low++;
      } else {
        ok++;
      }
    });

    return { total: stockList.length, ok, low, out, inactive };
  }, [stockList, getEffectiveTh]);

  // Low stock items list for printing (strictly excluding inactive items)
  const lowStockItems = useMemo(() => {
    return stockList.filter((item) => {
      if (item.isActive === false) return false;
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < th;
    }).sort((a, b) => (a.currentStock || 0) - (b.currentStock || 0));
  }, [stockList, getEffectiveTh]);

  // Filtered display list
  const filteredItems = useMemo(() => {
    return stockList.filter((item) => {
      const isItemInactive = item.isActive === false;

      if (filterType === 'inactive') {
        if (!isItemInactive) return false;
      } else if (filterType === 'all') {
        // Show all
      } else {
        // For 'low', 'out', 'ok': exclude inactive items
        if (isItemInactive) return false;
        const th = getEffectiveTh(item);
        const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
        if (filterType === 'low' && safeQty >= th) return false;
        if (filterType === 'out' && safeQty > 0) return false;
        if (filterType === 'ok' && safeQty < th) return false;
      }

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(q) || String(item.colIndex).includes(q);
      }

      return true;
    }).sort((a, b) => {
      if (filterType === 'low' || filterType === 'out') {
        return (a.currentStock || 0) - (b.currentStock || 0);
      }
      return (a.colIndex || 0) - (b.colIndex || 0);
    });
  }, [stockList, filterType, searchTerm, getEffectiveTh]);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<StockItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);

  const handleOpenCreateItem = () => {
    setItemToEdit(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: StockItem) => {
    setItemToEdit(item);
    setIsItemModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete && onDeleteItem) {
      onDeleteItem(itemToDelete.name || itemToDelete.id);
      setItemToDelete(null);
    }
  };

  const handleSaveItem = (savedItem: StockItem) => {
    if (onSaveFullItem) {
      onSaveFullItem(savedItem, itemToEdit?.name || itemToEdit?.id);
    } else {
      onUpdateStockItem(
        savedItem.name,
        savedItem.currentStock,
        savedItem.minThreshold,
        savedItem.unit,
        savedItem.isActive,
        savedItem.limitByPatients
      );
    }
  };

  const handlePrintReorder = () => {
    if (isEmergencyMode) {
      printEmergencyReorderListHtml(stockList, globalThreshold, 3, tenantName);
    } else {
      printReorderListHtml(lowStockItems, globalThreshold);
    }
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
    <div className="space-y-4 animate-fadeIn pb-16" dir="rtl">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        
        {/* Total Items */}
        <div className="bg-white p-3.5 sm:p-4.5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">סה"כ פריטים</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">{stats.total}</div>
          </div>
          <div className="p-2.5 sm:p-3.5 bg-slate-100 text-slate-700 rounded-2xl">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* In Stock */}
        <div className="bg-white p-3.5 sm:p-4.5 rounded-3xl border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">במלאי תקין</div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-0.5">{stats.ok}</div>
          </div>
          <div className="p-2.5 sm:p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Low Stock Warning Card */}
        <div className="bg-gradient-to-br from-red-50 to-amber-50 p-3.5 sm:p-4.5 rounded-3xl border border-red-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>דוח חוסרים</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-700 mt-0.5">{stats.low}</div>
          </div>
          <button
            onClick={handlePrintReorder}
            disabled={lowStockItems.length === 0}
            className="bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-40 text-white p-2.5 sm:p-3 rounded-2xl shadow-md shadow-red-600/20 transition-all cursor-pointer"
            title="הדפס דוח חוסרים / הזמנת רכש"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Zero Stock */}
        <div className="bg-white p-3.5 sm:p-4.5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">אזל מהמלאי</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-0.5">{stats.out}</div>
          </div>
          <div className="p-2.5 sm:p-3.5 bg-slate-100 text-slate-500 rounded-2xl">
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

      </div>

      {/* Main Control Panel */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Actions & Filter Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col gap-3">
          
          {/* Row 1: Search & Filter Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="חיפוש פריט לפי שם בעברית..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-2xl pr-9 pl-4 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1 text-[11px] sm:text-xs overflow-x-auto">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                הכל ({stats.total})
              </button>
              <button
                onClick={() => setFilterType('low')}
                className={`px-3 py-1.5 rounded-xl font-black whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'low'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                ⚠️ חוסרים ({stats.low})
              </button>
              <button
                onClick={() => setFilterType('out')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'out'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                אזל ({stats.out})
              </button>
              <button
                onClick={() => setFilterType('ok')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'ok'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                תקין ({stats.ok})
              </button>
              <button
                onClick={() => setFilterType('inactive')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'inactive'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="פריטים המסומנים כלא בשימוש כרגע (מוחרגים מדוחות חוסרים ורכש)"
              >
                ⏸️ לא בשימוש ({stats.inactive})
              </button>
            </div>

          </div>

          {/* Row 2: Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Cloud Sync Status & Settings Button */}
              <button
                onClick={onOpenCloudModal}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                  cloudConfig.enabled
                    ? 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
                title="הגדרות סנכרון ענן"
              >
                <Cloud className={`w-3.5 h-3.5 ${cloudConfig.enabled ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{cloudConfig.enabled ? 'ענן מחובר ☁️' : 'חיבור לענן'}</span>
              </button>

              {/* Direct Fetch / Pull Stock from Cloud */}
              {cloudConfig.enabled && (
                <button
                  onClick={onSyncWithCloud}
                  disabled={isSyncingCloud}
                  className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="משיכת נתוני המלאי העדכניים מטבלת ה-Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCloud ? 'מושך...' : 'טען מהענן'}</span>
                </button>
              )}

              {/* Mobile Stock Scanner QR */}
              <button
                onClick={() => setIsMobileStockQRModalOpen(true)}
                className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="סריקת קוד QR לספירת מלאי מהטלפון בין המדפים"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>QR ספירת מלאי במובייל 📱</span>
              </button>

              {/* Department QR Cards Generator & Print */}
              <button
                onClick={() => setIsDeptQRModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="הפקת כרטיסיות QR עם הוראות להדפסה ותלייה בכל מחלקה"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>כרטיסיות QR למחלקות 🏷️</span>
              </button>

              {/* Add New Stock Item Button */}
              <button
                onClick={handleOpenCreateItem}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="הוספת פריט חדש למחסן"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>הוסף פריט למחסן 📦</span>
              </button>
              {/* Emergency Mode Toggle Button */}
              {onOpenEmergencyConfirm && (
                <button
                  onClick={onOpenEmergencyConfirm}
                  className={`text-xs font-black px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1.5 transition-all cursor-pointer ${
                    isEmergencyMode
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse ring-2 ring-red-400'
                      : 'bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60'
                  }`}
                  title={isEmergencyMode ? 'לחץ לחזרה לשגרה (1X)' : 'מעבר לשעת חירום והגדלת מלאי פי 3 (3X)'}
                >
                  <Siren className="w-3.5 h-3.5 text-white" />
                  <span>{isEmergencyMode ? '🚨 שעת חירום (X3) • חזרה לשגרה' : 'מצב חירום (X3) 🚨'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Print Reorder Sheet */}
              <button
                onClick={handlePrintReorder}
                disabled={lowStockItems.length === 0}
                className={`text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                  isEmergencyMode
                    ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 ring-2 ring-red-400'
                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {isEmergencyMode
                    ? `הדפס דוח רכש חירום X3 (${lowStockItems.length})`
                    : `הדפס דוח חוסרים (${lowStockItems.length})`}
                </span>
              </button>

              {/* Batch Set Stock */}
              <button
                onClick={() => setBatchModalOpen(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden sm:inline">הגדרת מלאי לכולם</span>
                <span className="sm:hidden">הגדרה כוללת</span>
              </button>

              {/* Export JSON */}
              <button
                onClick={handleExport}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer"
                title="ייצוא גיבוי מלאי לקובץ"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Import JSON */}
              <label
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer"
                title="ייבוא גיבוי מלאי מקובץ"
              >
                <Upload className="w-4 h-4" />
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>

          </div>
        </div>

        {/* 1. Mobile Cards View (Visible on Mobile Screens < 768px) */}
        <div className="block md:hidden divide-y divide-slate-100 bg-slate-50/40">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Package className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700 text-xs">לא נמצאו פריטים</div>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const th = item.minThreshold || globalThreshold;
              const isLow = item.currentStock < th;
              const isOut = item.currentStock === 0;
              const currentUnit = item.unit || "יח'";

              return (
                <div
                  key={item.id}
                  className={`p-3.5 space-y-3 transition-colors ${
                    isOut
                      ? 'bg-slate-100/70'
                      : isLow
                      ? 'bg-red-50/50'
                      : 'bg-white'
                  }`}
                >
                  {/* Top Row: Index, Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          #{idx + 1}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm leading-snug">
                          {item.name}
                        </h4>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isOut ? (
                        <span className="inline-flex items-center text-[10px] font-black bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
                          ⚪ אזל
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center text-[10px] font-black bg-red-100 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full animate-pulse">
                          ⚠️ נמוך ({item.currentStock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          🟢 תקין ({item.currentStock})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stepper Input Controller for Fingers */}
                  <div>
                    <StockRowInput
                      item={item}
                      globalThreshold={globalThreshold}
                      isMobile={true}
                      onUpdate={(name, newQty) =>
                        onUpdateStockItem(name, newQty, item.minThreshold || globalThreshold, currentUnit)
                      }
                    />
                  </div>

                  {/* Threshold & Unit Selector Row */}
                  <div>
                    <ThresholdAndUnitInput
                      item={item}
                      globalThreshold={globalThreshold}
                      isMobile={true}
                      onUpdate={(name, currentStock, minTh, unit) =>
                        onUpdateStockItem(name, currentStock, minTh, unit)
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Table View (Visible on Screens >= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-2.5 px-2 w-10 text-center">מס'</th>
                <th className="py-2.5 px-3">שם המוצר / פריט (עמודות E..FM בטבלה)</th>
                <th className="py-2.5 px-2 w-48 text-center">יתרת מלאי נוכחית</th>
                <th className="py-2.5 px-2 w-48 text-center">סף מינימום וסוג אריזה</th>
                <th className="py-2.5 px-2 w-36 text-center">סטטוס מלאי</th>
                <th className="py-2.5 px-2 w-28 text-center">פעילות / השהייה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
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
                  const th = getEffectiveTh(item);
                  const isInactive = item.isActive === false;
                  const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
                  const isLow = !isInactive && safeQty < th;
                  const isOut = !isInactive && safeQty === 0;
                  const currentUnit = item.unit || "יח'";

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isInactive
                          ? 'bg-slate-100/70 opacity-70'
                          : isOut
                          ? 'bg-slate-50/80'
                          : isLow
                          ? 'bg-red-50/40 hover:bg-red-50/70'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Product Name */}
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                            <span>{item.name}</span>
                            {isInactive && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">
                                בהשהייה
                              </span>
                            )}
                            {item.limitByPatients && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5" title="הזמנה מוגבלת למספר המטופלים במחלקה">
                                👥 מוגבל למטופלים
                              </span>
                            )}
                          </div>

                          {/* Quick Toggle: Limit by patients */}
                          <button
                            onClick={() =>
                              onUpdateStockItem(
                                item.name,
                                safeQty,
                                item.minThreshold || globalThreshold,
                                currentUnit,
                                item.isActive !== false,
                                !item.limitByPatients
                              )
                            }
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer shrink-0 ${
                              item.limitByPatients
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-300'
                            }`}
                            title={
                              item.limitByPatients
                                ? 'לחץ לביטול ההגבלה לפי מספר מטופלים'
                                : 'לחץ להגבלת כמות ההזמנה של פריט זה לפי מספר המטופלים במחלקה'
                            }
                          >
                            👥 {item.limitByPatients ? 'מוגבל למטופלים ✓' : 'הגבל למטופלים'}
                          </button>
                        </div>
                      </td>

                      {/* Interactive Stock Adjuster */}
                      <td className="py-2 px-2 text-center">
                        <StockRowInput
                          item={item}
                          globalThreshold={globalThreshold}
                          isMobile={false}
                          onUpdate={(name, newQty) =>
                            onUpdateStockItem(name, newQty, item.minThreshold || globalThreshold, currentUnit, item.isActive !== false, item.limitByPatients)
                          }
                        />
                      </td>

                      {/* Threshold & Packaging Unit Selector */}
                      <td className="py-2 px-2 text-center">
                        <ThresholdAndUnitInput
                          item={item}
                          globalThreshold={globalThreshold}
                          isEmergencyMode={isEmergencyMode}
                          isMobile={false}
                          onUpdate={(name, currentStock, minTh, unit) =>
                            onUpdateStockItem(name, currentStock, minTh, unit, item.isActive !== false, item.limitByPatients)
                          }
                        />
                      </td>

                      {/* Status Badge with Custom Packaging Unit */}
                      <td className="py-2 px-2 text-center">
                        {isInactive ? (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                            ⏸️ מושהה (לא בדוחות)
                          </span>
                        ) : isOut ? (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                            ⚪ אזל ({item.currentStock} {currentUnit})
                          </span>
                        ) : isLow ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black animate-pulse border ${
                            isEmergencyMode
                              ? 'bg-red-600 text-white border-red-700 shadow-xs'
                              : 'bg-red-100 text-red-700 border-red-300'
                          }`}>
                            ⚠️ {isEmergencyMode ? 'חסר בחירום' : 'נמוך'} ({item.currentStock} {currentUnit})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                            🟢 תקין ({item.currentStock} {currentUnit})
                          </span>
                        )}
                      </td>

                      {/* Active / Inactive Toggle & Edit Buttons */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Edit Item Button */}
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:border-sky-300 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                            title="ערוך פריט זה (שם, כמויות, ספים)"
                          >
                            <Edit className="w-3.5 h-3.5 text-sky-600" />
                          </button>

                          {/* Pause / Resume Button */}
                          <button
                            onClick={() => onUpdateStockItem(item.name, safeQty, item.minThreshold || globalThreshold, currentUnit, isInactive, item.limitByPatients)}
                            className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isInactive
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                            title={isInactive ? 'החזר פריט לפעילות שוטפת' : 'הקפא פריט (לא ייכלל בהזמנות ורכש)'}
                          >
                            {isInactive ? (
                              <>
                                <PlayCircle className="w-3.5 h-3.5 text-white" />
                                <span>הפעל</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
                                <span>הקפא ❄️</span>
                              </>
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:border-red-300 text-slate-400 hover:text-red-600 transition-colors border border-slate-200 cursor-pointer"
                            title="מחק פריט זה לצמיתות מהמחסן"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                inputMode="numeric"
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

      {/* Department QR Cards Print Modal */}
      <DepartmentQRPrintModal
        isOpen={isDeptQRModalOpen}
        onClose={() => setIsDeptQRModalOpen(false)}
        departments={departments}
        tenantId={tenantId}
        tenantName={tenantName}
      />

      {/* Mobile Stock Scanner QR Modal */}
      <MobileStockQRModal
        isOpen={isMobileStockQRModalOpen}
        onClose={() => setIsMobileStockQRModalOpen(false)}
      />

      {/* Item Creation & Edit Modal */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        itemToEdit={itemToEdit}
        onSave={handleSaveItem}
        onDelete={onDeleteItem}
      />

      {/* Confirmation Dialog for Table Row Deletion */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-200 space-y-4 text-slate-900">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto border-4 border-red-50">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">מחיקת פריט מהמחסן?</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                האם אתה בטוח שברצונך למחוק את הפריט <strong className="text-slate-900 underline">"{itemToDelete.name}"</strong> לצמיתות?
              </p>
              <p className="text-[11px] text-red-500 font-bold mt-1">
                ⚠️ הפריט יוסר לצמיתות ממסד הנתונים ומהקטלוג.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>כן, מחק לצמיתות 🗑️</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
