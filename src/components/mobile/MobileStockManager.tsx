import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { StockItem } from '../../types';
import { PACKAGING_UNITS } from '../WarehouseView';
import {
  Package,
  Search,
  Plus,
  Minus,
  ArrowRight,
  RefreshCw,
  Siren,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Cloud,
  Check,
  X,
  Users,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Smartphone,
  ArrowUp,
  ChevronUp,
  ChevronDown,
  Printer,
  Copy,
  Edit,
  PlusCircle,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { InstallStockModal } from './InstallStockModal';
import { ItemModal } from '../ItemModal';
import { PurchaseOrderModal, PurchaseOrderDraftEntry } from '../PurchaseOrderModal';
import { categorizeItem, groupAndSortStockItems } from '../../utils/stockGrouper';
import { printReorderListHtml } from '../../utils/pdfGenerator';
import { printEmergencyReorderListHtml } from '../../utils/emergencyPdfGenerator';
import {
  downloadPurchaseOrderExcel,
  getSuggestedOrderQty,
  PurchaseOrderExportLine,
} from '../../utils/excelExport';
import {
  detectPackageSize,
  getCanonicalWarehouseCatalog,
  normalizeProductName,
} from '../../utils/stockManager';

interface MobileStockManagerProps {
  stock: Record<string, StockItem>;
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
  ) => void | Promise<boolean | void>;
  onSyncWithCloud?: () => Promise<any> | any;
  isSyncingCloud?: boolean;
  onMoveItem?: (idOrName: string, direction: 'up' | 'down') => void;
  onSaveFullItem?: (savedItem: StockItem, oldNameOrId?: string, targetPosition?: number) => void;
  onDeleteItem?: (idOrName: string) => void;
  onBackToMain?: () => void;
}

interface MobileStockCardProps {
  item: StockItem;
  idx: number;
  displayNumber?: number;
  totalFiltered: number;
  isEmergencyMode: boolean;
  effectiveTh: number;
  canReorder: boolean;
  canEditFull: boolean;
  isPurchaseSelectionMode: boolean;
  draftEntry?: PurchaseOrderDraftEntry;
  onTogglePurchaseItem: (item: StockItem) => void;
  onUpdatePurchaseEntry: (itemName: string, entry: PurchaseOrderDraftEntry) => void;
  onOpenEditItem: (item: StockItem) => void;
  onInputFocusChange: (focused: boolean) => void;
  onItemChange: (
    name: string,
    newQty: number,
    minThreshold?: number,
    unit?: string,
    isActive?: boolean,
    limitByPatients?: boolean
  ) => void;
  onMoveItem?: (idOrName: string, direction: 'up' | 'down') => void;
}

