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
} from 'lucide-react';
import { InstallAppModal } from '../portal/InstallAppModal';

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
  const toastTimeoutRef = useRef<any>(null);

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

  // Auto-sync on initial mount
  useEffect(() => {
    if (onSyncWithCloud) {
      onSyncWithCloud();
    }
  }, []);

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

  // Filtered Items strictly synced with PC sorting
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
          return (a.currentStock || 0) - (b.currentStock || 0);
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
                onClick={onSyncWithCloud}
                disabled={isSyncingCloud}
                className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow transition-all cursor-pointer active:scale-95"
                title="סנכרן מלאי עכשיו מול ענן"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>סנכרן</span>
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
        {/* Floating Toast Notification on Save */}
        {lastSavedInfo && (
          <div className="bg-emerald-600 text-white p-2.5 px-3 rounded-2xl shadow-xl flex items-center justify-between gap-2 text-xs font-bold animate-in slide-in-from-top duration-200 border border-emerald-400">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
              <span className="truncate">
                <strong>{lastSavedInfo.name}</strong> עודכן ל-
                <span className="font-mono underline font-black text-sm px-1">{lastSavedInfo.qty}</span>
                ונשמר בענן!
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
              const th = getEffectiveTh(item);
              const isInactive = item.isActive === false;
              const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
              const routineTh = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : 10;
              const currentUnit = item.unit || "יח'";
              const isLow = !isInactive && safeQty < th;
              const isOut = !isInactive && safeQty === 0;
              const isLimitedByPatients = Boolean(item.limitByPatients);

              return (
                <div
                  key={item.id || item.name || idx}
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
                                disabled={idx === filteredItems.length - 1}
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
                          handleItemChange(
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
                      onClick={() =>
                        handleItemChange(
                          item.name,
                          Math.max(0, safeQty - 10),
                          routineTh,
                          currentUnit,
                          item.isActive !== false,
                          isLimitedByPatients
                        )
                      }
                      className="w-12 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer border border-slate-700"
                    >
                      -10
                    </button>

                    {/* -1 */}
                    <button
                      type="button"
                      onClick={() =>
                        handleItemChange(
                          item.name,
                          Math.max(0, safeQty - 1),
                          routineTh,
                          currentUnit,
                          item.isActive !== false,
                          isLimitedByPatients
                        )
                      }
                      className="w-12 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer border border-slate-700"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    {/* Actual Stock Display / Direct Input */}
                    <div className="flex-1 max-w-[110px] relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        value={safeQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          handleItemChange(
                            item.name,
                            isNaN(val) ? 0 : Math.max(0, val),
                            routineTh,
                            currentUnit,
                            item.isActive !== false,
                            isLimitedByPatients
                          );
                        }}
                        className="w-full h-11 text-center font-mono font-black text-lg bg-white text-slate-950 rounded-lg border border-slate-300 focus:outline-none focus:border-sky-500 shadow-inner"
                      />
                    </div>

                    {/* +1 */}
                    <button
                      type="button"
                      onClick={() =>
                        handleItemChange(
                          item.name,
                          safeQty + 1,
                          routineTh,
                          currentUnit,
                          item.isActive !== false,
                          isLimitedByPatients
                        )
                      }
                      className="w-12 h-11 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md shadow-sky-600/30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* +10 */}
                    <button
                      type="button"
                      onClick={() =>
                        handleItemChange(
                          item.name,
                          safeQty + 10,
                          routineTh,
                          currentUnit,
                          item.isActive !== false,
                          isLimitedByPatients
                        )
                      }
                      className="w-12 h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md shadow-indigo-600/30"
                    >
                      +10
                    </button>
                  </div>

                  {/* Threshold, Unit & Options Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                    {/* Minimum Threshold Input */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                      <span className="text-[11px] font-bold text-slate-400">סף מינימום:</span>
                      <input
                        type="number"
                        min={1}
                        value={routineTh}
                        onChange={(e) => {
                          const newTh = Math.max(1, parseInt(e.target.value, 10) || 1);
                          handleItemChange(
                            item.name,
                            safeQty,
                            newTh,
                            currentUnit,
                            item.isActive !== false,
                            isLimitedByPatients
                          );
                        }}
                        className="w-12 text-center font-mono font-black text-xs bg-slate-800 text-amber-300 border border-slate-600 rounded-md py-0.5 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                        title="שנה את כמות סף המינימום לפריט זה"
                      />
                      {isEmergencyMode && (
                        <span className="text-[10px] text-red-400 font-bold mr-0.5">(חירום: {th})</span>
                      )}
                    </div>

                    {/* Unit Selector */}
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400">אריזה:</span>
                      <select
                        value={currentUnit}
                        onChange={(e) =>
                          handleItemChange(
                            item.name,
                            safeQty,
                            routineTh,
                            e.target.value,
                            item.isActive !== false,
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
                        handleItemChange(
                          item.name,
                          safeQty,
                          routineTh,
                          currentUnit,
                          item.isActive !== false,
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
              <span className={stats.low > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                חוסרים: {stats.low}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">מסונכרן עם המחשב ו-Google Sheets</span>
          </div>

          <button
            onClick={onSyncWithCloud}
            disabled={isSyncingCloud}
            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'מסנכרן כעת...' : 'סנכרן עכשיו 🔄'}</span>
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
