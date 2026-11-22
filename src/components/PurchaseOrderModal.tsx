import React, { useMemo, useState } from 'react';
import { StockItem } from '../types';
import {
  FileSpreadsheet,
  X,
  Plus,
  Minus,
  Trash2,
  Search,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { categorizeItem } from '../utils/stockGrouper';
import { detectPackageSize, normalizeProductName } from '../utils/stockManager';
import {
  PurchaseOrderExportLine,
  PurchaseOrderExportMetadata,
  downloadPurchaseOrderExcel,
} from '../utils/excelExport';

export interface PurchaseOrderDraftEntry {
  qty: number;
  unit: string;
  note?: string;
}

export interface PurchaseOrderUnitOption {
  value: string;
  label: string;
}

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockList: StockItem[];
  displayNumberByNormName: Map<string, number>;
  draft: Record<string, PurchaseOrderDraftEntry>;
  onUpdateDraftEntry: (itemName: string, entry: PurchaseOrderDraftEntry) => void;
  onRemoveDraftEntry: (itemName: string) => void;
  onAutoFillLowStock: () => void;
  onClearDraft: () => void;
  lowStockActiveCount: number;
  getEffectiveThreshold: (item: StockItem) => number;
  packagingUnits: PurchaseOrderUnitOption[];
  branchName?: string;
  isEmergencyMode?: boolean;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  stockList,
  displayNumberByNormName,
  draft,
  onUpdateDraftEntry,
  onRemoveDraftEntry,
  onAutoFillLowStock,
  onClearDraft,
  lowStockActiveCount,
  getEffectiveThreshold,
  packagingUnits,
  branchName,
  isEmergencyMode = false,
}) => {
  const [supplierName, setSupplierName] = useState('');
  const [orderedBy, setOrderedBy] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [sortMode, setSortMode] = useState<'warehouse' | 'category'>('warehouse');
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [exportedFilename, setExportedFilename] = useState<string | null>(null);

  const selectedLines = useMemo(() => {
    const list: (PurchaseOrderExportLine & { normKey: string; isInactive: boolean; catGroup: number })[] = [];

    stockList.forEach((item, idx) => {
      const norm = normalizeProductName(item.name) || item.name.trim().toLowerCase();
      const draftEntry = draft[norm];
      if (!draftEntry) return;

      const displayNumber = displayNumberByNormName.get(norm) ?? idx + 1;
      const th = getEffectiveThreshold(item);
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      const cat = categorizeItem(item.name);

      list.push({
        normKey: norm,
        displayNumber,
        name: item.name,
        categoryName: cat.groupName,
        catGroup: cat.group,
        currentStock: safeQty,
        minThreshold: th,
        orderQty: Math.max(1, draftEntry.qty || 1),
        orderUnit: draftEntry.unit || (item.unit && item.unit !== 'מטר' ? item.unit : "יח'"),
        packageSize: item.packageSize || detectPackageSize(item.name),
        note: draftEntry.note || '',
        isInactive: item.isActive === false,
      });
    });

    if (sortMode === 'category') {
      list.sort((a, b) => {
        if (a.catGroup !== b.catGroup) return a.catGroup - b.catGroup;
        return a.displayNumber - b.displayNumber;
      });
    } else {
      list.sort((a, b) => a.displayNumber - b.displayNumber);
    }

    return list;
  }, [stockList, draft, displayNumberByNormName, getEffectiveThreshold, sortMode]);

  const quickAddMatches = useMemo(() => {
    const q = quickAddSearch.trim().toLowerCase();
    if (!q) return [];
    const numQ = q.replace(/^#/, '');

    return stockList
      .filter((item) => {
        const norm = normalizeProductName(item.name) || item.name.trim().toLowerCase();
        if (draft[norm]) return false;
        const displayNum = displayNumberByNormName.get(norm) ?? 0;
        return (
          item.name.toLowerCase().includes(q) ||
          (numQ !== '' && displayNum > 0 && String(displayNum).includes(numQ))
        );
      })
      .slice(0, 6);
  }, [quickAddSearch, stockList, draft, displayNumberByNormName]);

  const totalOrderUnits = useMemo(
    () => selectedLines.reduce((sum, l) => sum + l.orderQty, 0),
    [selectedLines]
  );

  if (!isOpen) return null;

  const handleExportExcel = () => {
    if (selectedLines.length === 0) return;

    const meta: PurchaseOrderExportMetadata = {
      branchName,
      supplierName,
      orderedBy,
      referenceNumber,
      notes: orderNotes,
      createdAt: new Date(),
      isEmergencyMode,
    };

    const filename = downloadPurchaseOrderExcel(selectedLines, meta);
    setExportedFilename(filename);
    setTimeout(() => setExportedFilename(null), 4500);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black truncate">
                טופס הזמנת רכש מהמחסן (ייצוא ל-Excel)
              </h2>
              <p className="text-xs text-teal-100 truncate">
                סניף: {branchName || 'מחסן ראשי'} • {selectedLines.length} פריטים נבחרו להזמנה
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
            title="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {exportedFilename && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                קובץ האקסל <strong>{exportedFilename}</strong> הופק וירד למחשב בהצלחה! 📊
              </div>
            </div>
          )}

          {/* Top Toolbar & Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAutoFillLowStock}
                disabled={lowStockActiveCount === 0}
                className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition-colors"
                title="הוסף אוטומטית את כל הפריטים שמתחת לסף המינימום עם כמות השלמה מומלצת"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>סמן את כל החוסרים ({lowStockActiveCount})</span>
              </button>

              {selectedLines.length > 0 && (
                <button
                  type="button"
                  onClick={onClearDraft}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>נקה טופס</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-600 font-bold">מיון באקסל:</span>
              <button
                type="button"
                onClick={() => setSortMode('warehouse')}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border transition-colors ${
                  sortMode === 'warehouse'
                    ? 'bg-teal-600 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                סדר מחסן (#)
              </button>
              <button
                type="button"
                onClick={() => setSortMode('category')}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border transition-colors ${
                  sortMode === 'category'
                    ? 'bg-teal-600 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                לפי קטגוריות
              </button>
            </div>
          </div>

          {/* Order Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl p-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                שם ספק / יעד (אופציונלי)
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="לדוגמה: שראל / ספק מרכזי"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                מבצע ההזמנה (אופציונלי)
              </label>
              <input
                type="text"
                value={orderedBy}
                onChange={(e) => setOrderedBy(e.target.value)}
                placeholder="שם אחראי/ת מחסן"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                מספר טופס / אסמכתא (אופציונלי)
              </label>
              <input
                type="text"
                dir="ltr"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="אוטומטי (PO-...)"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                הערות להזמנה (אופציונלי)
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="דחוף / אספקה לבוקר..."
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Quick Add Item Search inside Modal */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickAddSearch}
                onChange={(e) => setQuickAddSearch(e.target.value)}
                placeholder="+ הוסף פריט נוסף לטופס (חפש לפי שם או #מספר במחסן)..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {quickAddMatches.length > 0 && (
              <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {quickAddMatches.map((item) => {
                  const norm = normalizeProductName(item.name) || item.name.trim().toLowerCase();
                  const num = displayNumberByNormName.get(norm) ?? 0;
                  const th = getEffectiveThreshold(item);
                  const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
                  const suggested = safeQty < th ? Math.max(1, th - safeQty) : 1;
                  const pkgSz = item.packageSize || detectPackageSize(item.name);
                  const cleanUnit =
                    item.unit && item.unit !== 'מטר'
                      ? item.unit
                      : pkgSz && pkgSz > 1
                      ? 'מארז'
                      : "יח'";

                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        onUpdateDraftEntry(item.name, { qty: suggested, unit: cleanUnit });
                        setQuickAddSearch('');
                      }}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-white hover:bg-teal-50 border border-teal-200 rounded-xl text-right cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          <span className="font-mono text-slate-400 ml-1">#{num}</span>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          מלאי: {safeQty} {cleanUnit} • מומלץ להזמנה: {suggested}
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-1 bg-teal-600 text-white rounded-lg text-[11px] font-black flex items-center gap-0.5">
                        <Plus className="w-3 h-3" />
                        הוסף
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Lines List / Table */}
          {selectedLines.length === 0 ? (
            <div className="py-12 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <div className="text-sm font-black text-slate-800">עדיין לא נבחרו פריטים לטופס ההזמנה</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  סמנו את תיבות הסימון ליד הפריטים בטבלת המחסן, או לחצו כאן על
                  {' '}<strong className="text-amber-700">"סמן את כל החוסרים"</strong>{' '}
                  או חפשו פריט בשורה למעלה.
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black">
                      <th className="py-2.5 px-2.5 w-14 text-center">#</th>
                      <th className="py-2.5 px-3">שם הפריט ומצב מלאי</th>
                      <th className="py-2.5 px-2.5 w-36 text-center">כמות להזמנה</th>
                      <th className="py-2.5 px-2.5 w-36 text-center">יחידה</th>
                      <th className="py-2.5 px-2.5 w-44">הערה לפריט</th>
                      <th className="py-2.5 px-2 w-10 text-center">הסר</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedLines.map((line) => (
                      <tr key={line.normKey} className="hover:bg-teal-50/30">
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-500">
                          #{line.displayNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{line.name}</span>
                            {line.isInactive && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                מושהה
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-slate-500">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                              {line.categoryName}
                            </span>
                            <span
                              className={
                                line.currentStock < line.minThreshold
                                  ? 'text-red-600 font-bold flex items-center gap-0.5'
                                  : 'text-emerald-700 font-medium'
                              }
                            >
                              {line.currentStock < line.minThreshold && (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              יתרה במחסן: {line.currentStock} / סף: {line.minThreshold}
                            </span>
                            {line.packageSize && line.packageSize > 1 && (
                              <span className="text-indigo-700 font-bold">
                                📦 {line.packageSize} יח' במארז
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateDraftEntry(line.name, {
                                  qty: Math.max(1, line.orderQty - 1),
                                  unit: line.orderUnit,
                                  note: line.note,
                                })
                              }
                              disabled={line.orderQty <= 1}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-35 text-slate-800 flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={line.orderQty}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                onUpdateDraftEntry(line.name, {
                                  qty: isNaN(parsed) || parsed < 1 ? 1 : parsed,
                                  unit: line.orderUnit,
                                  note: line.note,
                                });
                              }}
                              className="w-16 text-center py-1 rounded-lg border border-teal-400 bg-emerald-50/60 text-slate-900 font-mono font-black text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateDraftEntry(line.name, {
                                  qty: line.orderQty + 1,
                                  unit: line.orderUnit,
                                  note: line.note,
                                })
                              }
                              className="w-7 h-7 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <select
                            value={line.orderUnit}
                            onChange={(e) =>
                              onUpdateDraftEntry(line.name, {
                                qty: line.orderQty,
                                unit: e.target.value,
                                note: line.note,
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            {packagingUnits.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <input
                            type="text"
                            value={line.note || ''}
                            onChange={(e) =>
                              onUpdateDraftEntry(line.name, {
                                qty: line.orderQty,
                                unit: line.orderUnit,
                                note: e.target.value,
                              })
                            }
                            placeholder="הערה..."
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveDraftEntry(line.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="הסר פריט מטופס ההזמנה"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-700">
            <strong>{selectedLines.length}</strong> פריטים בטופס • סה"כ{' '}
            <strong className="text-teal-700 font-mono text-sm">{totalOrderUnits}</strong>{' '}
            יח' / אריזות להזמנה
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer transition-colors"
            >
              המשך בחירה בטבלה
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={selectedLines.length === 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-45 text-white text-xs sm:text-sm font-black shadow-md shadow-teal-600/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>ייצוא לקובץ Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