const MobileStockCard: React.FC<MobileStockCardProps> = React.memo(({
  item,
  idx,
  displayNumber,
  totalFiltered,
  isEmergencyMode,
  effectiveTh,
  canReorder,
  canEditFull,
  isPurchaseSelectionMode,
  draftEntry,
  onTogglePurchaseItem,
  onUpdatePurchaseEntry,
  onOpenEditItem,
  onInputFocusChange,
  onItemChange,
  onMoveItem,
}) => {
  const isInactive = item.isActive === false;
  const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
  const routineTh = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : 10;
  const rawPkgSize = item.packageSize || detectPackageSize(item.name);
  const currentUnit =
    item.unit && item.unit !== 'מטר'
      ? item.unit
      : rawPkgSize && rawPkgSize > 1
      ? 'מארז'
      : "יח'";
  const isLow = !isInactive && safeQty < effectiveTh;
  const isOut = !isInactive && safeQty === 0;
  const isLimitedByPatients = Boolean(item.limitByPatients);
  const isSelectedForOrder = Boolean(draftEntry);

  const [qtyVal, setQtyVal] = useState<string>(String(safeQty));
  const [qtyDirty, setQtyDirty] = useState(false);
  const isQtyFocusedRef = useRef(false);
  const latestQtyRef = useRef<number>(safeQty);

  useEffect(() => {
    latestQtyRef.current = safeQty;
    if (!isQtyFocusedRef.current) {
      setQtyVal(String(safeQty));
      setQtyDirty(false);
    }
  }, [safeQty]);

  const commitQty = (rawVal: string) => {
    const trimmed = (rawVal || '').trim();
    if (trimmed === '') {
      setQtyVal(String(safeQty));
      setQtyDirty(false);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    const finalQty = isNaN(parsed) ? safeQty : Math.max(0, parsed);
    latestQtyRef.current = finalQty;
    setQtyVal(String(finalQty));
    setQtyDirty(false);
    if (finalQty !== safeQty) {
      onItemChange(item.name, finalQty, routineTh, currentUnit, !isInactive, isLimitedByPatients);
    }
  };

  const adjustQty = (delta: number) => {
    const parsed = parseInt((qtyVal || '').trim(), 10);
    const baseQty = isQtyFocusedRef.current && !isNaN(parsed) ? parsed : latestQtyRef.current;
    const nextQty = Math.max(0, baseQty + delta);
    latestQtyRef.current = nextQty;
    setQtyVal(String(nextQty));
    setQtyDirty(false);
    onItemChange(item.name, nextQty, routineTh, currentUnit, !isInactive, isLimitedByPatients);
  };

  const [thVal, setThVal] = useState<string>(String(routineTh));
  const isThFocusedRef = useRef(false);

  useEffect(() => {
    if (!isThFocusedRef.current) {
      setThVal(String(routineTh));
    }
  }, [routineTh]);

  const commitTh = (rawVal: string) => {
    const trimmed = (rawVal || '').trim();
    if (trimmed === '') {
      setThVal(String(routineTh));
      return;
    }
    const parsed = parseInt(trimmed, 10);
    const finalTh = isNaN(parsed) ? routineTh : Math.max(1, parsed);
    setThVal(String(finalTh));
    if (finalTh !== routineTh) {
      onItemChange(item.name, latestQtyRef.current, finalTh, currentUnit, !isInactive, isLimitedByPatients);
    }
  };

  const adjustTh = (delta: number) => {
    const parsed = parseInt((thVal || '').trim(), 10);
    const baseTh = isThFocusedRef.current && !isNaN(parsed) ? parsed : routineTh;
    const nextTh = Math.max(1, baseTh + delta);
    setThVal(String(nextTh));
    onItemChange(item.name, latestQtyRef.current, nextTh, currentUnit, !isInactive, isLimitedByPatients);
  };

  const selectAllOnFocus = (el: HTMLInputElement) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(0, el.value.length);
        } catch {}
      });
    }
  };

  return (
    <div
      className={`p-3 rounded-2xl border transition-colors shadow-sm [overflow-anchor:none] ${
        isPurchaseSelectionMode && isSelectedForOrder
          ? 'bg-teal-950/35 border-teal-500/70 ring-1 ring-teal-500/40'
          : isInactive
          ? 'bg-slate-900/60 border-slate-800 opacity-75'
          : isOut
          ? 'bg-slate-900 border-red-500/60'
          : isLow
          ? isEmergencyMode
            ? 'bg-red-950/40 border-red-500'
            : 'bg-amber-950/25 border-amber-500/50'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      {/* Row 1: Checkbox (in order mode), #Index, Name, Badges & Actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isPurchaseSelectionMode && (
              <label
                className="inline-flex items-center justify-center p-1 rounded-lg bg-slate-950 border border-teal-500/50 cursor-pointer shrink-0"
                title="סמן פריט זה לטופס הזמנת רכש (Excel)"
              >
                <input
                  type="checkbox"
                  checked={isSelectedForOrder}
                  onChange={() => onTogglePurchaseItem(item)}
                  className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                />
              </label>
            )}

            <div className="inline-flex items-center gap-0.5 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 shrink-0">
              {canReorder && onMoveItem && (
                <div className="flex items-center">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveItem(item.name || item.id, 'up')}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 disabled:opacity-20 cursor-pointer"
                    title="הזז למעלה"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === totalFiltered - 1}
                    onClick={() => onMoveItem(item.name || item.id, 'down')}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 disabled:opacity-20 cursor-pointer"
                    title="הזז למטה"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <span className="text-[11px] font-mono font-bold text-slate-400">
                #{displayNumber ?? idx + 1}
              </span>
            </div>

            <h4 className="font-bold text-sm text-white leading-snug break-words">
              {item.name}
            </h4>

            {rawPkgSize && rawPkgSize > 1 && (
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/60 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                📦 {rawPkgSize} יח'
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black border whitespace-nowrap ${
              isInactive
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : isOut
                ? 'bg-red-600 text-white border-red-500'
                : isLow
                ? isEmergencyMode
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {isInactive ? '⏸️ מושהה' : isOut ? '⚪ אזל' : isLow ? '⚠️ חוסר' : '🟢 תקין'}
          </span>

          {canEditFull && (
            <button
              type="button"
              onClick={() => onOpenEditItem(item)}
              className="p-1.5 rounded-xl bg-slate-800 text-sky-400 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
              title="עריכה מלאה / הגדרת אריזה / מחיקה"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onItemChange(
                item.name,
                latestQtyRef.current,
                routineTh,
                currentUnit,
                isInactive,
                isLimitedByPatients
              )
            }
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              isInactive
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/70'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={isInactive ? 'החזר לשימוש פעיל' : 'הקפא פריט (מושהה)'}
          >
            {isInactive ? (
              <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <PauseCircle className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Purchase Order Inline Qty/Unit Strip (only when checked in Order Mode) */}
      {isPurchaseSelectionMode && isSelectedForOrder && draftEntry && (
        <div className="mb-2 bg-teal-950/60 border border-teal-500/50 rounded-xl p-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-black text-teal-300">כמות להזמנת רכש:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUpdatePurchaseEntry(item.name, {
                  ...draftEntry,
                  qty: Math.max(1, draftEntry.qty - 1),
                })
              }
              className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center border border-slate-700 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={draftEntry.qty}
              onFocus={() => onInputFocusChange(true)}
              onBlur={() => onInputFocusChange(false)}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                onUpdatePurchaseEntry(item.name, {
                  ...draftEntry,
                  qty: isNaN(parsed) || parsed < 1 ? 1 : parsed,
                });
              }}
              className="w-16 h-8 text-center rounded-lg border border-teal-400 bg-white text-slate-950 font-mono font-black text-base focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                onUpdatePurchaseEntry(item.name, {
                  ...draftEntry,
                  qty: draftEntry.qty + 1,
                })
              }
              className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <select
              value={draftEntry.unit}
              onChange={(e) =>
                onUpdatePurchaseEntry(item.name, {
                  ...draftEntry,
                  unit: e.target.value,
                })
              }
              className="h-8 px-2 rounded-lg bg-slate-900 border border-teal-500/50 text-teal-200 text-base sm:text-xs font-bold"
            >
              {PACKAGING_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.value}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Row 2: Main Quantity Touch Stepper (16px font stops iOS auto-zoom!) */}
      <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex items-center justify-between gap-1 mb-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => adjustQty(-10)}
          className="w-10 sm:w-11 h-10 rounded-lg bg-slate-800 active:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center transition-transform active:scale-95 cursor-pointer border border-slate-700 shrink-0"
          title="הורד 10"
        >
          -10
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => adjustQty(-1)}
          className="w-10 sm:w-11 h-10 rounded-lg bg-slate-800 active:bg-slate-700 text-slate-200 font-bold flex items-center justify-center transition-transform active:scale-95 cursor-pointer border border-slate-700 shrink-0"
          title="הורד 1"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-[68px] max-w-[120px] flex items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            pattern="[0-9]*"
            value={qtyVal}
            onFocus={(e) => {
              isQtyFocusedRef.current = true;
              onInputFocusChange(true);
              selectAllOnFocus(e.currentTarget);
            }}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^\d]/g, '');
              setQtyVal(cleaned);
              setQtyDirty(cleaned !== String(safeQty));
            }}
            onWheel={(e) => (e.target as HTMLElement).blur()}
            onBlur={() => {
              isQtyFocusedRef.current = false;
              onInputFocusChange(false);
              commitQty(qtyVal);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                isQtyFocusedRef.current = false;
                onInputFocusChange(false);
                setQtyVal(String(safeQty));
                setQtyDirty(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full h-10 text-center font-mono font-black text-base bg-white text-slate-950 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            title="הקלד כמות מלאי ידנית"
          />
          {qtyDirty && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitQty(qtyVal)}
              className="w-9 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer shadow"
              title="אשר שמירת כמות"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => adjustQty(1)}
          className="w-10 sm:w-11 h-10 rounded-lg bg-sky-600 active:bg-sky-500 text-white font-bold flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow shadow-sky-600/30 shrink-0"
          title="הוסף 1"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => adjustQty(10)}
          className="w-10 sm:w-11 h-10 rounded-lg bg-indigo-600 active:bg-indigo-500 text-white font-black text-xs flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow shadow-indigo-600/30 shrink-0"
          title="הוסף 10"
        >
          +10
        </button>
      </div>

      {/* Row 3: Compact Threshold, Unit Selector (16px avoids iOS zoom), Patient Limit */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/80 text-xs flex-wrap">
        <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400">סף:</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => adjustTh(-1)}
            className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer border border-slate-700"
            title="הורד סף ב-1"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            pattern="[0-9]*"
            value={thVal}
            onFocus={(e) => {
              isThFocusedRef.current = true;
              onInputFocusChange(true);
              selectAllOnFocus(e.currentTarget);
            }}
            onChange={(e) => setThVal(e.target.value.replace(/[^\d]/g, ''))}
            onWheel={(e) => (e.target as HTMLElement).blur()}
            onBlur={() => {
              isThFocusedRef.current = false;
              onInputFocusChange(false);
              commitTh(thVal);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                isThFocusedRef.current = false;
                onInputFocusChange(false);
                setThVal(String(routineTh));
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-12 h-7 text-center font-mono font-black text-base bg-slate-800 text-amber-300 border border-slate-600 rounded-md focus:outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            title="סף מינימום"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => adjustTh(1)}
            className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer border border-slate-700"
            title="העלה סף ב-1"
          >
            <Plus className="w-3 h-3" />
          </button>
          {isEmergencyMode && (
            <span className="text-[10px] text-red-400 font-bold">×3: {effectiveTh}</span>
          )}
        </div>

        <select
          value={currentUnit}
          onChange={(e) =>
            onItemChange(
              item.name,
              latestQtyRef.current,
              routineTh,
              e.target.value,
              !isInactive,
              isLimitedByPatients
            )
          }
          className="h-8 bg-slate-950 border border-slate-700 rounded-xl px-2 text-base sm:text-xs font-bold text-sky-300 focus:outline-none focus:border-sky-500 cursor-pointer"
          title="יחידת מידה"
        >
          {PACKAGING_UNITS.map((u) => (
            <option key={u.value} value={u.value} title={u.label}>
              {u.value}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() =>
            onItemChange(
              item.name,
              latestQtyRef.current,
              routineTh,
              currentUnit,
              !isInactive,
              !isLimitedByPatients
            )
          }
          className={`h-8 px-2 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
            isLimitedByPatients
              ? 'bg-purple-950 text-purple-300 border border-purple-600/60'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title="הגבל הזמנות למספר מטופלים"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isLimitedByPatients ? 'מוגבל ✓' : 'הגבל'}</span>
        </button>
      </div>
    </div>
  );
});

