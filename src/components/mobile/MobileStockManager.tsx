import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  SlidersHorizontal,
  Users,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Smartphone,
  Download,
  ArrowUp,
  ChevronUp,
  ChevronDown,
  Printer,
  Copy,
} from 'lucide-react';
import { InstallAppModal } from '../portal/InstallAppModal';
import { categorizeItem, groupAndSortStockItems } from '../../utils/stockGrouper';
import { printReorderListHtml } from '../../utils/pdfGenerator';
import { printEmergencyReorderListHtml } from '../../utils/emergencyPdfGenerator';

interface MobileStockManagerProps {
  stock: Record<string, StockItem>;
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
  onSyncWithCloud?: () => void;
  isSyncingCloud?: boolean;
  onMoveItem?: (idOrName: string, direction: 'up' | 'down') => void;
  onSaveFullItem?: (savedItem: StockItem, oldNameOrId?: string, targetPosition?: number) => void;
  onDeleteItem?: (idOrName: string) => void;
  onBackToMain?: () => void;
}

interface MobileStockCardProps {
  item: StockItem;
  idx: number;
  totalFiltered: number;
  isEmergencyMode: boolean;
  effectiveTh: number;
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
  totalFiltered,
  isEmergencyMode,
  effectiveTh,
  onItemChange,
  onMoveItem,
}) => {
  const isInactive = item.isActive === false;
  const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
  const routineTh = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : 10;
  const currentUnit = item.unit || "יח'";
  const isLow = !isInactive && safeQty < effectiveTh;
  const isOut = !isInactive && safeQty === 0;
  const isLimitedByPatients = Boolean(item.limitByPatients);

  // Local state for quantity input to allow free typing and clearing without premature resets
  const [qtyVal, setQtyVal] = useState<string>(String(safeQty));
  const [isQtyFocused, setIsQtyFocused] = useState(false);

  useEffect(() => {
    if (!isQtyFocused) {
      setQtyVal(String(safeQty));
    }
  }, [safeQty, isQtyFocused]);

  const commitQty = (rawVal: string) => {
    const trimmed = (rawVal || '').trim();
    const parsed = parseInt(trimmed, 10);
    const finalQty = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setQtyVal(String(finalQty));
    if (finalQty !== safeQty) {
      onItemChange(item.name, finalQty, routineTh, currentUnit, !isInactive, isLimitedByPatients);
    }
  };

  const adjustQty = (delta: number) => {
    const nextQty = Math.max(0, safeQty + delta);
    setQtyVal(String(nextQty));
    onItemChange(item.name, nextQty, routineTh, currentUnit, !isInactive, isLimitedByPatients);
  };

  // Local state for minimum threshold input to allow free typing and clearing
  const [thVal, setThVal] = useState<string>(String(routineTh));
  const [isThFocused, setIsThFocused] = useState(false);

  useEffect(() => {
    if (!isThFocused) {
      setThVal(String(routineTh));
    }
  }, [routineTh, isThFocused]);

  const commitTh = (rawVal: string) => {
    const trimmed = (rawVal || '').trim();
    const parsed = parseInt(trimmed, 10);
    const finalTh = isNaN(parsed) ? routineTh : Math.max(1, parsed);
    setThVal(String(finalTh));
    if (finalTh !== routineTh) {
      onItemChange(item.name, safeQty, finalTh, currentUnit, !isInactive, isLimitedByPatients);
    }
  };

  const adjustTh = (delta: number) => {
    const nextTh = Math.max(1, routineTh + delta);
    setThVal(String(nextTh));
    onItemChange(item.name, safeQty, nextTh, currentUnit, !isInactive, isLimitedByPatients);
  };

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-md ${
        isInactive
          ? 'bg-slate-900/60 border-slate-800 opacity-75'
          : isOut
          ? 'bg-slate-900 border-red-500/60 ring-1 ring-red-500/30'
          : isLow
          ? isEmergencyMode
            ? 'bg-red-950/40 border-red-500 ring-1 ring-red-500/60'
            : 'bg-amber-950/30 border-amber-500/50'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      {/* Title & Status Row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Index & Reorder on Mobile */}
            <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800">
              {onMoveItem && (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveItem(item.name || item.id, 'up')}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                    title="הזז למעלה"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === totalFiltered - 1}
                    onClick={() => onMoveItem(item.name || item.id, 'down')}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                    title="הזז למטה"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
              <span className="text-[11px] font-mono font-bold text-slate-400">
                #{item.colIndex ? item.colIndex - 3 : idx + 1}
              </span>
            </div>

            <h4 className="font-bold text-sm text-white leading-snug">
              {item.name}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
              isInactive
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : isOut
                ? 'bg-red-600 text-white border-red-500'
                : isLow
                ? isEmergencyMode
                  ? 'bg-red-600 text-white border-red-500 animate-pulse'
                  : 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {isInactive
              ? '⏸️ מושהה'
              : isOut
              ? '⚪ אזל'
              : isLow
              ? `⚠️ חוסר`
              : '🟢 תקין'}
          </span>

          {/* Quick Pause/Play Toggle Button */}
          <button
            onClick={() =>
              onItemChange(
                item.name,
                safeQty,
                routineTh,
                currentUnit,
                isInactive, // toggle
                isLimitedByPatients
              )
            }
            className={`p-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
              isInactive
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/70 hover:bg-emerald-900'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={isInactive ? 'החזר לשימוש פעיל' : 'הקפא פריט (מושהה)'}
          >
            {isInactive ? (
              <PlayCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <PauseCircle className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Adjuster Controls (Large Touch Buttons for Mobile) */}
      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between gap-1.5 mb-2.5">
        {/* -10 */}
        <button
          type="button"
          onClick={() => adjustQty(-10)}
          className="w-12 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer border border-slate-700"
          title="הורד 10"
        >
          -10
        </button>

        {/* -1 */}
        <button
          type="button"
          onClick={() => adjustQty(-1)}
          className="w-12 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer border border-slate-700"
          title="הורד 1"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Actual Stock Direct Input - fully editable, auto-selects, commits on blur/enter */}
        <div className="flex-1 max-w-[110px] relative">
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            value={qtyVal}
            onFocus={(e) => {
              setIsQtyFocused(true);
              e.target.select();
            }}
            onChange={(e) => setQtyVal(e.target.value)}
            onBlur={() => {
              setIsQtyFocused(false);
              commitQty(qtyVal);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full h-11 text-center font-mono font-black text-lg bg-white text-slate-950 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            title="הקלד כמות מלאי ידנית (טפיחה בוחרת את כל המספר)"
          />
        </div>

        {/* +1 */}
        <button
          type="button"
          onClick={() => adjustQty(1)}
          className="w-12 h-11 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md shadow-sky-600/30"
          title="הוסף 1"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* +10 */}
        <button
          type="button"
          onClick={() => adjustQty(10)}
          className="w-12 h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md shadow-indigo-600/30"
          title="הוסף 10"
        >
          +10
        </button>
      </div>

      {/* Threshold, Unit & Options Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
        {/* Minimum Threshold Input with - and + mini buttons and auto-select typing */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 shrink-0">סף מינימום:</span>
          <button
            type="button"
            onClick={() => adjustTh(-1)}
            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-300 font-bold flex items-center justify-center cursor-pointer text-xs border border-slate-700"
            title="הורד סף מינימום ב-1"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={1}
            value={thVal}
            onFocus={(e) => {
              setIsThFocused(true);
              e.target.select();
            }}
            onChange={(e) => setThVal(e.target.value)}
            onBlur={() => {
              setIsThFocused(false);
              commitTh(thVal);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-12 h-6 text-center font-mono font-black text-xs bg-slate-800 text-amber-300 border border-slate-600 rounded-md py-0.5 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            title="שנה את כמות סף המינימום לפריט זה (הקלד ישירות או השתמש ב-+/-)"
          />
          <button
            type="button"
            onClick={() => adjustTh(1)}
            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-300 font-bold flex items-center justify-center cursor-pointer text-xs border border-slate-700"
            title="העלה סף מינימום ב-1"
          >
            <Plus className="w-3 h-3" />
          </button>
          {isEmergencyMode && (
            <span className="text-[10px] text-red-400 font-bold mr-0.5">(חירום: {effectiveTh})</span>
          )}
        </div>

        {/* Unit Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-400">אריזה:</span>
          <select
            value={currentUnit}
            onChange={(e) =>
              onItemChange(
                item.name,
                safeQty,
                routineTh,
                e.target.value,
                !isInactive,
                isLimitedByPatients
              )
            }
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-sky-300 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            {PACKAGING_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Patient Limit Toggle */}
        <button
          onClick={() =>
            onItemChange(
              item.name,
              safeQty,
              routineTh,
              currentUnit,
              !isInactive,
              !isLimitedByPatients
            )
          }
          className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            isLimitedByPatients
              ? 'bg-purple-950 text-purple-300 border border-purple-600/60 shadow-xs'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>{isLimitedByPatients ? '👥 מוגבל למטופלים ✓' : '👥 הגבל'}</span>
        </button>
      </div>
    </div>
  );
});

export function MobileStockManager({
  stock,
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
  const [globalThreshold] = useState<number>(10);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [lastSavedInfo, setLastSavedInfo] = useState<{ name: string; qty: number; time: string } | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [isLocalSyncing, setIsLocalSyncing] = useState(false);
  const toastTimeoutRef = useRef<any>(null);

  const isSyncing = isSyncingCloud || isLocalSyncing;

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
        text: `מסד הנתונים בענן (Cloud Firestore) סונכרן בהצלחה! (${res?.count ?? stockList.length} פריטים, ${timeStr})`,
      });
      setTimeout(() => setSyncStatusMsg(null), 4500);
    } catch (e: any) {
      setSyncStatusMsg({
        text: `שגיאה בסנכרון מסד הנתונים: ${e?.message || 'אנא ודאו שיש חיבור לרשת'}`,
        isError: true,
      });
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } finally {
      setIsLocalSyncing(false);
    }
  };

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

  const stockList = useMemo(() => Object.values(stock), [stock]);

  // Helper to calculate effective threshold (x3 in emergency mode)
  const getEffectiveTh = (item: StockItem) => {
    const baseTh = item.minThreshold || globalThreshold;
    return isEmergencyMode ? baseTh * 3 : baseTh;
  };

  // Trigger update with visual confirmation
  const handleItemChange = (
    name: string,
    newQty: number,
    minThreshold?: number,
    unit?: string,
    isActive?: boolean,
    limitByPatients?: boolean
  ) => {
    const safeQty = Math.max(0, newQty);
    onUpdateStockItem(name, safeQty, minThreshold, unit, isActive, limitByPatients);

    // Show instant cloud save confirmation toast
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLastSavedInfo({ name, qty: safeQty, time: timeStr });
    toastTimeoutRef.current = setTimeout(() => {
      setLastSavedInfo(null);
    }, 2500);
  };

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
  }, [stockList, isEmergencyMode, globalThreshold]);

  const [isWhatsAppCopied, setIsWhatsAppCopied] = useState(false);

  // Generate and print the A4 Reorder Shortage sheet directly from mobile
  const handlePrintShortageReport = () => {
    const rawDeficit = stockList.filter((item) => {
      if (!item || !item.name || item.isActive === false) return false;
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < th;
    });

    if (isEmergencyMode) {
      printEmergencyReorderListHtml(stockList, globalThreshold, 3);
    } else {
      printReorderListHtml(rawDeficit, globalThreshold);
    }
  };

  // Copy WhatsApp formatted order list grouped by item type
  const handleCopyWhatsAppShortage = () => {
    const rawDeficit = stockList.filter((item) => {
      if (!item || !item.name || item.isActive === false) return false;
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < th;
    });

    const categoryGroups = groupAndSortStockItems(rawDeficit);

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
        const posText = item.colIndex ? `[#${item.colIndex - 3}] ` : '';
        text += `${itemCounter}. ${posText}*${item.name}* ${isZero ? '⚠️(אזל!)' : ''}\n   יתרה: ${safeQty} ${unit} | סף: ${th} | *להזמנה: ${deficit} ${unit}*\n`;
      });
      text += `\n`;
    });

    text += `_הופק מאפליקציית ניהול מחסן StorePrint_`;

    navigator.clipboard.writeText(text);
    setIsWhatsAppCopied(true);
    setTimeout(() => setIsWhatsAppCopied(false), 3000);
  };

  // Filtered Items strictly synced with PC sorting:
  // In 'low' and 'out' tabs: grouped by item category and ordered by warehouse layout (colIndex)
  const filteredItems = useMemo(() => {
    return stockList
      .filter((item) => {
        const isInactive = item.isActive === false;

        if (filterType === 'inactive') {
          if (!isInactive) return false;
        } else if (filterType === 'all') {
          // Show all
        } else {
          // Exclude inactive from active tabs
          if (isInactive) return false;
          const th = getEffectiveTh(item);
          const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
          if (filterType === 'low' && safeQty >= th) return false;
          if (filterType === 'out' && safeQty > 0) return false;
          if (filterType === 'ok' && safeQty < th) return false;
        }

        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          return (
            item.name.toLowerCase().includes(q) ||
            String(item.colIndex).includes(q) ||
            (item.unit && item.unit.toLowerCase().includes(q))
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (filterType === 'low' || filterType === 'out') {
          const catA = categorizeItem(a.name);
          const catB = categorizeItem(b.name);
          if (catA.group !== catB.group) return catA.group - catB.group;
          return (a.colIndex || 0) - (b.colIndex || 0);
        }
        return (a.colIndex || 0) - (b.colIndex || 0);
      });
  }, [stockList, filterType, searchQuery, isEmergencyMode, globalThreshold]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 text-sm selection:bg-sky-500 selection:text-white" dir="rtl">
      {/* Clean Fixed Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-4 py-2.5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
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
              <h2 className="font-black text-sm sm:text-base text-white truncate flex items-center gap-1.5">
                <span>ספירת מלאי במחסן 📦</span>
                <span className="text-[11px] text-slate-400 font-mono font-normal">({stats.total})</span>
              </h2>
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

            {onOpenEmergencyConfirm && (
              <button
                onClick={onOpenEmergencyConfirm}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow transition-all cursor-pointer ${
                  isEmergencyMode
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-red-950 text-red-300 border border-red-800'
                }`}
                title={isEmergencyMode ? 'חזרה לשגרה (1X)' : 'מעבר לשעת חירום (3X)'}
              >
                <Siren className="w-3.5 h-3.5 text-white" />
                <span>{isEmergencyMode ? 'חירום X3' : 'חירום'}</span>
              </button>
            )}

            {onSyncWithCloud && (
              <button
                onClick={handleSyncClick}
                disabled={isSyncing}
                className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow transition-all cursor-pointer active:scale-95"
                title="סנכרן מלאי עכשיו מול מסד הנתונים בענן (Firestore)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'מסנכרן...' : 'סנכרן'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sticky Search Bar & Category Filters */}
      <div className="sticky top-[51px] z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2 space-y-2 shadow-sm">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Direct Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="חיפוש מהיר לפי שם פריט, יחידה או מספר..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-9 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
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

          {/* Quick Filter Tabs */}
          <div className="grid grid-cols-5 gap-1 text-[11px] font-black">
            <button
              onClick={() => setFilterType('all')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                filterType === 'all'
                  ? 'bg-sky-600 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              הכל ({stats.total})
            </button>
            <button
              onClick={() => setFilterType('low')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                filterType === 'low'
                  ? isEmergencyMode
                    ? 'bg-red-600 text-white shadow font-black'
                    : 'bg-amber-600 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {isEmergencyMode ? 'חירום' : 'חוסרים'} ({stats.low})
            </button>
            <button
              onClick={() => setFilterType('out')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                filterType === 'out'
                  ? 'bg-red-700 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              אזל ({stats.out})
            </button>
            <button
              onClick={() => setFilterType('ok')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                filterType === 'ok'
                  ? 'bg-emerald-600 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              תקין ({stats.ok})
            </button>
            <button
              onClick={() => setFilterType('inactive')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                filterType === 'inactive'
                  ? 'bg-slate-700 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="פריטים מושהים"
            >
              מושהה ({stats.inactive})
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        {/* Floating Database Sync Status Toast */}
        {syncStatusMsg && (
          <div
            className={`p-2.5 px-3 rounded-2xl shadow-xl flex items-center justify-between gap-2 text-xs font-bold animate-in slide-in-from-top duration-200 border ${
              syncStatusMsg.isError
                ? 'bg-red-600 text-white border-red-400'
                : 'bg-sky-600 text-white border-sky-400'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {syncStatusMsg.isError ? (
                <AlertTriangle className="w-4 h-4 text-red-100 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 text-sky-100 shrink-0" />
              )}
              <span className="truncate">{syncStatusMsg.text}</span>
            </div>
            <button
              onClick={() => setSyncStatusMsg(null)}
              className="p-0.5 hover:bg-white/20 rounded cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating Toast Notification on Save */}
        {lastSavedInfo && (
          <div className="bg-emerald-600 text-white p-2.5 px-3 rounded-2xl shadow-xl flex items-center justify-between gap-2 text-xs font-bold animate-in slide-in-from-top duration-200 border border-emerald-400">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
              <span className="truncate">
                <strong>{lastSavedInfo.name}</strong> עודכן ל-
                <span className="font-mono underline font-black text-sm px-1">{lastSavedInfo.qty}</span>
                ונשמר במסד הנתונים בענן (Firestore)!
              </span>
            </div>
            <span className="text-[10px] text-emerald-100 font-mono shrink-0">{lastSavedInfo.time}</span>
          </div>
        )}

        {/* Emergency Alert Banner inside mobile */}
        {isEmergencyMode && (
          <div className="bg-red-600/90 border border-red-500 text-white p-2.5 rounded-2xl flex items-center gap-2 shadow text-xs font-bold">
            <Siren className="w-4 h-4 shrink-0 animate-pulse" />
            <div>
              <span className="block font-black text-xs">נוהל שעת חירום פעיל (מלאי משולש X3)</span>
              <span className="text-red-100 text-[10px]">
                ספי המינימום חושבו פי 3.
              </span>
            </div>
          </div>
        )}

        {/* Shortage Reorder Report Quick Actions Banner (Visible when viewing shortages) */}
        {filterType === 'low' && filteredItems.length > 0 && (
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/60 border border-amber-600/50 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-lg animate-fadeIn">
            <div className="min-w-0">
              <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>דוח חוסרים והזמנת רכש ({filteredItems.length} פריטים)</span>
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">
                מקובץ לפי קטגוריות ומסודר לפי סדר המחסן שלך
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handlePrintShortageReport}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md cursor-pointer active:scale-95 transition-all"
                title="הדפס דוח חוסרים מסודר"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>הדפס דוח 🖨️</span>
              </button>
              <button
                onClick={handleCopyWhatsAppShortage}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow cursor-pointer active:scale-95 transition-all"
                title="העתק רשימת חוסרים ל-WhatsApp"
              >
                {isWhatsAppCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isWhatsAppCopied ? 'הועתק!' : 'WhatsApp'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Product Stock Cards List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-500" />
              <p className="font-bold text-sm">לא נמצאו פריטים</p>
              <p className="text-xs text-slate-500 mt-1">נסו לשנות את מונח החיפוש או לבחור בלשונית אחרת</p>
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

              return (
                <React.Fragment key={item.id || item.name || idx}>
                  {showCategoryDivider && (
                    <div className="pt-2 pb-0.5 flex items-center gap-2">
                      <div className="bg-slate-800/90 border border-slate-700 px-3 py-1 rounded-xl text-xs font-black text-sky-400 flex items-center gap-1.5 shadow-xs">
                        <span>📁</span>
                        <span>{currentCat}</span>
                      </div>
                      <div className="h-px bg-slate-800/80 flex-1"></div>
                    </div>
                  )}
                  <MobileStockCard
                    item={item}
                    idx={idx}
                    totalFiltered={filteredItems.length}
                    isEmergencyMode={isEmergencyMode}
                    effectiveTh={getEffectiveTh(item)}
                    onItemChange={handleItemChange}
                    onMoveItem={onMoveItem}
                  />
                </React.Fragment>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-20 left-4 z-40 p-3 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-full shadow-2xl border border-sky-400 flex items-center justify-center transition-all cursor-pointer"
          title="חזרה לראש העמוד"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Floating Bottom Bar with Live Sync Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 py-2.5 z-40 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-black text-white flex items-center gap-1.5">
              <span>סה"כ: {stats.total}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setFilterType('low')}
                className={`transition-colors cursor-pointer ${
                  stats.low > 0
                    ? 'text-amber-400 font-bold hover:underline'
                    : 'text-emerald-400'
                }`}
                title="הצג פריטים בחוסר"
              >
                חוסרים: {stats.low}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>מחובר ישירות למסד הנתונים בענן (Cloud Firestore)</span>
              {lastSyncTime && <span className="text-slate-400 font-normal mr-1">({lastSyncTime})</span>}
            </div>
          </div>

          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
            title="סנכרן ישירות מול מסד הנתונים בענן"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'מסנכרן כעת...' : 'סנכרן עכשיו 🔄'}</span>
          </button>
        </div>
      </div>

      {/* Install App Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}
