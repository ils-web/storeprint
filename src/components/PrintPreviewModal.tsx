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
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                Предварительный просмотр печати ({orders.length} {orders.length === 1 ? 'заказ' : 'заказов'})
              </h2>
              <p className="text-xs text-slate-400">
                Заголовок с отделением, датой и временем + таблица позиций с ненулевым количеством
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
          <div className="lg:col-span-4 p-4 bg-white border-r border-slate-200 space-y-4 overflow-y-auto text-xs">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>Параметры печати</span>
            </div>

            {/* Paper Size */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Формат бумаги:</label>
              <select
                value={settings.paperSize}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, paperSize: e.target.value as PaperSize })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="A4">A4 (Стандартный лист 210×297 мм)</option>
                <option value="A5">A5 (148×210 мм)</option>
                <option value="LABEL_100x150">Наклейка / Термопринтер (100×150 мм)</option>
                <option value="ROLL_80MM">Чековая лента (80 мм)</option>
              </select>
            </div>

            {/* Orientation */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Ориентация:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'portrait' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    settings.orientation === 'portrait'
                      ? 'bg-sky-50 border-sky-600 text-sky-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Портретная (Книжная)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'landscape' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    settings.orientation === 'landscape'
                      ? 'bg-sky-50 border-sky-600 text-sky-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Альбомная
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
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-700">Колонка отметки сборки (чекбокс)</span>
              </label>
            </div>

            {/* Print Action in sidebar */}
            <div className="pt-4">
              <button
                onClick={handlePrint}
                className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-98 text-sm"
              >
                <Printer className="w-5 h-5" />
                <span>Распечатать / Сохранить в PDF</span>
              </button>
            </div>
          </div>

          {/* Document Preview (Right on Desktop) */}
          <div className="lg:col-span-8 p-4 sm:p-6 overflow-y-auto flex items-start justify-center">
            <div
              className="bg-white shadow-xl rounded-lg p-6 sm:p-8 w-full max-w-2xl border border-slate-300 transition-all text-slate-900"
              style={{ direction: 'rtl', minHeight: '500px' }}
            >
              {/* Header Box */}
              <div className="border-b-2 border-sky-700 pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black text-sky-800 tracking-tight m-0">
                    מחלקה: {previewOrder.department}
                  </h1>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600 mt-2">
                    <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                      תאריך ושעה: <strong>{previewOrder.timestamp}</strong>
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                      מספר הזמנה: <strong>{previewOrder.id}</strong>
                    </span>
                    {previewOrder.patientsCount && (
                      <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        מטופלים: <strong>{previewOrder.patientsCount}</strong>
                      </span>
                    )}
                    <span className="bg-sky-100 text-sky-800 px-2.5 py-1 rounded border border-sky-200 font-bold">
                      סה"כ פריטים: {previewOrder.items.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse text-xs my-3">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-400">
                    <th className="p-2 border border-slate-300 w-10 text-center">№</th>
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
                        <td className="p-2 border border-slate-300 text-center font-extrabold text-sm text-sky-700 bg-sky-50/50">
                          {item.qty}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                        אין פריטים להצגה
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Footer */}
              <div className="mt-6 pt-3 border-t border-dashed border-slate-300 flex justify-between text-xs text-slate-500">
                <div>סה"כ שורות להספקה: <strong>{previewOrder.items.length} פריטים</strong></div>
                <div>חתימת מקבל: ____________________</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Печать</span>
          </button>
        </div>

      </div>
    </div>
  );
};