export function MobileStockManager({
  stock,
  tenantId,
  tenantName,
  isEmergencyMode = false,
  onOpenEmergencyConfirm,
  onUpdateStockItem,
  onSyncWithCloud,
  isSyncingCloud = false,
  onMoveItem,
  onSaveFullItem,
  onDeleteItem,
  onBackToMain,
}: MobileStockManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'ok' | 'inactive'>('all');
  const [filterSession, setFilterSession] = useState(0);
  const [globalThreshold] = useState<number>(10);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isAnyInputFocused, setIsAnyInputFocused] = useState(false);

  const [lastSavedInfo, setLastSavedInfo] = useState<{
    name: string;
    qty: number;
    time: string;
    offline?: boolean;
  } | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [isLocalSyncing, setIsLocalSyncing] = useState(false);
  const toastTimeoutRef = useRef<any>(null);

  // Item Create / Full Edit Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<StockItem | null>(null);

  // Purchase Order Draft & Excel Export
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
  const [isPurchaseSelectionMode, setIsPurchaseSelectionMode] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(purchaseDraftStorageKey);
      setPurchaseDraft(raw ? JSON.parse(raw) : {});
    } catch {
      setPurchaseDraft({});
    }
  }, [purchaseDraftStorageKey]);

  const pinnedItemNamesRef = useRef<Set<string>>(new Set());
  const lastFilterContextRef = useRef({ filterType, searchQuery, filterSession });
  if (
    lastFilterContextRef.current.filterType !== filterType ||
    lastFilterContextRef.current.searchQuery !== searchQuery ||
    lastFilterContextRef.current.filterSession !== filterSession
  ) {
    pinnedItemNamesRef.current.clear();
    lastFilterContextRef.current = { filterType, searchQuery, filterSession };
  }

  const selectFilterType = (nextFilter: 'all' | 'low' | 'out' | 'ok' | 'inactive') => {
    pinnedItemNamesRef.current.clear();
    setFilterType(nextFilter);
    setFilterSession((s) => s + 1);
  };

  const isSyncing = isSyncingCloud || isLocalSyncing;

  const handleForceUpdate = async () => {
    if (typeof window === 'undefined') return;
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } finally {
      window.location.reload();
    }
  };

  const handleSyncClick = async () => {
    if (!onSyncWithCloud) return;
    setIsLocalSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res: any = await onSyncWithCloud();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastSyncTime(timeStr);
      setSyncStatusMsg({
        text: `סונכרן מול הענן (${res?.count ?? stockList.length} פריטים • ${timeStr})`,
      });
      setTimeout(() => setSyncStatusMsg(null), 3500);
    } catch (e: any) {
      setSyncStatusMsg({
        text: `שגיאת סנכרון: ${e?.message || 'בדקו חיבור אינטרנט'}`,
        isError: true,
      });
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsLocalSyncing(false);
    }
  };

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

  const catalog = useMemo(() => getCanonicalWarehouseCatalog(stock), [stock]);
  const stockList = catalog.orderedList;
  const getDisplayNum = useCallback(
    (item: StockItem, fallbackIdx: number) =>
      catalog.displayNumberByNormName.get(
        normalizeProductName(item.name) || item.name.trim().toLowerCase()
      ) ?? fallbackIdx + 1,
    [catalog]
  );

  const getEffectiveTh = useCallback(
    (item: StockItem) => {
      const baseTh = item.minThreshold || globalThreshold;
      return isEmergencyMode ? baseTh * 3 : baseTh;
    },
    [globalThreshold, isEmergencyMode]
  );

  const handleInputFocusChange = useCallback((focused: boolean) => {
    if (focused) {
      setIsAnyInputFocused(true);
    } else {
      setTimeout(() => {
        if (typeof document !== 'undefined') {
          const active = document.activeElement?.tagName;
          if (active !== 'INPUT' && active !== 'TEXTAREA' && active !== 'SELECT') {
            setIsAnyInputFocused(false);
          }
        } else {
          setIsAnyInputFocused(false);
        }
      }, 80);
    }
  }, []);

  const handleItemChange = useCallback(
    async (
      name: string,
      newQty: number,
      minThreshold?: number,
      unit?: string,
      isActive?: boolean,
      limitByPatients?: boolean
    ) => {
      const safeQty = Math.max(0, newQty);
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      let savedRemote: boolean | void = true;
      try {
        savedRemote = await Promise.resolve(
          onUpdateStockItem(name, safeQty, minThreshold, unit, isActive, limitByPatients)
        );
      } catch {
        savedRemote = false;
      }

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastSavedInfo({
        name,
        qty: safeQty,
        time: timeStr,
        offline: !isOnline || savedRemote === false,
      });
      toastTimeoutRef.current = setTimeout(() => {
        setLastSavedInfo(null);
      }, 2200);
    },
    [onUpdateStockItem]
  );

  // Statistics
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

  const lowStockItems = useMemo(() => {
    const raw = stockList.filter((item) => {
      if (!item || !item.name || item.isActive === false) return false;
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < th;
    });
    return groupAndSortStockItems(raw);
  }, [stockList, getEffectiveTh]);

  // Purchase Order Draft Helpers
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
      stockList.forEach((item) => {
        if (!item || item.isActive === false) return;
        const th = getEffectiveTh(item);
        const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
        if (safeQty >= th) return;
        const norm = getPurchaseNormKey(item.name);
        if (!next[norm]) {
          next[norm] = {
            qty: getSuggestedOrderQty(item, th),
            unit: getCleanUnitForItem(item),
          };
        }
      });
      return next;
    });
  }, [stockList, getEffectiveTh, getPurchaseNormKey, getCleanUnitForItem, updatePurchaseDraft]);

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

  const handleQuickExportExcel = useCallback(() => {
    if (selectedPurchaseItems.length === 0) return;
    downloadPurchaseOrderExcel(selectedPurchaseItems, {
      branchName: tenantName,
      createdAt: new Date(),
      isEmergencyMode,
    });
  }, [selectedPurchaseItems, tenantName, isEmergencyMode]);

  const [isWhatsAppCopied, setIsWhatsAppCopied] = useState(false);

  const handlePrintShortageReport = () => {
    const rawDeficit = stockList.filter((item) => {
      if (!item || !item.name || item.isActive === false) return false;
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < th;
    });

    if (isEmergencyMode) {
      printEmergencyReorderListHtml(stockList, globalThreshold, 3, tenantName);
    } else {
      printReorderListHtml(rawDeficit, globalThreshold);
    }
  };

  const handleCopyWhatsAppShortage = () => {
    const rawDeficit = stockList.filter((item) => {
      if (!item || !item.name || item.isActive === false) return false;
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < th;
    });

    const categoryGroups = lowStockItems;

    let text = `🚨 *דוח חוסרי מלאי ורכש - ספירת מחסן*\n`;
    text += `📅 תאריך: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}\n`;
    if (isEmergencyMode) text += `⚠️ *נוהל שעת חירום (מלאי משולש X3)*\n`;
    text += `סה"כ פריטים בחוסר: ${rawDeficit.length} (${categoryGroups.length} קטגוריות)\n\n`;

    let itemCounter = 0;
    categoryGroups.forEach((grp) => {
      text += `📂 *${grp.groupName}:*\n`;
      grp.items.forEach((item: any) => {
        itemCounter++;
        const th = getEffectiveTh(item);
        const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
        const deficit = Math.max(1, th - safeQty);
        const unit = item.unit || "יח'";
        const isZero = safeQty === 0;
        const posText = `[#${getDisplayNum(item, itemCounter - 1)}] `;
        text += `${itemCounter}. ${posText}*${item.name}* ${isZero ? '⚠️(אזל!)' : ''}\n   יתרה: ${safeQty} ${unit} | סף: ${th} | *להזמנה: ${deficit} ${unit}*\n`;
      });
      text += `\n`;
    });

    text += `_הופק מאפליקציית ניהול מחסן StorePrint_`;

    navigator.clipboard.writeText(text);
    setIsWhatsAppCopied(true);
    setTimeout(() => setIsWhatsAppCopied(false), 3000);
  };

  const filteredItems = useMemo(() => {
    return stockList
      .filter((item) => {
        if (!item || !item.name) return false;

        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const numQuery = q.replace(/^#/, '');
          const displayNum = getDisplayNum(item, -1);
          const matchesQuery =
            item.name.toLowerCase().includes(q) ||
            (numQuery !== '' && displayNum > 0 && String(displayNum).includes(numQuery)) ||
            (numQuery !== '' && String(item.colIndex).includes(numQuery)) ||
            (item.unit && item.unit.toLowerCase().includes(q));
          if (!matchesQuery) return false;
        }

        const isInactive = item.isActive === false;
        let matchesStatus = true;

        if (filterType === 'inactive') {
          matchesStatus = isInactive;
        } else if (filterType === 'all') {
          matchesStatus = true;
        } else {
          if (isInactive) {
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

        if (filterType !== 'all' && pinnedItemNamesRef.current.has(item.name)) {
          return true;
        }

        return false;
      })
      .sort((a, b) => {
        if (filterType === 'low' || filterType === 'out') {
          const catA = categorizeItem(a.name);
          const catB = categorizeItem(b.name);
          if (catA.group !== catB.group) return catA.group - catB.group;
          return ((a.colIndex || 0) - (b.colIndex || 0)) || a.name.localeCompare(b.name, 'he');
        }
        return 0;
      });
  }, [stockList, filterType, searchQuery, filterSession, getEffectiveTh, getDisplayNum]);

  const canReorder = filterType === 'all' && searchQuery.trim() === '' && !isPurchaseSelectionMode;

  const handleOpenCreateItem = () => {
    setItemToEdit(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = useCallback((item: StockItem) => {
    setItemToEdit(item);
    setIsItemModalOpen(true);
  }, []);

  const handleSaveItemFromModal = (savedItem: StockItem, targetPosition?: number) => {
    if (onSaveFullItem) {
      onSaveFullItem(savedItem, itemToEdit?.name || itemToEdit?.id, targetPosition);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28 text-sm selection:bg-sky-500 selection:text-white"
      dir="rtl"
    >
      {/* Single Compact Sticky Header (~48px) — zero double-sticky keyboard squeeze */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-2.5 sm:px-4 py-2 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {onBackToMain && (
              <button
                type="button"
                onClick={onBackToMain}
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                title="חזרה למסך הראשי"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-black text-sm text-white truncate">ספירת מלאי 📦</h2>
                {tenantName && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[115px]">
                    {tenantName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onSaveFullItem && (
              <button
                type="button"
                onClick={handleOpenCreateItem}
                className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow cursor-pointer"
                title="הוסף פריט חדש למחסן"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">הוסף</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPurchaseSelectionMode((prev) => !prev)}
              className={`px-2 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors ${
                isPurchaseSelectionMode || selectedPurchaseItems.length > 0
                  ? 'bg-teal-600 text-white shadow'
                  : 'bg-slate-800 text-teal-300 border border-teal-500/40'
              }`}
              title="טופס הזמנת רכש (Excel)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
              {selectedPurchaseItems.length > 0 && (
                <span className="bg-white text-teal-900 text-[10px] font-black px-1.5 rounded-full">
                  {selectedPurchaseItems.length}
                </span>
              )}
            </button>

            {onOpenEmergencyConfirm && (
              <button
                type="button"
                onClick={onOpenEmergencyConfirm}
                className={`p-1.5 px-2 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer ${
                  isEmergencyMode
                    ? 'bg-red-600 text-white'
                    : 'bg-red-950/90 text-red-300 border border-red-800/80'
                }`}
                title={isEmergencyMode ? 'מצב חירום X3 פעיל (לחץ לשינוי)' : 'מעבר למצב חירום (X3)'}
              >
                <Siren className="w-3.5 h-3.5" />
                {isEmergencyMode && <span>X3</span>}
              </button>
            )}

            {onSyncWithCloud && (
              <button
                type="button"
                onClick={handleSyncClick}
                disabled={isSyncing}
                className="w-8 h-8 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white flex items-center justify-center cursor-pointer shrink-0"
                title="סנכרן עכשיו מול הענן"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={handleForceUpdate}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 flex items-center justify-center cursor-pointer shrink-0"
              title="רענן ומשוך גרסה עדכנית מהענן"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsInstallModalOpen(true)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 flex items-center justify-center cursor-pointer shrink-0"
              title="התקנת האפליקציה למסך הבית"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Non-shifting Floating Overlay Toasts (NEVER pushes list down/up under finger!) */}
      {(lastSavedInfo || syncStatusMsg) && (
        <div className="fixed top-14 left-3 right-3 max-w-md mx-auto z-50 pointer-events-none space-y-1.5">
          {lastSavedInfo && (
            <div
              className={`px-3 py-2 rounded-2xl shadow-2xl border flex items-center justify-between gap-2 text-xs font-bold ${
                lastSavedInfo.offline
                  ? 'bg-amber-600 text-white border-amber-400'
                  : 'bg-emerald-600 text-white border-emerald-400'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {lastSavedInfo.offline ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  <strong>{lastSavedInfo.name}</strong> ←{' '}
                  <span className="font-mono underline font-black">{lastSavedInfo.qty}</span>{' '}
                  {lastSavedInfo.offline ? '(נשמר מקומית — אין חיבור לענן)' : '(נשמר בענן ✓)'}
                </span>
              </div>
              <span className="text-[10px] opacity-90 font-mono shrink-0">{lastSavedInfo.time}</span>
            </div>
          )}

          {syncStatusMsg && (
            <div
              className={`px-3 py-2 rounded-2xl shadow-2xl border flex items-center gap-2 text-xs font-bold ${
                syncStatusMsg.isError
                  ? 'bg-red-600 text-white border-red-400'
                  : 'bg-sky-600 text-white border-sky-400'
              }`}
            >
              {syncStatusMsg.isError ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{syncStatusMsg.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-2.5">
        {/* Search & Filter Card inside flow (scrolls naturally so keyboard never gets squeezed by sticky filter bar!) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 space-y-2 shadow-sm">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => handleInputFocusChange(true)}
              onBlur={() => handleInputFocusChange(false)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי שם, יחידה או #מספר..."
              className="w-full pr-9 pl-9 py-2 bg-slate-800 border border-slate-700 rounded-xl text-base sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                title="נקה חיפוש"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1 text-[11px] font-black">
            <button
              type="button"
              onClick={() => selectFilterType('all')}
              className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                filterType === 'all' ? 'bg-sky-600 text-white shadow' : 'bg-slate-800 text-slate-400'
              }`}
            >
              הכל ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => selectFilterType('low')}
              className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                filterType === 'low'
                  ? isEmergencyMode
                    ? 'bg-red-600 text-white shadow'
                    : 'bg-amber-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isEmergencyMode ? 'חירום' : 'חוסר'} ({stats.low})
            </button>
            <button
              type="button"
              onClick={() => selectFilterType('out')}
              className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                filterType === 'out' ? 'bg-red-700 text-white shadow' : 'bg-slate-800 text-slate-400'
              }`}
            >
              אזל ({stats.out})
            </button>
            <button
              type="button"
              onClick={() => selectFilterType('ok')}
              className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                filterType === 'ok' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400'
              }`}
            >
              תקין ({stats.ok})
            </button>
            <button
              type="button"
              onClick={() => selectFilterType('inactive')}
              className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                filterType === 'inactive' ? 'bg-slate-700 text-white shadow' : 'bg-slate-800 text-slate-400'
              }`}
            >
              מושהה ({stats.inactive})
            </button>
          </div>
        </div>

        {/* Purchase Order Selection Banner when active */}
        {isPurchaseSelectionMode && (
          <div className="bg-teal-950/70 border border-teal-500/60 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-bold text-teal-100">
              📋 הזמנת רכש (Excel): נבחרו <strong className="font-mono">{selectedPurchaseItems.length}</strong> ({totalDraftOrderUnits} יח')
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleAutoFillLowStockToPurchase}
                disabled={stats.low === 0}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>סמן חוסרים ({stats.low})</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-teal-200 border border-teal-500/40 font-black cursor-pointer"
              >
                פתח טופס
              </button>
              <button
                type="button"
                onClick={handleQuickExportExcel}
                disabled={selectedPurchaseItems.length === 0}
                className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-black flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              {selectedPurchaseItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearPurchaseDraft}
                  className="px-2 py-1 rounded-lg bg-slate-800 text-rose-300 font-bold cursor-pointer"
                >
                  נקה
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPurchaseSelectionMode(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                title="סגור מצב סימון"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Emergency Alert Banner inside mobile */}
        {isEmergencyMode && (
          <div className="bg-red-600/90 border border-red-500 text-white p-2.5 rounded-2xl flex items-center gap-2 shadow text-xs font-bold">
            <Siren className="w-4 h-4 shrink-0" />
            <span>נוהל שעת חירום פעיל (מלאי משולש X3 — ספי המינימום הוכפלו פי 3)</span>
          </div>
        )}

        {/* Shortage Reorder Report Quick Actions Banner */}
        {filterType === 'low' && filteredItems.length > 0 && (
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/60 border border-amber-600/50 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="min-w-0">
              <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>דוח חוסרים ורכש ({stats.low} פריטים)</span>
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">מקובץ לפי קטגוריות</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePrintShortageReport}
                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>הדפס</span>
              </button>
              <button
                type="button"
                onClick={handleCopyWhatsAppShortage}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                {isWhatsAppCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isWhatsAppCopied ? 'הועתק!' : 'WhatsApp'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Product Stock Cards List (overflow-anchor: none stops browser jump-anchoring on dynamic content!) */}
        <div className="space-y-2.5 [overflow-anchor:none]">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-500" />
              <p className="font-bold text-sm">לא נמצאו פריטים</p>
              <p className="text-xs text-slate-500 mt-1">נסו לשנות את מילת החיפוש או לבחור לשונית אחרת</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isGroupedView = filterType === 'low' || filterType === 'out';
              const currentCat = isGroupedView ? categorizeItem(item.name).groupName : null;
              const prevCat =
                idx > 0 && isGroupedView
                  ? categorizeItem(filteredItems[idx - 1].name).groupName
                  : null;
              const showCategoryDivider = currentCat && currentCat !== prevCat;
              const norm = getPurchaseNormKey(item.name);

              return (
                <React.Fragment key={item.name}>
                  {showCategoryDivider && (
                    <div className="pt-2 pb-0.5 flex items-center gap-2">
                      <div className="bg-slate-800/90 border border-slate-700 px-3 py-1 rounded-xl text-xs font-black text-sky-400 flex items-center gap-1.5">
                        <span>📁</span>
                        <span>{currentCat}</span>
                      </div>
                      <div className="h-px bg-slate-800/80 flex-1"></div>
                    </div>
                  )}
                  <MobileStockCard
                    item={item}
                    idx={idx}
                    displayNumber={getDisplayNum(item, idx)}
                    totalFiltered={filteredItems.length}
                    isEmergencyMode={isEmergencyMode}
                    effectiveTh={getEffectiveTh(item)}
                    canReorder={canReorder}
                    canEditFull={Boolean(onSaveFullItem)}
                    isPurchaseSelectionMode={isPurchaseSelectionMode}
                    draftEntry={purchaseDraft[norm]}
                    onTogglePurchaseItem={togglePurchaseItem}
                    onUpdatePurchaseEntry={handleUpdateDraftEntry}
                    onOpenEditItem={handleOpenEditItem}
                    onInputFocusChange={handleInputFocusChange}
                    onItemChange={handleItemChange}
                    onMoveItem={onMoveItem}
                  />
                </React.Fragment>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Scroll to Top Button (hidden while typing so keyboard space stays clear) */}
      {showScrollTop && !isAnyInputFocused && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-20 left-4 z-40 p-3 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-full shadow-2xl border border-sky-400 flex items-center justify-center transition-all cursor-pointer"
          title="חזרה לראש העמוד וחיפוש"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Floating Bottom Bar (automatically hides while keyboard is open to avoid colliding with inputs!) */}
      {!isAnyInputFocused && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-3.5 py-2.5 z-40 shadow-2xl">
          {isPurchaseSelectionMode && selectedPurchaseItems.length > 0 ? (
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
              <div className="text-xs min-w-0">
                <div className="font-black text-white truncate">
                  {selectedPurchaseItems.length} פריטים בטופס ההזמנה ({totalDraftOrderUnits} יח')
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="px-3 py-2 bg-slate-800 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-black cursor-pointer"
                >
                  ערוך טופס
                </button>
                <button
                  type="button"
                  onClick={handleQuickExportExcel}
                  className="px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
              <div className="text-xs min-w-0">
                <div className="font-black text-white flex items-center gap-1.5">
                  <span>סה"כ: {stats.total}</span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => selectFilterType('low')}
                    className={`transition-colors cursor-pointer ${
                      stats.low > 0 ? 'text-amber-400 font-bold hover:underline' : 'text-emerald-400'
                    }`}
                  >
                    חוסרים: {stats.low}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mt-0.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                  <span className="truncate">Firestore פעיל</span>
                  {lastSyncTime && <span className="text-slate-400 font-normal">({lastSyncTime})</span>}
                </div>
              </div>

              {onSyncWithCloud && (
                <button
                  type="button"
                  onClick={handleSyncClick}
                  disabled={isSyncing}
                  className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer active:scale-95 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'מסנכרן...' : 'סנכרן 🔄'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Item Create / Edit / Delete Modal */}
      {onSaveFullItem && (
        <ItemModal
          isOpen={isItemModalOpen}
          onClose={() => setIsItemModalOpen(false)}
          itemToEdit={itemToEdit}
          totalItemsCount={stockList.length}
          itemIndex={
            itemToEdit
              ? stockList.findIndex((i) => i.name === itemToEdit.name || i.id === itemToEdit.id) + 1
              : undefined
          }
          onSave={handleSaveItemFromModal}
          onDelete={onDeleteItem}
        />
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
        lowStockActiveCount={stats.low}
        getEffectiveThreshold={getEffectiveTh}
        packagingUnits={PACKAGING_UNITS}
        branchName={tenantName}
        isEmergencyMode={isEmergencyMode}
      />

      {/* Install Stock App Modal */}
      <InstallStockModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        tenantId={tenantId}
        tenantName={tenantName}
      />
    </div>
  );
}
