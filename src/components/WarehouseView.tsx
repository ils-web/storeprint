import React, { useState, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Search,
  Plus,
  Minus,
  Download,
  Upload,
  Layers,
  Sparkles,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { StockItem } from '../types';
import { printReorderListHtml } from '../utils/pdfGenerator';
import { exportStockToJson, importStockFromJson } from '../utils/stockManager';

interface WarehouseViewProps {
  stock: Record<string, StockItem>;
  onUpdateStockItem: (name: string, newQty: number, minThreshold?: number) => void;
  onBatchUpdateStock: (updatedStock: Record<string, StockItem>) => void;
  onSetAllStock: (qty: number) => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  stock,
  onUpdateStockItem,
  onBatchUpdateStock,
  onSetAllStock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchQtyInput, setBatchQtyInput] = useState<string>('50');

  const stockList = useMemo(() => Object.values(stock), [stock]);

  // Statistics
  const stats = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;

    stockList.forEach((item) => {
      const th = item.minThreshold || globalThreshold;
      if (item.currentStock === 0) {
        out++;
        low++;
      } else if (item.currentStock < th) {
        low++;
      } else {
        ok++;
      }
    });

    return { total: stockList.length, ok, low, out };
  }, [stockList, globalThreshold]);

  // Low stock items list for printing
  const lowStockItems = useMemo(() => {
    return stockList.filter((item) => {
      const th = item.minThreshold || globalThreshold;
      return item.currentStock < th;
    }).sort((a, b) => a.currentStock - b.currentStock);
  }, [stockList, globalThreshold]);

  // Filtered display list
  const filteredItems = useMemo(() => {
    return stockList.filter((item) => {
      const th = item.minThreshold || globalThreshold;

      if (filterType === 'low' && item.currentStock >= th) return false;
      if (filterType === 'out' && item.currentStock > 0) return false;
      if (filterType === 'ok' && item.currentStock < th) return false;

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(q) || String(item.colIndex).includes(q);
      }

      return true;
    }).sort((a, b) => {
      // Sort items with lowest stock first if low filter, otherwise by colIndex
      if (filterType === 'low' || filterType === 'out') {
        return a.currentStock - b.currentStock;
      }
      return a.colIndex - b.colIndex;
    });
  }, [stockList, filterType, searchTerm, globalThreshold]);

  const handlePrintReorder = () => {
    printReorderListHtml(lowStockItems, globalThreshold);
  };

  const handleExport = () => {
    const json = exportStockToJson(stock);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storeprint_stock_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = importStockFromJson(content);
      if (parsed) {
        onBatchUpdateStock(parsed);
        alert('Остатки успешно импортированы!');
      } else {
        alert('Ошибка при чтении файла остатков JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Всего товаров (E..FM)</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* In Stock */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">В достатке (≥ {globalThreshold} шт)</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{stats.ok}</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Warning Card */}
        <div className="bg-gradient-to-br from-red-50 to-amber-50 p-4 rounded-2xl border border-red-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-red-600 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Дефицит (&lt; {globalThreshold} шт)</span>
            </div>
            <div className="text-2xl font-black text-red-700 mt-1">{stats.low} поз.</div>
          </div>
          <button
            onClick={handlePrintReorder}
            disabled={lowStockItems.length === 0}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white p-2.5 rounded-xl shadow-md shadow-red-600/20 transition-all transform active:scale-95 cursor-pointer"
            title="Распечатать лист дозаказа"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>

        {/* Zero Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Закончились (0 шт)</div>
            <div className="text-2xl font-black text-slate-700 mt-1">{stats.out}</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-500 rounded-xl">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Main Control Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Actions & Filter Toolbar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск товара по наименованию (на иврите или номеру)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Filter Tabs */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все ({stats.total})
            </button>
            <button
              onClick={() => setFilterType('low')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterType === 'low'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              ⚠️ Мало &lt; {globalThreshold} ({stats.low})
            </button>
            <button
              onClick={() => setFilterType('out')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterType === 'out'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Закончились ({stats.out})
            </button>
            <button
              onClick={() => setFilterType('ok')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterType === 'ok'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              В норме ({stats.ok})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Print Reorder Sheet */}
            <button
              onClick={handlePrintReorder}
              disabled={lowStockItems.length === 0}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-red-600/20 flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Печать листа дозаказа ({lowStockItems.length})</span>
            </button>

            {/* Batch Set Stock */}
            <button
              onClick={() => setBatchModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-600" />
              <span>Задать остатки всем</span>
            </button>

            {/* Export JSON */}
            <button
              onClick={handleExport}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              title="Экспорт остатков в файл (бэкап)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Import JSON */}
            <label
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              title="Импорт остатков из файла"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>

          </div>
        </div>

        {/* Stock Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4 w-14 text-center">Кол.</th>
                <th className="py-3 px-4">Наименование товара / столбца (E..FM)</th>
                <th className="py-3 px-4 w-60 text-center">Остаток на складе</th>
                <th className="py-3 px-4 w-36 text-center">Мин. порог</th>
                <th className="py-3 px-4 w-40 text-center">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <Package className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="font-bold text-slate-700">Товары не найдены</div>
                      <p className="text-xs text-slate-400">
                        Попробуйте изменить поисковый запрос или фильтр.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const th = item.minThreshold || globalThreshold;
                  const isLow = item.currentStock < th;
                  const isOut = item.currentStock === 0;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isOut
                          ? 'bg-slate-50/80'
                          : isLow
                          ? 'bg-red-50/40 hover:bg-red-50/70'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Column / Index */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm" dir="rtl">
                          {item.name}
                        </div>
                      </td>

                      {/* Interactive Stock Adjuster */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl p-1 shadow-2xs">
                          {/* -10 */}
                          <button
                            onClick={() => onUpdateStockItem(item.name, Math.max(0, item.currentStock - 10))}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] transition-colors"
                            title="-10 шт"
                          >
                            -10
                          </button>
                          {/* -1 */}
                          <button
                            onClick={() => onUpdateStockItem(item.name, Math.max(0, item.currentStock - 1))}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                            title="-1 шт"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          {/* Direct Input */}
                          <input
                            type="number"
                            min={0}
                            value={item.currentStock}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              onUpdateStockItem(item.name, isNaN(val) ? 0 : Math.max(0, val));
                            }}
                            className={`w-16 text-center font-black text-sm py-0.5 rounded-lg border focus:outline-none focus:ring-2 ${
                              isLow
                                ? 'border-red-400 text-red-700 bg-red-50 focus:ring-red-500'
                                : 'border-slate-200 text-slate-900 focus:ring-sky-500'
                            }`}
                          />

                          {/* +1 */}
                          <button
                            onClick={() => onUpdateStockItem(item.name, item.currentStock + 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                            title="+1 шт"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          {/* +10 */}
                          <button
                            onClick={() => onUpdateStockItem(item.name, item.currentStock + 10)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] transition-colors"
                            title="+10 шт"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      {/* Threshold Input */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 text-slate-600">
                          <input
                            type="number"
                            min={1}
                            value={item.minThreshold || globalThreshold}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              onUpdateStockItem(
                                item.name,
                                item.currentStock,
                                isNaN(val) ? 10 : Math.max(1, val)
                              );
                            }}
                            className="w-12 text-center text-xs font-semibold py-1 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                          <span className="text-[11px] text-slate-400">шт</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            ⚪ Нет на складе
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-[11px] font-extrabold animate-pulse">
                            ⚠️ Мало ({item.currentStock} &lt; {th})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            🟢 В норме ({item.currentStock})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div>
            Показано товаров: <strong>{filteredItems.length}</strong> из <strong>{stockList.length}</strong>
          </div>
          <div className="text-slate-400">
            * При каждой печати заказа указанные в нем позиции автоматически списываются с остатка склада
          </div>
        </div>

      </div>

      {/* Batch Set Stock Modal */}
      {batchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-sky-600" />
              <span>Массовая установка остатков</span>
            </h3>
            <p className="text-xs text-slate-600">
              Укажите начальное количество, которое будет установлено <strong>для всех товаров</strong> на складе:
            </p>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={batchQtyInput}
                onChange={(e) => setBatchQtyInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-xs font-bold text-slate-500">шт/ед</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBatchQtyInput('50')}
                className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                50 шт
              </button>
              <button
                type="button"
                onClick={() => setBatchQtyInput('100')}
                className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                100 шт
              </button>
              <button
                type="button"
                onClick={() => setBatchQtyInput('0')}
                className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                Сброс в 0
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setBatchModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  const qty = parseInt(batchQtyInput, 10);
                  onSetAllStock(isNaN(qty) ? 0 : Math.max(0, qty));
                  setBatchModalOpen(false);
                }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Применить ко всем
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
