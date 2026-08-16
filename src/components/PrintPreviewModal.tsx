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
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  orders,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen || orders.length === 0) return null;

  const previewOrder = orders[0];

  const handlePrint = () => {
    printOrdersHtml(orders, settings);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-reverse space-x-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                תצוגה מקדימה להדפסה ({orders.length} {orders.length === 1 ? 'הזמנה' : 'הזמנות'})
              </h2>
              <p className="text-xs text-slate-400">
                כותרת עם שם המחלקה, תאריך ושעה + טבלה מסודרת של הפריטים שהוזמנו בלבד
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
          
          {/* Settings Panel */}
          <div className="lg:col-span-4 p-5 bg-white border-l border-slate-200 space-y-4 overflow-y-auto text-xs">
            <div className="font-black text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>הגדרות הדפסה ומדפסת</span>
            </div>

            {/* Paper Size */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">גודל דף / פורמט נייר:</label>
              <select
                value={settings.paperSize}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, paperSize: e.target.value as PaperSize })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="A4">A4 (דף משרדי סטנדרטי 210×297 מ"מ)</option>
                <option value="A5">A5 (חצי דף 148×210 מ"מ)</option>
                <option value="LABEL_100x150">מדבקה / מדפסת טרמית (100×150 מ"מ)</option>
                <option value="ROLL_80MM">גליל קופה (80 מ"מ)</option>
              </select>
            </div>

            {/* Orientation */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">כיוון דף:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'portrait' })}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    settings.orientation === 'portrait'
                      ? 'bg-sky-50 border-sky-600 text-sky-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  לאורך (Portrait)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'landscape' })}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    settings.orientation === 'landscape'
                      ? 'bg-sky-50 border-sky-600 text-sky-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  לרוחב (Landscape)
                </button>
              </div>
            </div>

            {/* Checkbox column toggle */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showCheckbox}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, showCheckbox: e.target.checked })
                  }
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-slate-700">עמודת תיבת סימון לבדיקה וליקוט (✓)</span>
              </label>
            </div>

            {/* Print Action in sidebar */}
            <div className="pt-4">
              <button
                onClick={handlePrint}
                className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black py-3 px-4 rounded-2xl shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-98 text-sm cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>הדפסה עכשיו / שמירה כ-PDF</span>
              </button>
            </div>
          </div>

          {/* Document Preview */}
          <div className="lg:col-span-8 p-4 sm:p-6 overflow-y-auto flex items-start justify-center">
            <div
              className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 w-full max-w-2xl border border-slate-300 transition-all text-slate-900"
              style={{ minHeight: '500px' }}
            >
              {/* Header Box */}
              <div className="border-b-3 border-sky-700 pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black text-sky-800 tracking-tight m-0">
                    מחלקה: {previewOrder.department}
                  </h1>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600 mt-2.5">
                    <span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      תאריך ושעה: <strong>{previewOrder.timestamp}</strong>
                    </span>
                    <span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      מספר הזמנה: <strong>{previewOrder.id}</strong>
                    </span>
                    {previewOrder.patientsCount && (
                      <span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                        מטופלים: <strong>{previewOrder.patientsCount}</strong>
                      </span>
                    )}
                    <span className="bg-sky-100 text-sky-800 px-3 py-1 rounded-lg border border-sky-200 font-black">
                      סה"כ פריטים: {previewOrder.items.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse text-xs my-3 text-right">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-400 font-bold">
                    <th className="p-2 border border-slate-300 w-10 text-center">מס'</th>
                    {settings.showCheckbox && (
                      <th className="p-2 border border-slate-300 w-12 text-center">בדיקה</th>
                    )}
                    <th className="p-2 border border-slate-300 text-right">שם המוצר / פריט</th>
                    <th className="p-2 border border-slate-300 w-24 text-center">כמות</th>
                  </tr>
                </thead>
                <tbody>
                  {previewOrder.items.length > 0 ? (
                    previewOrder.items.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="p-2 border border-slate-300 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        {settings.showCheckbox && (
                          <td className="p-2 border border-slate-300 text-center">
                            <span className="inline-block w-4 h-4 border border-sky-600 rounded-xs" />
                          </td>
                        )}
                        <td className="p-2 border border-slate-300 font-bold text-slate-900 text-right">
                          {item.name}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-black text-sm text-sky-700 bg-sky-50/50">
                          {item.qty}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                        אין פריטים להצגה בהזמנה זו
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Footer */}
              <div className="mt-6 pt-3 border-t border-dashed border-slate-300 flex justify-between text-xs text-slate-600 font-medium">
                <div>סה"כ שורות להספקה: <strong>{previewOrder.items.length} פריטים</strong></div>
                <div>חתימת מקבל: ____________________</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
          >
            סגור
          </button>
          <button
            onClick={handlePrint}
            className="px-7 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl text-xs shadow-md shadow-sky-600/20 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>הדפס</span>
          </button>
        </div>

      </div>
    </div>
  );
};
