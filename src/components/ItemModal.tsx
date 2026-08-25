import React, { useState, useEffect } from 'react';
import { StockItem } from '../types';
import { PACKAGING_UNITS } from './WarehouseView';
import {
  Package,
  X,
  Plus,
  Edit,
  Save,
  Users,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Sliders,
} from 'lucide-react';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: StockItem | null;
  onSave: (item: StockItem) => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  itemToEdit,
  onSave,
}) => {
  const isEdit = Boolean(itemToEdit && itemToEdit.name);

  const [name, setName] = useState('');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minThreshold, setMinThreshold] = useState<number>(10);
  const [unit, setUnit] = useState<string>("יח'");
  const [limitByPatients, setLimitByPatients] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name || '');
      setCurrentStock(typeof itemToEdit.currentStock === 'number' ? itemToEdit.currentStock : 0);
      setMinThreshold(typeof itemToEdit.minThreshold === 'number' ? itemToEdit.minThreshold : 10);
      setUnit(itemToEdit.unit || "יח'");
      setLimitByPatients(Boolean(itemToEdit.limitByPatients));
      setIsActive(itemToEdit.isActive !== false);
    } else {
      setName('');
      setCurrentStock(0);
      setMinThreshold(10);
      setUnit("יח'");
      setLimitByPatients(false);
      setIsActive(true);
    }
    setError(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('נא להזין שם עבור הפריט');
      return;
    }

    const savedItem: StockItem = {
      id: itemToEdit?.id || `stock-${Date.now()}`,
      name: name.trim(),
      colIndex: itemToEdit?.colIndex || 0,
      currentStock: Math.max(0, currentStock),
      minThreshold: Math.max(1, minThreshold),
      unit: unit || "יח'",
      limitByPatients,
      isActive,
      lastUpdated: new Date().toISOString(),
    };

    onSave(savedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-reverse space-x-3">
            <div className="p-2.5 bg-white/20 text-white rounded-2xl backdrop-blur-xs">
              {isEdit ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {isEdit ? 'עריכת פריט במחסן ✏️' : 'הוספת פריט חדש למלאי 📦'}
              </h2>
              <p className="text-xs text-sky-100">
                {isEdit ? 'עדכון שם, כמויות, ספי מינימום והשהייה' : 'יצירת פריט חדש שיישמר בענן ובטבלה'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              שם הפריט / מוצר <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="לדוגמה: כפפות ניטריל מידה M"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Quantities Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Current Stock */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                יתרת מלאי נוכחית
              </label>
              <input
                type="number"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
              />
            </div>

            {/* Min Threshold */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                סף מינימום לחוסר
              </label>
              <input
                type="number"
                min="1"
                value={minThreshold}
                onChange={(e) => setMinThreshold(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
              />
            </div>
          </div>

          {/* Packaging Unit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              יחידת מידה / אריזה
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {PACKAGING_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {/* Options: Limit by Patients & Active Status */}
          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            
            {/* Limit by Patients Checkbox */}
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={limitByPatients}
                onChange={(e) => setLimitByPatients(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-black text-slate-800 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  הגבל כמות הזמנה לפי מספר מטופלים
                </span>
                <span className="text-[11px] text-slate-500 block">
                  מחלקות לא יוכלו להזמין כמות העולה על מספר המטופלים הרשום
                </span>
              </div>
            </label>

            {/* Active / Frozen Status Toggle */}
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-black text-slate-800 flex items-center gap-1">
                  {isActive ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                      פריט פעיל במלאי ובהזמנות
                    </span>
                  ) : (
                    <span className="text-slate-600 flex items-center gap-1">
                      <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
                      פריט מושהה / מוקפא ❄️ (מוחרג מדוחות רכש)
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {isActive ? 'הפריט מופיע בקטלוג ההזמנות ובדוחות' : 'הפריט מוקפא זמנית ולא יופיע להזמנה'}
                </span>
              </div>
            </label>

          </div>

          {/* Submit Button */}
          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-sky-600/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isEdit ? 'שמור שינויים ✓' : 'הוסף פריט למחסן 📦'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
