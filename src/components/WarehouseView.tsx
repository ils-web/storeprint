import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Search,
  Plus,
  Minus,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCcw,
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
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  Users,
  X,
} from 'lucide-react';
import { StockItem } from '../types';
import { printReorderListHtml } from '../utils/pdfGenerator';
import {
  normalizeProductName,
  detectPackageSize,
  getCanonicalWarehouseCatalog,
} from '../utils/stockManager';
import { getCategorizedSortedStockItems, categorizeItem } from '../utils/stockGrouper';
import {
  downloadPurchaseOrderExcel,
  getSuggestedOrderQty,
  PurchaseOrderExportLine,
} from '../utils/excelExport';
import { ItemModal } from './ItemModal';
import { PurchaseOrderModal, PurchaseOrderDraftEntry } from './PurchaseOrderModal';

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
  { value: "ק״ג", label: "ק״ג (קילוגרם)" },
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
  const isFocusedRef = useRef(false);
  const isLow = safeStock < (item.minThreshold || globalThreshold);

  useEffect(() => {
    if (!isFocusedRef.current) {
      const current = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      setVal(String(current));
    }
  }, [item.currentStock]);

  const commit = () => {
    const trimmed = val.trim();
    if (trimmed === '') {
      setVal(String(safeStock));
      return;
    }
    const parsed = parseInt(trimmed, 10);
    const finalQty = isNaN(parsed) ? safeStock : Math.max(0, parsed);
    setVal(String(finalQty));
    if (finalQty !== safeStock) {
      onUpdate(item.name, finalQty);
    }
  };

  const adjustBy = (delta: number) => {
    const parsed = parseInt(val.trim(), 10);
    const baseQty = isFocusedRef.current && !isNaN(parsed) ? parsed : safeStock;
    const nextQty = Math.max(0, baseQty + delta);
    setVal(String(nextQty));
    onUpdate(item.name, nextQty);
  };

  return (
    <div
      className={`inline-flex items-center bg-white border border-slate-300 rounded-xl shadow-2xs shrink-0 ${
        isMobile ? 'w-full justify-between py-1.5 px-2 gap-1.5' : 'gap-1 p-0.5'
      }`}
    >
      {/* -10 */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => adjustBy(-10)}
        className={`flex items-center justify-center rounded-lg bg-slate-100 active:bg-slate-300 hover:bg-slate-200 text-slate-800 font-black transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10 text-xs' : 'w-7 h-7 text-[11px]'
        }`}
        title="הורד 10"
      >
        -10
      </button>

      {/* -1 */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => adjustBy(-1)}
        className={`flex items-center justify-center rounded-lg bg-slate-100 active:bg-slate-300 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10' : 'w-7 h-7'
        }`}
        title="הורד 1"
      >
        <Minus className={isMobile ? 'w-4 h-4' : 'w-3 h-3'} />
      </button>

      {/* Input - commits on Blur or Enter, immune to mouse-wheel/arrow mutation */}
      <div className="relative flex items-center justify-center shrink-0">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={val}
          onFocus={(e) => {
            isFocusedRef.current = true;
            e.target.select();
          }}
          onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ''))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          onBlur={() => {
            isFocusedRef.current = false;
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              isFocusedRef.current = false;
              setVal(String(safeStock));
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`px-1 text-center font-black rounded-lg border focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            isMobile ? 'w-16 min-w-[56px] text-base py-1.5' : 'w-12 min-w-[44px] text-xs py-1'
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
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => adjustBy(1)}
        className={`flex items-center justify-center rounded-lg bg-sky-50 active:bg-sky-200 hover:bg-sky-100 text-sky-700 font-bold transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10' : 'w-7 h-7'
        }`}
        title="הוסף 1"
      >
        <Plus className={isMobile ? 'w-4 h-4' : 'w-3 h-3'} />
      </button>

      {/* +10 */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => adjustBy(10)}
        className={`flex items-center justify-center rounded-lg bg-sky-100 active:bg-sky-300 hover:bg-sky-200 text-sky-800 font-black transition-colors cursor-pointer shrink-0 ${
          isMobile ? 'w-11 h-10 text-xs' : 'w-7 h-7 text-[11px]'
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
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      const current = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : (globalThreshold || 10);
      setVal(String(current));
    }
  }, [item.minThreshold, globalThreshold]);

  const commitThreshold = () => {
    const trimmed = val.trim();
    if (trimmed === '') {
      setVal(String(safeTh));
      return;
    }
    const parsed = parseInt(trimmed, 10);
    const finalTh = isNaN(parsed) ? safeTh : Math.max(1, parsed);
    setVal(String(finalTh));
    if (finalTh !== safeTh) {
      onUpdate(item.name, safeStock, finalTh, currentUnit);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    const parsed = parseInt(val.trim(), 10);
    const finalTh = isNaN(parsed) ? safeTh : Math.max(1, parsed);
    onUpdate(item.name, safeStock, finalTh, newUnit);
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 border rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
        isEmergencyMode
          ? 'bg-red-50/80 border-red-300 ring-1 ring-red-400'
          : 'bg-slate-50 border-slate-300'
      } ${isMobile ? 'w-full justify-between py-1.5 px-2' : ''}`}
    >
      {/* Min threshold number input */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-bold text-slate-500">
          {isEmergencyMode ? 'שגרה:' : 'סף:'}
        </span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={val}
          onFocus={(e) => {
            isFocusedRef.current = true;
            e.target.select();
          }}
          onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ''))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          onBlur={() => {
            isFocusedRef.current = false;
            commitThreshold();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              isFocusedRef.current = false;
              setVal(String(safeTh));
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-11 min-w-[40px] text-center text-xs sm:text-sm font-black py-0.5 px-1 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title="סף כמות מינימום לדוח חוסרים"
        />
        {isEmergencyMode && (
          <span className="text-[10px] font-black text-red-600 bg-red-100 px-1 py-0.5 rounded border border-red-300">
            X3: {emergencyTh}
          </span>
        )}
      </div>

      {/* Packaging / Unit Dropdown Selector */}
      <div className="flex items-center gap-1">
        <select
          value={currentUnit}
          onChange={(e) => handleUnitChange(e.target.value)}
          className={`bg-white border border-slate-300 text-slate-900 text-xs font-bold py-1 px-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-2xs ${
            isMobile ? '' : 'w-20 sm:w-24'
          }`}
          title="בחר סוג אריזה / יחידת מידה"
        >
          {PACKAGING_UNITS.map((u) => (
            <option key={u.value} value={u.value} title={u.label}>
              {isMobile ? u.label : u.value}
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
  onUpdateStockItem: (
    name: string,
    newQty: number,
    minThreshold?: number,
    unit?: string,
    isActive?: boolean,
    limitByPatients?: boolean
  ) => void;
  onSaveFullItem?: (savedItem: StockItem, oldNameOrId?: string, targetPosition?: number) => void;
  onDeleteItem?: (idOrName: string) => void;
  onMoveItem?: (idOrName: string, direction: 'up' | 'down') => void;
  onOrganizeLogically?: () => void;
  onRestoreBackup?: () => void;
  onSaveBackup?: () => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  stock,
  departments = [],
  tenantId,
  tenantName,
  isEmergencyMode = false,
  onOpenEmergencyConfirm,
  onUpdateStockItem,
  onSaveFullItem,
  onDeleteItem,
  onMoveItem,
  onOrganizeLogically,
  onRestoreBackup,
  onSaveBackup,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'ok' | 'inactive'>('all');
  const [filterSession, setFilterSession] = useState(0);
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);
  const [isDeptQRModalOpen, setIsDeptQRModalOpen] = useState(false);
  const [isMobileStockQRModalOpen, setIsMobileStockQRModalOpen] = useState(false);
  const [isOrganizeConfirmOpen, setIsOrganizeConfirmOpen] = useState(false);
  const [isRestoreBackupModalOpen, setIsRestoreBackupModalOpen] = useState(false);

  // Keep rows pinned while editing inside a filtered tab ('low', 'out', 'ok', 'inactive')
  // so that updating an item's quantity never makes the row vanish under the user's cursor
  // or shift the neighboring item into the current row's position.
  const pinnedItemNamesRef = useRef<Set<string>>(new Set());
  const lastFilterContextRef = useRef({ filterType, searchTerm, filterSession });
  if (
    lastFilterContextRef.current.filterType !== filterType ||
    lastFilterContextRef.current.searchTerm !== searchTerm ||
    lastFilterContextRef.current.filterSession !== filterSession
  ) {
    pinnedItemNamesRef.current.clear();
    lastFilterContextRef.current = { filterType, searchTerm, filterSession };
  }

  const selectFilterType = (nextFilter: 'all' | 'low' | 'out' | 'ok' | 'inactive') => {
    pinnedItemNamesRef.current.clear();
    setFilterType(nextFilter);
    setFilterSession((s) => s + 1);
  };

  // Strictly deduplicated canonical warehouse catalog (1..activeCount for active items, frozen at bottom)
  const catalog = useMemo(() => getCanonicalWarehouseCatalog(stock), [stock]);
  const stockList = catalog.orderedList;
  const getDisplayNum = useCallback(
    (item: StockItem, fallbackIdx: number) =>
      catalog.displayNumberByNormName.get(
        normalizeProductName(item.name) || item.name.trim().toLowerCase()
      ) ?? fallbackIdx + 1,
    [catalog]
  );

  // Helper to calculate effective threshold (x3 in emergency mode)
  const getEffectiveTh = useCallback((item: StockItem) => {
    if (!item) return globalThreshold;
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
      if (!item || !item.name) return;
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

  // Low stock items list for printing (strictly excluding inactive items, grouped by category and ordered by warehouse order)
  const lowStockItems = useMemo(() => {
    const raw = stockList.filter((item) => {
      if (!item || !item.name || item.isActive === false) return false;
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < th;
    });
    return getCategorizedSortedStockItems(raw);
  }, [stockList, getEffectiveTh]);

  // Filtered display list (with row-pinning protection against mid-edit row jumps)
  const filteredItems = useMemo(() => {
    return stockList.filter((item) => {
      if (!item || !item.name) return false;

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const numQuery = q.replace(/^#/, '');
        const nameMatch = item.name ? item.name.toLowerCase().includes(q) : false;
        const displayNum = getDisplayNum(item, -1);
        const displayMatch = numQuery !== '' && displayNum > 0 && String(displayNum).includes(numQuery);
        const colMatch = numQuery !== '' && item.colIndex ? String(item.colIndex).includes(numQuery) : false;
        if (!nameMatch && !displayMatch && !colMatch) return false;
      }

      const isItemInactive = item.isActive === false;
      let matchesStatus = true;

      if (filterType === 'inactive') {
        matchesStatus = isItemInactive;
      } else if (filterType === 'all') {
        matchesStatus = true;
      } else {
        // For 'low', 'out', 'ok': exclude inactive items
        if (isItemInactive) {
          matchesStatus = false;
        } else {
          const th = getEffectiveTh(item);
          const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
          if (filterType === 'low' && safeQty >= th) matchesStatus = false;
          if (filterType === 'out' && safeQty > 0) matchesStatus = false;
          if (filterType === 'ok' && safeQty < th) matchesStatus = false;
        }
      }

      if (matchesStatus) {
        if (filterType !== 'all') {
          pinnedItemNamesRef.current.add(item.name);
        }
        return true;
      }

      // Keep already-displayed rows pinned in place during the current filter session
      // so rows never jump when their stock quantity crosses the threshold
      if (filterType !== 'all' && pinnedItemNamesRef.current.has(item.name)) {
        return true;
      }

      return false;
    }).sort((a, b) => {
      if (filterType === 'low' || filterType === 'out') {
        const catA = categorizeItem(a.name);
        const catB = categorizeItem(b.name);
        if (catA.group !== catB.group) return catA.group - catB.group;
        return ((a.colIndex || 0) - (b.colIndex || 0)) || a.name.localeCompare(b.name, 'he');
      }
      return 0;
    });
  }, [stockList, filterType, searchTerm, filterSession, getEffectiveTh, getDisplayNum]);

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

  const handleSaveItem = (savedItem: StockItem, targetPosition?: number) => {
    if (onSaveFullItem) {
      onSaveFullItem(savedItem, itemToEdit?.name || itemToEdit?.id, targetPosition);
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

  // Purchase Order Builder Draft (persisted per tenant in localStorage)
  const purchaseDraftStorageKey = `storeprint_purchase_draft_${tenantId || 'tenant-main-01'}`;
  const [purchaseDraft, setPurchaseDraft] = useState<Record<string, PurchaseOrderDraftEntry>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(purchaseDraftStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isPurchaseSelectionMode, setIsPurchaseSelectionMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(purchaseDraftStorageKey);
      setPurchaseDraft(raw ? JSON.parse(raw) : {});
    } catch {
      setPurchaseDraft({});
    }
  }, [purchaseDraftStorageKey]);

  const updatePurchaseDraft = useCallback(
    (updater: (prev: Record<string, PurchaseOrderDraftEntry>) => Record<string, PurchaseOrderDraftEntry>) => {
      setPurchaseDraft((prev) => {
        const next = updater(prev);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(purchaseDraftStorageKey, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    [purchaseDraftStorageKey]
  );

  const getPurchaseNormKey = useCallback(
    (name: string) => normalizeProductName(name) || name.trim().toLowerCase(),
    []
  );

  const getCleanUnitForItem = useCallback((item: StockItem) => {
    const pkgSize = item.packageSize || detectPackageSize(item.name);
    if (!item.unit || item.unit === 'מטר') {
      return pkgSize && pkgSize > 1 ? 'מארז' : "יח'";
    }
    return item.unit;
  }, []);

  const togglePurchaseItem = useCallback(
    (item: StockItem) => {
      const norm = getPurchaseNormKey(item.name);
      updatePurchaseDraft((prev) => {
        const next = { ...prev };
        if (next[norm]) {
          delete next[norm];
        } else {
          next[norm] = {
            qty: getSuggestedOrderQty(item, getEffectiveTh(item)),
            unit: getCleanUnitForItem(item),
          };
        }
        return next;
      });
    },
    [getPurchaseNormKey, updatePurchaseDraft, getEffectiveTh, getCleanUnitForItem]
  );

  const handleUpdateDraftEntry = useCallback(
    (itemName: string, entry: PurchaseOrderDraftEntry) => {
      const norm = getPurchaseNormKey(itemName);
      updatePurchaseDraft((prev) => ({
        ...prev,
        [norm]: {
          qty: Math.max(1, entry.qty || 1),
          unit: entry.unit || "יח'",
          ...(entry.note !== undefined ? { note: entry.note } : {}),
        },
      }));
    },
    [getPurchaseNormKey, updatePurchaseDraft]
  );

  const handleRemoveDraftEntry = useCallback(
    (itemName: string) => {
      const norm = getPurchaseNormKey(itemName);
      updatePurchaseDraft((prev) => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
    },
    [getPurchaseNormKey, updatePurchaseDraft]
  );

  const handleAutoFillLowStockToPurchase = useCallback(() => {
    updatePurchaseDraft((prev) => {
      const next = { ...prev };
      lowStockItems.forEach((item) => {
        const norm = getPurchaseNormKey(item.name);
        if (!next[norm]) {
          next[norm] = {
            qty: getSuggestedOrderQty(item, getEffectiveTh(item)),
            unit: getCleanUnitForItem(item),
          };
        }
      });
      return next;
    });
  }, [lowStockItems, getPurchaseNormKey, getEffectiveTh, getCleanUnitForItem, updatePurchaseDraft]);

  const handleClearPurchaseDraft = useCallback(() => {
    updatePurchaseDraft(() => ({}));
  }, [updatePurchaseDraft]);

  const selectedPurchaseItems = useMemo(() => {
    const lines: PurchaseOrderExportLine[] = [];
    stockList.forEach((item, idx) => {
      const norm = getPurchaseNormKey(item.name);
      const entry = purchaseDraft[norm];
      if (!entry) return;
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      lines.push({
        displayNumber: getDisplayNum(item, idx),
        name: item.name,
        currentStock: safeQty,
        minThreshold: getEffectiveTh(item),
        orderQty: Math.max(1, entry.qty || 1),
        orderUnit: entry.unit || getCleanUnitForItem(item),
        packageSize: item.packageSize || detectPackageSize(item.name),
        note: entry.note,
      });
    });
    return lines;
  }, [stockList, purchaseDraft, getPurchaseNormKey, getDisplayNum, getEffectiveTh, getCleanUnitForItem]);

  const totalDraftOrderUnits = useMemo(
    () => selectedPurchaseItems.reduce((sum, l) => sum + l.orderQty, 0),
    [selectedPurchaseItems]
  );

  const allVisibleSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((it) => Boolean(purchaseDraft[getPurchaseNormKey(it.name)]));
  }, [filteredItems, purchaseDraft, getPurchaseNormKey]);

  const handleToggleSelectAllVisible = useCallback(() => {
    updatePurchaseDraft((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) {
        filteredItems.forEach((it) => {
          delete next[getPurchaseNormKey(it.name)];
        });
      } else {
        filteredItems.forEach((it) => {
          const norm = getPurchaseNormKey(it.name);
          if (!next[norm]) {
            next[norm] = {
              qty: getSuggestedOrderQty(it, getEffectiveTh(it)),
              unit: getCleanUnitForItem(it),
            };
          }
        });
      }
      return next;
    });
  }, [allVisibleSelected, filteredItems, getPurchaseNormKey, getEffectiveTh, getCleanUnitForItem, updatePurchaseDraft]);

  const handleQuickExportExcel = useCallback(() => {
    if (selectedPurchaseItems.length === 0) return;
    downloadPurchaseOrderExcel(selectedPurchaseItems, {
      branchName: tenantName,
      createdAt: new Date(),
      isEmergencyMode,
    });
  }, [selectedPurchaseItems, tenantName, isEmergencyMode]);

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
            <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto">
              <button
                onClick={() => selectFilterType('all')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                הכל ({stats.total})
              </button>
              <button
                onClick={() => selectFilterType('low')}
                className={`px-3.5 py-2 rounded-xl font-black whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'low'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                ⚠️ חוסרים ({stats.low})
              </button>
              <button
                onClick={() => selectFilterType('out')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'out'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                אזל ({stats.out})
              </button>
              <button
                onClick={() => selectFilterType('ok')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === 'ok'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                תקין ({stats.ok})
              </button>
              <button
                onClick={() => selectFilterType('inactive')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
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
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t border-slate-200/70">
            
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Add New Stock Item Button */}
              <button
                onClick={handleOpenCreateItem}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                title="הוספת פריט חדש למחסן"
              >
                <PlusCircle className="w-4 h-4" />
                <span>הוסף פריט למחסן 📦</span>
              </button>

              {/* Smart Medical Grouping Button (With Safe Confirmation Modal) */}
              {onOrganizeLogically && (
                <button
                  onClick={() => setIsOrganizeConfirmOpen(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-2xl shadow-2xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  title="קיבוץ וארגון אוטומטי של המחסן לפי קטגוריות רפואיות מסודרות (דורש אישור)"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>ארגון חכם לפי קטגוריות 🩺</span>
                </button>
              )}

              {/* Mobile Stock Scanner QR */}
              <button
                onClick={() => setIsMobileStockQRModalOpen(true)}
                className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-2xl shadow-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                title="סריקת קוד QR לספירת מלאי מהטלפון בין המדפים"
              >
                <Smartphone className="w-4 h-4" />
                <span>QR ספירת מלאי במובייל 📱</span>
              </button>

              {/* Department QR Cards Generator & Print */}
              <button
                onClick={() => setIsDeptQRModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-2xl shadow-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                title="הפקת כרטיסיות QR עם הוראות להדפסה ותלייה בכל מחלקה"
              >
                <QrCode className="w-4 h-4" />
                <span>כרטיסיות QR למחלקות 🏷️</span>
              </button>

              {/* Purchase Order Excel Builder Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsPurchaseSelectionMode((prev) => !prev)}
                className={`text-xs sm:text-sm font-black px-3.5 py-2 rounded-2xl shadow-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
                  isPurchaseSelectionMode || selectedPurchaseItems.length > 0
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-teal-600/25'
                    : 'bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300'
                }`}
                title="מצב סימון פריטים להזמנת רכש וייצוא ל-Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isPurchaseSelectionMode ? 'סיום בחירה להזמנה' : 'טופס הזמנת רכש (Excel)'}</span>
                {selectedPurchaseItems.length > 0 && (
                  <span className="bg-white text-teal-800 text-[11px] font-black px-2 py-0.5 rounded-full">
                    {selectedPurchaseItems.length}
                  </span>
                )}
              </button>
            </div>

          </div>

          {/* Purchase Order Selection Mode Strip */}
          {isPurchaseSelectionMode ? (
            <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs text-teal-950 font-bold">
                <FileSpreadsheet className="w-4 h-4 text-teal-700 shrink-0" />
                <span>
                  מצב הכנת הזמנת רכש: סמנו תיבות בטבלה ({selectedPurchaseItems.length} נבחרו • {totalDraftOrderUnits} יח'/אריזות)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAutoFillLowStockToPurchase}
                  disabled={lowStockItems.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>סמן חוסרים ({lowStockItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-black cursor-pointer transition-colors"
                >
                  פתח וערוך טופס ({selectedPurchaseItems.length})
                </button>
                <button
                  type="button"
                  onClick={handleQuickExportExcel}
                  disabled={selectedPurchaseItems.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ייצוא ל-Excel (.xlsx)</span>
                </button>
                {selectedPurchaseItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearPurchaseDraft}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer transition-colors"
                  >
                    נקה
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPurchaseSelectionMode(false)}
                  className="p-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-600 border border-slate-300 cursor-pointer"
                  title="סגור מצב סימון"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : selectedPurchaseItems.length > 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  קיימת טיוטת הזמנת רכש שמורה ({selectedPurchaseItems.length} פריטים • {totalDraftOrderUnits} יח'/אריזות)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPurchaseSelectionMode(true)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold cursor-pointer"
                >
                  המשך סימון בטבלה
                </button>
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 font-black cursor-pointer"
                >
                  פתח טופס
                </button>
                <button
                  type="button"
                  onClick={handleQuickExportExcel}
                  className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-black flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ייצוא ל-Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearPurchaseDraft}
                  className="px-2 py-1 rounded-lg text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
                >
                  נקה
                </button>
              </div>
            </div>
          ) : null}
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
              const th = getEffectiveTh(item);
              const isLow = item.currentStock < th;
              const isOut = item.currentStock === 0;
              const currentUnit = item.unit || "יח'";
              const norm = getPurchaseNormKey(item.name);
              const draftEntry = purchaseDraft[norm];
              const isSelectedForOrder = Boolean(draftEntry);

              return (
                <div
                  key={item.name}
                  className={`p-3.5 space-y-3 transition-colors ${
                    isPurchaseSelectionMode && isSelectedForOrder
                      ? 'bg-teal-50/70 ring-1 ring-inset ring-teal-300'
                      : isOut
                      ? 'bg-slate-100/70'
                      : isLow
                      ? 'bg-red-50/50'
                      : 'bg-white'
                  }`}
                >
                  {/* Top Row: Order Checkbox (in Selection Mode), Index, Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        {isPurchaseSelectionMode && (
                          <label
                            className="inline-flex items-center gap-1 cursor-pointer shrink-0 bg-slate-100 hover:bg-teal-100 px-1.5 py-1 rounded-lg border border-slate-200"
                            title="סמן פריט זה לטופס הזמנת רכש (Excel)"
                          >
                            <input
                              type="checkbox"
                              checked={isSelectedForOrder}
                              onChange={() => togglePurchaseItem(item)}
                              className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
                            />
                          </label>
                        )}
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          #{getDisplayNum(item, idx)}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm leading-snug">
                          {item.name}
                        </h4>
                      </div>
                      {(item.packageSize || detectPackageSize(item.name)) && (
                        <div className="text-[10px] text-indigo-700 font-bold inline-flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 w-fit">
                          <span>📦</span>
                          <span>{item.packageSize || detectPackageSize(item.name)} יח' במארז</span>
                        </div>
                      )}
                      {isPurchaseSelectionMode && isSelectedForOrder && draftEntry && (
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap bg-white border border-teal-300 rounded-xl px-2 py-1.5">
                          <span className="text-[11px] font-black text-teal-800">כמות להזמנה:</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateDraftEntry(item.name, {
                                ...draftEntry,
                                qty: Math.max(1, draftEntry.qty - 1),
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={draftEntry.qty}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              handleUpdateDraftEntry(item.name, {
                                ...draftEntry,
                                qty: isNaN(parsed) || parsed < 1 ? 1 : parsed,
                              });
                            }}
                            className="w-14 text-center py-1 rounded-lg border border-teal-400 bg-emerald-50 text-slate-900 font-mono font-black text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateDraftEntry(item.name, {
                                ...draftEntry,
                                qty: draftEntry.qty + 1,
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <select
                            value={draftEntry.unit}
                            onChange={(e) =>
                              handleUpdateDraftEntry(item.name, {
                                ...draftEntry,
                                unit: e.target.value,
                              })
                            }
                            className="px-2 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 text-xs font-bold"
                          >
                            {PACKAGING_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.value}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
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
                        onUpdateStockItem(name, newQty, item.minThreshold || globalThreshold, currentUnit, item.isActive !== false, item.limitByPatients)
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
                        onUpdateStockItem(name, currentStock, minTh, unit, item.isActive !== false, item.limitByPatients)
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
              <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600">
                <th className="py-3 px-2 w-16 text-center">
                  {isPurchaseSelectionMode ? (
                    <label
                      className="inline-flex items-center justify-center gap-1 cursor-pointer"
                      title="סמן / בטל סימון לכל הפריטים המוצגים לטופס הזמנה"
                    >
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleToggleSelectAllVisible}
                        className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
                      />
                      <span className="text-[11px] text-teal-700 font-black">הכל</span>
                    </label>
                  ) : (
                    <span>מס'</span>
                  )}
                </th>
                <th className="py-3 px-3 min-w-[260px]">שם המוצר / פריט</th>
                <th className="py-3 px-2 w-44 text-center">יתרת מלאי</th>
                <th className="py-3 px-2 w-44 text-center">סף ואריזה</th>
                <th className="py-3 px-2 w-28 text-center">סטטוס</th>
                <th className="py-3 px-2 w-40 text-center">פעולות</th>
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
                  const norm = getPurchaseNormKey(item.name);
                  const draftEntry = purchaseDraft[norm];
                  const isSelectedForOrder = Boolean(draftEntry);

                  return (
                    <tr
                      key={item.name}
                      className={`transition-colors ${
                        isPurchaseSelectionMode && isSelectedForOrder
                          ? 'bg-teal-50/70 hover:bg-teal-50'
                          : isInactive
                          ? 'bg-slate-100/70 opacity-70'
                          : isOut
                          ? 'bg-slate-50/80'
                          : isLow
                          ? 'bg-red-50/40 hover:bg-red-50/70'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Col 1: Index & Reorder Arrows OR Purchase Order Checkbox in Selection Mode */}
                      <td className="py-2 px-1.5 text-center font-mono font-bold text-slate-400">
                        {isPurchaseSelectionMode ? (
                          <label
                            className="inline-flex items-center justify-center gap-1.5 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-teal-100/60"
                            title="סמן פריט זה לטופס הזמנת רכש (Excel)"
                          >
                            <input
                              type="checkbox"
                              checked={isSelectedForOrder}
                              onChange={() => togglePurchaseItem(item)}
                              className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700">{getDisplayNum(item, idx)}</span>
                          </label>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {onMoveItem && (
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => onMoveItem(item.name || item.id, 'up')}
                                  className="p-0.5 rounded hover:bg-sky-100 text-slate-400 hover:text-sky-700 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                  title="הזז פריט שורה אחת למעלה ▲"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === filteredItems.length - 1}
                                  onClick={() => onMoveItem(item.name || item.id, 'down')}
                                  className="p-0.5 rounded hover:bg-sky-100 text-slate-400 hover:text-sky-700 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                  title="הזז פריט שורה אחת למטה ▼"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <span className="min-w-[20px] text-xs font-bold text-slate-600">{getDisplayNum(item, idx)}</span>
                          </div>
                        )}
                      </td>

                      {/* Col 2: Product Name (Full Width!) */}
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap leading-snug">
                          <span>{item.name}</span>
                          {(item.packageSize || detectPackageSize(item.name)) && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 whitespace-nowrap" title="כמות יחידות במארז">
                              📦 {item.packageSize || detectPackageSize(item.name)} יח' במארז
                            </span>
                          )}
                          {isInactive && (
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                              בהשהייה
                            </span>
                          )}
                          {item.limitByPatients && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-0.5 whitespace-nowrap" title="הזמנה מוגבלת למספר המטופלים במחלקה">
                              👥 מוגבל למטופלים
                            </span>
                          )}
                        </div>

                        {isPurchaseSelectionMode && isSelectedForOrder && draftEntry && (
                          <div className="mt-2 inline-flex items-center gap-1.5 flex-wrap bg-white border border-teal-300 rounded-xl px-2.5 py-1 shadow-2xs">
                            <span className="text-[11px] font-black text-teal-800">כמות להזמנה:</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateDraftEntry(item.name, {
                                  ...draftEntry,
                                  qty: Math.max(1, draftEntry.qty - 1),
                                })
                              }
                              className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={draftEntry.qty}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                handleUpdateDraftEntry(item.name, {
                                  ...draftEntry,
                                  qty: isNaN(parsed) || parsed < 1 ? 1 : parsed,
                                });
                              }}
                              className="w-14 text-center py-0.5 rounded-md border border-teal-400 bg-emerald-50 text-slate-900 font-mono font-black text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateDraftEntry(item.name, {
                                  ...draftEntry,
                                  qty: draftEntry.qty + 1,
                                })
                              }
                              className="w-6 h-6 rounded-md bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <select
                              value={draftEntry.unit}
                              onChange={(e) =>
                                handleUpdateDraftEntry(item.name, {
                                  ...draftEntry,
                                  unit: e.target.value,
                                })
                              }
                              className="px-1.5 py-0.5 rounded-md border border-slate-300 bg-slate-50 text-slate-900 text-[11px] font-bold cursor-pointer"
                            >
                              {PACKAGING_UNITS.map((u) => (
                                <option key={u.value} value={u.value}>
                                  {u.value}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setIsPurchaseModalOpen(true)}
                              className="text-[11px] font-bold text-teal-700 hover:underline px-1 cursor-pointer"
                            >
                              פתח בטופס
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Interactive Stock Adjuster */}
                      <td className="py-2.5 px-2 text-center">
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
                      <td className="py-2.5 px-2 text-center">
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
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        {isInactive ? (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-[11px] font-bold">
                            ⏸️ מושהה
                          </span>
                        ) : isOut ? (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 px-2 py-1 rounded-full text-[11px] font-bold">
                            ⚪ אזל ({item.currentStock})
                          </span>
                        ) : isLow ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black animate-pulse border ${
                            isEmergencyMode
                              ? 'bg-red-600 text-white border-red-700 shadow-xs'
                              : 'bg-red-100 text-red-700 border-red-300'
                          }`}>
                            ⚠️ נמוך ({item.currentStock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full text-[11px] font-bold">
                            🟢 תקין ({item.currentStock})
                          </span>
                        )}
                      </td>

                      {/* Actions: Limit by Patients, Edit, Pause/Resume, Delete */}
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Quick Toggle: Limit by patients */}
                          <button
                            type="button"
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
                            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                              item.limitByPatients
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                : 'bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 border-slate-200'
                            }`}
                            title={
                              item.limitByPatients
                                ? 'מוגבל למטופלים (לחץ לביטול)'
                                : 'הגבל כמות הזמנה לפי מספר מטופלים'
                            }
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>

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
                            onClick={() => onUpdateStockItem(item.name, safeQty, item.minThreshold || globalThreshold, currentUnit, isInactive ? true : false, item.limitByPatients)}
                            className={`px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
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
                                <span>הקפא</span>
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
            {' '}• פעילים באפליקציה: <strong className="text-emerald-700">{catalog.activeList.length}</strong>
          </div>
          <div className="text-slate-400">
            * בכל הדפסה רגילה מבוצע קיזוז מהמלאי. בלחיצה על «העתק» לא מבוצע שום קיזוז
          </div>
        </div>

      </div>

      {/* Floating Purchase Order Summary Bar (Only during Selection Mode) */}
      {isPurchaseSelectionMode && selectedPurchaseItems.length > 0 && !isPurchaseModalOpen && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 max-w-4xl mx-auto z-40 animate-fadeIn">
          <div className="bg-slate-900 text-white rounded-2xl p-3 sm:px-5 sm:py-3.5 shadow-2xl border border-teal-500/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                {selectedPurchaseItems.length}
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-white">
                  נבחרו {selectedPurchaseItems.length} פריטים לטופס הזמנת רכש
                </div>
                <div className="text-[11px] text-teal-200">
                  סה"כ כמות להזמנה: <strong className="font-mono">{totalDraftOrderUnits}</strong> יח' / אריזות
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleClearPurchaseDraft}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                נקה בחירה
              </button>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>פתח וערוך טופס</span>
              </button>
              <button
                type="button"
                onClick={handleQuickExportExcel}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-xs sm:text-sm font-black shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>ייצוא ל-Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Builder & Excel Export Modal */}
      <PurchaseOrderModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        stockList={stockList}
        displayNumberByNormName={catalog.displayNumberByNormName}
        draft={purchaseDraft}
        onUpdateDraftEntry={handleUpdateDraftEntry}
        onRemoveDraftEntry={handleRemoveDraftEntry}
        onAutoFillLowStock={handleAutoFillLowStockToPurchase}
        onClearDraft={handleClearPurchaseDraft}
        lowStockActiveCount={lowStockItems.length}
        getEffectiveThreshold={getEffectiveTh}
        packagingUnits={PACKAGING_UNITS}
        branchName={tenantName}
        isEmergencyMode={isEmergencyMode}
      />

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
        tenantId={tenantId}
        tenantName={tenantName}
      />

      {/* Item Creation & Edit Modal */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        itemToEdit={itemToEdit}
        totalItemsCount={stockList.length}
        itemIndex={itemToEdit ? stockList.findIndex((i) => i.name === itemToEdit.name || i.id === itemToEdit.id) + 1 : undefined}
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

      {/* Confirmation Dialog for Smart Category Organization */}
      {isOrganizeConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center shadow-2xl border border-slate-200 space-y-4 text-slate-900">
            <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto border-4 border-indigo-50">
              <Sparkles className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">סידור מחדש לפי קטגוריות רפואיות?</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                פעולה זו תסדר מחדש באופן אוטומטי את כל הפריטים במחסן לפי קטגוריות רפואיות מסודרות (כפפות, מיגון, מזרקים, מחטים, חבישות, עירויים...).
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-2xl mt-3 text-right">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>שימו לב: הסדר הידני שלכם ישתנה!</span>
                </div>
                <span>אם סידרתם את המחסן בסדר ידני מותאם אישית, פעולה זו תחליף את הסדר הנוכחי. מומלץ לוודא ששמרתם גיבוי ענן לפני כן.</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOrganizeConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ביטול — שמור על הסדר הנוכחי שלי
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onOrganizeLogically) {
                    onOrganizeLogically();
                    setIsOrganizeConfirmOpen(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>כן, סדר מחדש לפי קטגוריות ✓</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Restore from Cloud Backup */}
      {isRestoreBackupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center shadow-2xl border border-slate-200 space-y-4 text-slate-900">
            <div className="w-14 h-14 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto border-4 border-sky-50">
              <RotateCcw className="w-7 h-7 text-sky-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">שחזור סידור המחסן מגיבוי ענן?</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                פעולה זו תשחזר את סידור הפריטים והמלאי מהגיבוי האחרון שנשמר בענן Firestore.
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                כל שינוי במיקומי הפריטים שנעשה מאז הגיבוי האחרון יוחלף בסדר שנשמר בגיבוי.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRestoreBackupModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onRestoreBackup) {
                    onRestoreBackup();
                    setIsRestoreBackupModalOpen(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-sky-600/30 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>שחזר מגיבוי ענן ✓</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
