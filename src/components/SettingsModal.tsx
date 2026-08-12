import React, { useState } from 'react';
import { X, Sliders, FileSpreadsheet, ShieldAlert, Check, RefreshCw } from 'lucide-react';
import { ColumnMapping, SheetTab } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetUrl: string;
  onUpdateSpreadsheetUrl: (url: string) => void;
  availableTabs: SheetTab[];
  activeSheetTitle: string;
  onSelectTab: (tabTitle: string) => void;
  availableHeaders: string[];
  mapping: ColumnMapping;
  onUpdateMapping: (newMapping: ColumnMapping) => void;
  isLoadingTabs: boolean;
  onFetchTabs: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetUrl,
  onUpdateSpreadsheetUrl,
  availableTabs,
  activeSheetTitle,
  onSelectTab,
  availableHeaders,
  mapping,
  onUpdateMapping,
  isLoadingTabs,
  onFetchTabs,
}) => {
  const [localUrl, setLocalUrl] = useState(spreadsheetUrl);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    onUpdateSpreadsheetUrl(localUrl);
    onFetchTabs();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Настройка Google Sheets & Колонок</h2>
              <p className="text-xs text-slate-400">
                Выбор вкладки и сопоставление столбцов с вашей таблицей
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
        <div className="p-5 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          
          {/* Read-Only Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-emerald-900">
            <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Гарантия сохранности данных (Только чтение):</div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Приложение запрашивает исключительно доступ <code>readonly</code>. Изменения в
                исходную Google Таблицу вносить <strong>строго запрещено</strong> и технически негвозможно.
              </p>
            </div>
          </div>

          {/* Spreadsheet URL Input */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 text-xs block">
              Ссылка на Google Таблицу:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1NJq4sJV0HPvkKUXy6kot3FUA7dnKAHD-iWTVXIY4qms/..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={handleSaveUrl}
                disabled={isLoadingTabs}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTabs ? 'animate-spin' : ''}`} />
                <span>Загрузить</span>
              </button>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 text-xs block">
              Выберите вкладку Google Sheets:
            </label>
            {availableTabs.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableTabs.map((tab) => {
                  const isActive = tab.title === activeSheetTitle;
                  return (
                    <button
                      key={tab.sheetId}
                      type="button"
                      onClick={() => onSelectTab(tab.title)}
                      className={`p-2.5 rounded-xl border text-left font-semibold text-xs flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-sky-50 border-sky-500 text-sky-800 shadow-2xs font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="truncate">{tab.title}</span>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 italic text-xs">
                {isLoadingTabs ? 'Загрузка списка вкладок...' : 'Вкладки будут загружены после входа или ввода таблицы.'}
              </p>
            )}
          </div>

          {/* Column Mapping Selector */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="font-bold text-slate-900 text-sm">
              Сопоставление полей с заголовками столбцов вашей таблицы:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Order ID */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 block">№ Заказа / Заявка:</span>
                <select
                  value={mapping.orderId}
                  onChange={(e) => onUpdateMapping({ ...mapping, orderId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Авто-определение --</option>
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 block">Столбец Даты:</span>
                <select
                  value={mapping.date}
                  onChange={(e) => onUpdateMapping({ ...mapping, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Авто-определение --</option>
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 block">Получатель / Клиент:</span>
                <select
                  value={mapping.client}
                  onChange={(e) => onUpdateMapping({ ...mapping, client: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Авто-определение --</option>
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 block">Состав заказа / Позиции:</span>
                <select
                  value={mapping.items}
                  onChange={(e) => onUpdateMapping({ ...mapping, items: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Авто-определение --</option>
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 block">Количество:</span>
                <select
                  value={mapping.quantity}
                  onChange={(e) => onUpdateMapping({ ...mapping, quantity: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Авто-определение --</option>
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 block">Адрес / Доставка:</span>
                <select
                  value={mapping.address}
                  onChange={(e) => onUpdateMapping({ ...mapping, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Авто-определение --</option>
                  {availableHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm"
          >
            Сохранить и Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
