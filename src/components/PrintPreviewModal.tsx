import React from 'react';
import {
  X,
  Printer,
  Download,
  Settings,
  CheckSquare,
  QrCode,
  FileText,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Order, PrintSettings, PaperSize, PrintOrientation } from '../types';
import { formatRuDate } from '../utils/dateUtils';
import { printOrdersHtml, generateOrdersPdfDownload } from '../utils/pdfGenerator';

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

  const previewOrder = orders[0]; // Primary preview

  const handlePrint = () => {
    printOrdersHtml(orders, settings);
  };

  const handleDownloadPdf = () => {
    generateOrdersPdfDownload(orders, settings);
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
                Предварительный просмотр перед печатью ({orders.length} {orders.length === 1 ? 'заказ' : 'заказов'})
              </h2>
              <p className="text-xs text-slate-400">
                Шаблон для маркировки и сборки заказа с отметками о вложении
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
          
          {/* Controls Panel (Left on Desktop) */}
          <div className="lg:col-span-4 p-4 bg-white border-r border-slate-200 space-y-4 overflow-y-auto text-xs">
            
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>Параметры и Выбор Принтера</span>
            </div>

            {/* Paper / Printer Presets */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Тип носителя / Формат бумаги:</label>
              <select
                value={settings.paperSize}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, paperSize: e.target.value as PaperSize })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="A4">Стандартный офисный лист A4 (210×297 мм)</option>
                <option value="A5">Компактный лист A5 (148×210 мм)</option>
                <option value="LABEL_100x150">Этикетка / Термоналейка (100×150 мм)</option>
                <option value="ROLL_80MM">Чековый / Рулонный принтер (80 мм)</option>
              </select>
            </div>

            {/* Orientation */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Ориентация страницы:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'portrait' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    settings.orientation === 'portrait'
                      ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📄 Книжная
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, orientation: 'landscape' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    settings.orientation === 'landscape'
                      ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  🖼 Альбомная
                </button>
              </div>
            </div>

            {/* Template Switches */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="font-bold text-slate-800 mb-1">Элементы бланка:</div>

              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100">
                <span className="font-semibold text-slate-700">Чекбоксы сборки [ ☐ ]</span>
                <input
                  type="checkbox"
                  checked={settings.showCheckbox}
                  onChange={(e) => onUpdateSettings({ ...settings, showCheckbox: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100">
                <span className="font-semibold text-slate-700">Штрихкод / QR заказа</span>
                <input
                  type="checkbox"
                  checked={settings.showBarcode}
                  onChange={(e) => onUpdateSettings({ ...settings, showBarcode: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100">
                <span className="font-semibold text-slate-700">Данные получателя & адрес</span>
                <input
                  type="checkbox"
                  checked={settings.showClientDetails}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, showClientDetails: e.target.checked })
                  }
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100">
                <span className="font-semibold text-slate-700">Блок примечаний</span>
                <input
                  type="checkbox"
                  checked={settings.showNotes}
                  onChange={(e) => onUpdateSettings({ ...settings, showNotes: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
              </label>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-800 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Быстрый запуск печати:</span>
              </div>
              <p>
                При клике на "Печать" откроется системный диалог выбора любого локального или сетевого принтера (HP, Canon, Zebra, Xprinter и др.).
              </p>
            </div>
          </div>

          {/* Document Preview Canvas (Right on Desktop) */}
          <div className="lg:col-span-8 p-6 flex flex-col items-center justify-start overflow-y-auto max-h-[65vh] lg:max-h-full bg-slate-200/80">
            <div className="text-xs font-semibold text-slate-500 mb-2">
              Пример бланка для: <strong className="text-slate-800">{previewOrder.id}</strong>
            </div>

            {/* Paper Sheet Representation */}
            <div
              className={`bg-white shadow-2xl border border-slate-300 p-6 text-slate-900 transition-all rounded-sm ${
                settings.paperSize === 'LABEL_100x150'
                  ? 'w-[320px] min-h-[460px] text-[11px]'
                  : settings.paperSize === 'ROLL_80MM'
                  ? 'w-[280px] min-h-[380px] text-[10px]'
                  : settings.paperSize === 'A5'
                  ? 'w-[420px] min-h-[580px] text-[12px]'
                  : 'w-[520px] min-h-[700px] text-[13px]'
              }`}
            >
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h3 className="font-black text-lg text-sky-700 tracking-tight">
                    СБОРОЧНЫЙ ЛИСТ {previewOrder.id}
                  </h3>
                  <div className="text-xs text-slate-600 font-medium mt-0.5">
                    Дата: {formatRuDate(previewOrder.parsedDate) || previewOrder.rawDate}
                  </div>
                </div>

                {settings.showBarcode && (
                  <div className="text-right border border-dashed border-slate-400 p-1.5 rounded font-mono text-[10px] bg-slate-50">
                    <div className="tracking-widest font-bold">|||||| |||| |||||</div>
                    <div>{previewOrder.id}</div>
                  </div>
                )}
              </div>

              {/* Client Info */}
              {settings.showClientDetails && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-4 text-xs space-y-1">
                  <div>
                    <span className="font-bold text-slate-500">Получатель: </span>
                    <span className="font-bold text-slate-900">{previewOrder.clientName}</span>
                  </div>
                  {previewOrder.phone && (
                    <div>
                      <span className="font-bold text-slate-500">Телефон: </span>
                      <span className="font-semibold text-slate-800">{previewOrder.phone}</span>
                    </div>
                  )}
                  {previewOrder.address && (
                    <div>
                      <span className="font-bold text-slate-500">Адрес: </span>
                      <span className="font-medium text-slate-800">{previewOrder.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Assembly Checklist Table */}
              <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
                <thead>
                  <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                    {settings.showCheckbox && (
                      <th className="p-1.5 text-center w-10 border-r border-slate-300">Сборка</th>
                    )}
                    <th className="p-1.5 text-center w-8 border-r border-slate-300">№</th>
                    <th className="p-1.5 text-left border-r border-slate-300">Наименование товара</th>
                    <th className="p-1.5 text-center w-16">Кол-во</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewOrder.parsedItems.map((item, idx) => (
                    <tr key={item.id}>
                      {settings.showCheckbox && (
                        <td className="p-1.5 text-center border-r border-slate-300">
                          <span className="inline-block w-4 h-4 border-2 border-sky-600 rounded-2xs"></span>
                        </td>
                      )}
                      <td className="p-1.5 text-center font-mono border-r border-slate-300">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 font-semibold text-slate-800 border-r border-slate-300">
                        {item.name}
                      </td>
                      <td className="p-1.5 text-center font-bold text-slate-900">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Notes */}
              {settings.showNotes && previewOrder.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs mb-4 text-amber-900">
                  <strong>Примечание:</strong> {previewOrder.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center mt-auto">
                <div>Сборщик: _________</div>
                <div>Отметка/Штамп: _________</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Подготовлено к печати заказов: <strong className="text-slate-800">{orders.length} шт.</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Сохранить PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Печатать в 1 клик</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
