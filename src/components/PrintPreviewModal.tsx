import React from 'react';
import {
  X,
  Printer,
  FileText,
  Sliders,
  Sparkles,
  Building2,
  Clock,
} from 'lucide-react';
import { Order, PrintSettings, PaperSize, PrintOrientation } from '../types';
import { printOrdersHtml } from '../utils/pdfGenerator';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  settings: PrintSettings;
  onUpdateSettings: (newSettings: PrintSettings) => void;
  onOpenConfirmPrint?: (orders: Order[]) => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  orders,
  settings,
  onUpdateSettings,
  onOpenConfirmPrint,
}) => {
  if (!isOpen || orders.length === 0) return null;

  const previewOrder = orders[0];

  const handlePrint = () => {
    if (onOpenConfirmPrint) {
      onClose();
      onOpenConfirmPrint(orders);
    } else {
      printOrdersHtml(orders, settings);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-sky-500/20 text-sky-400 rounded-2xl border border-sky-500/30 shrink-0">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                תצוגה מקדימה להדפסה ({orders.length} {orders.length === 1 ? 'הזמנה' : 'הזמנות'})
              </h2>
              <p className="text-sm text-slate-300 font-medium mt-0.5">
                כותרת עם שם המחלקה, תאריך ושעה + טבלה מסודרת של הפריטים שהוזמנו
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
          
          {/* Settings Panel */}
          <div className="lg:col-span-4 p-6 bg-white border-l border-slate-200 space-y-5 overflow-y-auto text-sm text-slate-800">
            <div className="font-black text-slate-900 text-base flex items-center gap-2 border-b border-slate-200 pb-3">
              <Sliders className="w-5 h-5 text-sky-600" />
              <span>הגדרות הדפסה ומדפסת</span>
            </div>

            {/* Paper Size */}
            <div className="space-y-2">
              <label className="font-black text-slate-800 block text-sm">גודל דף / פורמט נייר:</label>
              <select
                value={settings.paperSize}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, paperSize: e.target.value as PaperSize })
                }
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="A4">A4 (דף משרדי סטנדרטי 210×297 מ"מ)</option>
                <option value="A5">A5 (חצי דף 148×210 מ"מ)</option>
                <option value="LABEL_100x150">מדבקה / מדפסת טרמית (100×150 מ"מ)</option>
                <option value="ROLL_80MM">גליל קופה (80 מ"מ)</option>
              </select>
            </div>

            {/* Orientation */}
            <div className="space-y-2">
              <label className="font-black text-slate-800 block text-sm">כיוון דף:</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'portrait' })}
                  className={`py-3 px-3 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                    settings.orientation === 'portrait'
                      ? 'bg-sky-50 border-sky-600 text-sky-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  לאורך (Portrait)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'landscape' })}
                  className={`py-3 px-3 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                    settings.orientation === 'landscape'
                      ? 'bg-sky-50 border-sky-600 text-sky-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  לרוחב (Landscape)
                </button>
              </div>
            </div>

            {/* Checkbox column toggle */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showCheckbox}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, showCheckbox: e.target.checked })
                  }
                  className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500 w-5 h-5 cursor-pointer shrink-0"
                />
                <span className="font-bold text-slate-800 text-sm">עמודת תיבת סימון לבדיקה וליקוט (✓)</span>
              </label>
            </div>

            {/* Print Action in sidebar */}
            <div className="pt-4">
              <button
                onClick={handlePrint}
                className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black py-3.5 px-5 rounded-2xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 text-base cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>הדפסה עכשיו / שמירה כ-PDF</span>
              </button>
            </div>
          </div>

          {/* Document Preview */}
          <div className="lg:col-span-8 p-4 sm:p-8 overflow-y-auto flex items-start justify-center">
            <div
              className="bg-white shadow-xl rounded-2xl p-6 sm:p-9 w-full max-w-2xl border-2 border-slate-300 transition-all text-slate-900"
              style={{ minHeight: '500px' }}
            >
              {/* Header Box */}
              <div className="border-b-4 border-sky-700 pb-4 mb-5 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-sky-800 tracking-tight m-0">
                    מחלקה: {previewOrder.department}
                  </h1>
                  <div className="flex flex-wrap gap-2 text-xs sm:text-sm font-bold text-slate-700 mt-3">
                    <span className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      תאריך ושעה: <strong>{previewOrder.timestamp}</strong>
                    </span>
                    <span className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      מספר הזמנה: <strong>{previewOrder.id}</strong>
                    </span>
                    {previewOrder.patientsCount && (
                      <span className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        מטופלים: <strong>{previewOrder.patientsCount}</strong>
                      </span>
                    )}
                    <span className="bg-sky-100 text-sky-800 px-3 py-1.5 rounded-lg border border-sky-200 font-black">
                      סה"כ פריטים: {previewOrder.items.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse text-sm my-4 text-right">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b-2 border-slate-400 font-black">
                    <th className="p-2.5 border border-slate-300 w-12 text-center">מס'</th>
                    {settings.showCheckbox && (
                      <th className="p-2.5 border border-slate-300 w-14 text-center">בדיקה</th>
                    )}
                    <th className="p-2.5 border border-slate-300 text-right">שם המוצר / פריט</th>
                    <th className="p-2.5 border border-slate-300 w-28 text-center">כמות</th>
                  </tr>
                </thead>
                <tbody>
                  {previewOrder.items.length > 0 ? (
                    previewOrder.items.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="p-2.5 border border-slate-300 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        {settings.showCheckbox && (
                          <td className="p-2.5 border border-slate-300 text-center">
                            <span className="inline-block w-4 h-4 border-2 border-sky-600 rounded-xs" />
                          </td>
                        )}
                        <td className="p-2.5 border border-slate-300 font-black text-slate-900 text-right text-sm">
                          {item.name}
                        </td>
                        <td className="p-2.5 border border-slate-300 text-center font-black text-base text-sky-700 bg-sky-50/70">
                          {item.qty}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                        אין פריטים להצגה בהזמנה זו
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t-2 border-dashed border-slate-300 flex justify-between text-sm text-slate-700 font-bold">
                <div>סה"כ שורות להספקה: <strong>{previewOrder.items.length} פריטים</strong></div>
                <div>חתימת מקבל: ____________________</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-5 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition-colors cursor-pointer"
          >
            סגור
          </button>
          <button
            onClick={handlePrint}
            className="px-8 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl text-base shadow-lg shadow-sky-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            <span>הדפס</span>
          </button>
        </div>

      </div>
    </div>
  );
};
