import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

interface MobileStockManagerProps {
  stock: Record<string, StockItem>;
  isEmergencyMode?: boolean;
  onOpenEmergencyConfirm?: () => void;
  onUpdateStockItem: (name: string, newQty: number, minThreshold?: number, unit?: string) => void;
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
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [globalThreshold] = useState<number>(10);

  const stockList = useMemo(() => Object.values(stock), [stock]);

  // Helper to calculate effective threshold (x3 in emergency mode)
  const getEffectiveTh = (item: StockItem) => {
    const baseTh = item.minThreshold || globalThreshold;
    return isEmergencyMode ? baseTh * 3 : baseTh;
  };

  // Statistics
  const stats = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;

    stockList.forEach((item) => {
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

    return { total: stockList.length, ok, low, out };
  }, [stockList, isEmergencyMode, globalThreshold]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return stockList.filter((item) => {
      const th = getEffectiveTh(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;

      if (filterType === 'low' && safeQty >= th) return false;
      if (filterType === 'out' && safeQty > 0) return false;
      if (filterType === 'ok' && safeQty < th) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || String(item.colIndex).includes(q);
      }

      return true;
    }).sort((a, b) => {
      if (filterType === 'low' || filterType === 'out') {
        return (a.currentStock || 0) - (b.currentStock || 0);
      }
      return (a.colIndex || 0) - (b.colIndex || 0);
    });
  }, [stockList, filterType, searchQuery, isEmergencyMode, globalThreshold]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-28" dir="rtl">
      {/* Sticky Mobile Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-4 py-3 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToMain && (
              <button
                onClick={onBackToMain}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors cursor-pointer"
                title="חזרה"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-white">ספירת מלאי במחסן</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-500/20 text-sky-400 rounded-full border border-sky-500/30 uppercase">
                  מובייל
                </span>
              </div>
              <p className="text-xs text-slate-400">עדכון כמויות ואריזות בזמן אמת</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                <span>{isEmergencyMode ? 'חירום X3 🚨' : 'שעת חירום'}</span>
              </button>
            )}

            {onSyncWithCloud && (
              <button
                onClick={onSyncWithCloud}
                disabled={isSyncingCloud}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncingCloud ? 'סנכרון...' : 'סנכרון'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Emergency Alert Banner inside mobile */}
        {isEmergencyMode && (
          <div className="bg-red-600/90 border border-red-500 text-white p-3 rounded-2xl flex items-center gap-2.5 shadow-lg animate-pulse text-xs font-bold">
            <Siren className="w-5 h-5 shrink-0" />
            <div>
              <span className="block font-black text-sm">נוהל שעת חירום פעיל (מלאי משולש X3)</span>
              <span className="text-red-100 text-[11px]">ספי המינימום חושבו פי 3. פריטים באדום דורשים מילוי מיידי.</span>
            </div>
          </div>
        )}

        {/* Quick Search & Filters */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="חיפוש פריט לפי שם או מס' עמודה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Quick Filter Tabs */}
          <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-sky-600 text-white shadow'
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
                    : 'bg-amber-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {isEmergencyMode ? 'חירום' : 'חוסרים'} ({stats.low})
            </button>
            <button
              onClick={() => setFilterType('out')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                filterType === 'out'
                  ? 'bg-red-700 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              אזל ({stats.out})
            </button>
            <button
              onClick={() => setFilterType('ok')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                filterType === 'ok'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              תקין ({stats.ok})
            </button>
          </div>
        </div>

        {/* Product Stock Cards List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl border border-slate-800">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-500" />
              <p className="font-bold text-sm">לא נמצאו פריטים</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
              const routineTh = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : 10;
              const safeTh = isEmergencyMode ? routineTh * 3 : routineTh;
              const currentUnit = item.unit || "יח'";
              const isLow = safeQty < safeTh;
              const isOut = safeQty === 0;

              return (
                <div
                  key={item.id || idx}
                  className={`p-4 rounded-2xl border transition-all shadow-md ${
                    isOut
                      ? 'bg-slate-800/60 border-slate-700'
                      : isLow
                      ? isEmergencyMode
                        ? 'bg-red-950/30 border-red-500 ring-1 ring-red-500/50'
                        : 'bg-red-950/20 border-red-500/40'
                      : 'bg-slate-800/80 border-slate-700/80'
                  }`}
                >
                  {/* Title & Status Row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-slate-400">#{item.colIndex || idx + 1}</span>
                        <h4 className="font-bold text-sm text-white leading-snug">{item.name}</h4>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                        isOut
                          ? 'bg-slate-800 text-slate-400 border-slate-600'
                          : isLow
                          ? isEmergencyMode
                            ? 'bg-red-600 text-white border-red-500 animate-pulse font-black'
                            : 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {isOut ? 'אזל' : isLow ? `${isEmergencyMode ? '🚨 חוסר חירום' : 'חוסר'} (${safeQty} < ${safeTh})` : 'תקין'}
                    </span>
                  </div>

                  {/* Main Adjuster Controls (Large Touch Buttons) */}
                  <div className="bg-slate-950/80 p-2 rounded-2xl border border-slate-800 flex items-center justify-between gap-1.5 mb-3">
                    {/* -10 */}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStockItem(item.name, Math.max(0, safeQty - 10), routineTh, currentUnit)
                      }
                      className="w-12 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                    >
                      -10
                    </button>

                    {/* -1 */}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStockItem(item.name, Math.max(0, safeQty - 1), routineTh, currentUnit)
                      }
                      className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    {/* Number Display / Direct Input */}
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={0}
                      value={safeQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        onUpdateStockItem(item.name, isNaN(val) ? 0 : Math.max(0, val), routineTh, currentUnit);
                      }}
                      className="w-20 h-11 text-center font-mono font-black text-lg bg-white text-slate-950 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner"
                    />

                    {/* +1 */}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStockItem(item.name, safeQty + 1, routineTh, currentUnit)
                      }
                      className="w-11 h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* +10 */}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStockItem(item.name, safeQty + 10, routineTh, currentUnit)
                      }
                      className="w-12 h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                    >
                      +10
                    </button>
                  </div>

                  {/* Unit & Threshold Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-bold">
                        {isEmergencyMode ? 'סף חירום (X3):' : 'סף מינימום:'}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        value={routineTh}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) {
                            onUpdateStockItem(item.name, safeQty, val, currentUnit);
                          }
                        }}
                        className="w-12 text-center font-bold bg-slate-900 text-white border border-slate-700 rounded-lg py-0.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      {isEmergencyMode && (
                        <span className="text-[10px] font-black text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-600">
                          {safeTh} {currentUnit}
                        </span>
                      )}
                    </div>

                    {/* Packaging Unit Selector */}
                    <select
                      value={currentUnit}
                      onChange={(e) => onUpdateStockItem(item.name, safeQty, routineTh, e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 font-bold py-1 px-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer text-[11px]"
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
            })
          )}
        </div>
      </main>
    </div>
  );
}
