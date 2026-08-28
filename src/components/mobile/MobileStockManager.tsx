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
  onBackToMain?: () => void;
}

export function MobileStockManager({
  stock,
  isEmergencyMode = false,
  onOpenEmergencyConfirm,
  onUpdateStockItem,
  onSyncWithCloud,
  isSyncingCloud = false,
  onBackToMain,
}: MobileStockManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'ok' | 'inactive'>('all');
  const [globalThreshold] = useState<number>(10);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [lastSavedInfo, setLastSavedInfo] = useState<{ name: string; qty: number; time: string } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

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
    }, 3000);
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

  // Filtered Items
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
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-32 text-sm" dir="rtl">
      {/* Sticky Mobile Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBackToMain && (
              <button
                onClick={onBackToMain}
                className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
                title="חזרה למסך הראשי"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg text-white">ספירת מלאי במחסן 📱</span>
                <span className="px-2 py-0.5 text-[10px] font-black bg-sky-500/20 text-sky-300 rounded-full border border-sky-500/40 uppercase">
                  ענן חי
                </span>
              </div>
              <p className="text-[11px] text-slate-400">עדכון כמויות וסנכרון ישיר מול Google Sheets</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="הורדת והתקנת האפליקציה למסך הבית"
            >
              <Smartphone className="w-3.5 h-3.5 animate-bounce" />
              <span className="hidden sm:inline">התקן אפליקציה</span>
              <span className="sm:hidden">התקן</span>
            </button>

            {onOpenEmergencyConfirm && (
              <button
                onClick={onOpenEmergencyConfirm}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow transition-all cursor-pointer ${
                  isEmergencyMode
                    ? 'bg-red-600 text-white animate-pulse ring-1 ring-red-400'
                    : 'bg-red-950/80 text-red-300 border border-red-800/80'
                }`}
                title={isEmergencyMode ? 'חזרה לשגרה (1X)' : 'מעבר לשעת חירום (3X)'}
              >
                <Siren className="w-3.5 h-3.5 text-white" />
                <span>{isEmergencyMode ? 'חירום X3 🚨' : 'חירום'}</span>
              </button>
            )}

            {onSyncWithCloud && (
              <button
                onClick={onSyncWithCloud}
                disabled={isSyncingCloud}
                className="px-3 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
                title="סנכרן מלאי עכשיו מול גוגל שיטס"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingCloud ? 'מסנכרן...' : 'סנכרן ☁️'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-3 space-y-3.5">
        
        {/* Live Cloud Status Indicator */}
        <div className="bg-slate-800/90 border border-slate-700/90 rounded-2xl p-2.5 px-3.5 flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <div className="flex items-center gap-1 font-bold text-slate-200">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>סנכרון ענן פעיל ({stats.total} פריטים במחסן)</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {isSyncingCloud ? '⏳ מעדכן נתונים...' : '🟢 מחובר ומסונכרן'}
          </span>
        </div>

        {/* Floating Toast Notification on Save */}
        {lastSavedInfo && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between gap-2 text-xs font-bold animate-in slide-in-from-top duration-200 border border-emerald-400">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
              <span className="truncate">
                <strong>{lastSavedInfo.name}</strong> עודכן ל-
                <span className="font-mono underline font-black text-sm px-1">{lastSavedInfo.qty}</span>
                ונשמר בענן ובטבלה!
              </span>
            </div>
            <span className="text-[10px] text-emerald-100 font-mono shrink-0">{lastSavedInfo.time}</span>
          </div>
        )}

        {/* Emergency Alert Banner inside mobile */}
        {isEmergencyMode && (
          <div className="bg-red-600/90 border border-red-500 text-white p-3 rounded-2xl flex items-center gap-2.5 shadow-lg animate-pulse text-xs font-bold">
            <Siren className="w-5 h-5 shrink-0" />
            <div>
              <span className="block font-black text-sm">נוהל שעת חירום פעיל (מלאי משולש X3)</span>
              <span className="text-red-100 text-[11px]">
                ספי המינימום חושבו פי 3. פריטים באדום דורשים מילוי מיידי.
              </span>
            </div>
          </div>
        )}

        {/* Quick Search & Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="חפש פריט לפי שם, יחידה או מספר..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-9 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="grid grid-cols-5 gap-1 text-[11px] font-black">
            <button
              onClick={() => setFilterType('all')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-sky-600 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              הכל ({stats.total})
            </button>
            <button
              onClick={() => setFilterType('low')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
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
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                filterType === 'out'
                  ? 'bg-red-700 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              אזל ({stats.out})
            </button>
            <button
              onClick={() => setFilterType('ok')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                filterType === 'ok'
                  ? 'bg-emerald-600 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              תקין ({stats.ok})
            </button>
            <button
              onClick={() => setFilterType('inactive')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                filterType === 'inactive'
                  ? 'bg-slate-700 text-white shadow font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="פריטים מושהים שלא בשימוש כרגע"
            >
              מושהה ({stats.inactive})
            </button>
          </div>
        </div>

        {/* Product Stock Cards List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl border border-slate-800">
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
                  className={`p-3.5 sm:p-4 rounded-3xl border transition-all shadow-md ${
                    isInactive
                      ? 'bg-slate-900/70 border-slate-800 opacity-75'
                      : isOut
                      ? 'bg-slate-800/90 border-red-500/60 ring-1 ring-red-500/30'
                      : isLow
                      ? isEmergencyMode
                        ? 'bg-red-950/40 border-red-500 ring-2 ring-red-500/60'
                        : 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-slate-800/90 border-slate-700/90'
                  }`}
                >
                  {/* Title & Status Row */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded-md">
                          #{item.colIndex || idx + 1}
                        </span>
                        <h4 className="font-extrabold text-sm text-white leading-snug">
                          {item.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>
                          סף מינימום:{' '}
                          <strong className="text-slate-200">{routineTh}</strong>
                          {isEmergencyMode && (
                            <span className="text-red-400 font-bold mr-1">(חירום: {th})</span>
                          )}
                        </span>
                        <span>•</span>
                        <span>
                          אריזה: <strong className="text-sky-300">{currentUnit}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
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
                          ? '⚪ אזל מהמלאי'
                          : isLow
                          ? `⚠️ חוסר (${safeQty} < ${th})`
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
                        title={isInactive ? 'החזר לשימוש פעיל' : 'סמן כלא בשימוש'}
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
                  <div className="bg-slate-950/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-1.5 mb-2.5">
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
                      className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer border border-slate-700"
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
                      className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer border border-slate-700"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    {/* Number Display / Direct Input */}
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
                        className="w-full h-12 text-center font-mono font-black text-xl bg-white text-slate-950 rounded-xl border-2 border-slate-300 focus:outline-none focus:border-sky-500 shadow-inner"
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
                      className="w-12 h-12 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md shadow-sky-600/30"
                    >
                      <Plus className="w-5 h-5" />
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
                      className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md shadow-indigo-600/30"
                    >
                      +10
                    </button>
                  </div>

                  {/* Secondary Quick Controls (Units, Patient Limit, Quick Presets) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
                    {/* Unit Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">יחידה:</span>
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
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-sky-300 focus:outline-none focus:border-sky-500 cursor-pointer"
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
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        isLimitedByPatients
                          ? 'bg-purple-950 text-purple-300 border border-purple-600/60 shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{isLimitedByPatients ? '👥 מוגבל למטופלים ✓' : '👥 הגבל למטופלים'}</span>
                    </button>

                    {/* Fast Presets (0 or minThreshold) */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          handleItemChange(
                            item.name,
                            0,
                            routineTh,
                            currentUnit,
                            item.isActive !== false,
                            isLimitedByPatients
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-mono border border-slate-700 cursor-pointer"
                        title="אפס כמות ל-0"
                      >
                        אפס (0)
                      </button>
                      <button
                        onClick={() =>
                          handleItemChange(
                            item.name,
                            routineTh,
                            routineTh,
                            currentUnit,
                            item.isActive !== false,
                            isLimitedByPatients
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 text-[10px] font-bold border border-sky-800 cursor-pointer"
                        title="קבע כמות שווה לסף המינימום"
                      >
                        סף ({routineTh})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Bottom Bar with Live Sync Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 z-40 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-black text-white flex items-center gap-1.5">
              <span>סה"כ במחסן: {stats.total}</span>
              <span>•</span>
              <span className={stats.low > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                חוסרים: {stats.low}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">כל שינוי נשמר מיידית ב-Google Sheets</span>
          </div>

          <button
            onClick={onSyncWithCloud}
            disabled={isSyncingCloud}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin' : ''}`} />
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
