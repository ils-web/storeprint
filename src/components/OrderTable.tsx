import React, { useState } from 'react';
import {
  Printer,
  Eye,
  Search,
  CheckSquare,
  Square,
  ListFilter,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  User,
  PackageCheck,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { Order, ColumnMapping } from '../types';
import { formatRuDate } from '../utils/dateUtils';

interface OrderTableProps {
  orders: Order[];
  mapping: ColumnMapping;
  selectedOrderIds: string[];
  onToggleSelectOrder: (id: string) => void;
  onSelectAllOrders: (selected: boolean) => void;
  onSinglePrint: (order: Order) => void;
  onPreviewOrder: (order: Order) => void;
  onMassPrint: () => void;
  onDownloadPdf: (orders: Order[]) => void;
  onTogglePrintedStatus: (orderId: string) => void;
  onToggleItemCheck: (orderId: string, itemId: string) => void;
  onOpenSettings: () => void;
  isSheetLoaded: boolean;
  filteredOutCount: number;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  mapping,
  selectedOrderIds,
  onToggleSelectOrder,
  onSelectAllOrders,
  onSinglePrint,
  onPreviewOrder,
  onMassPrint,
  onDownloadPdf,
  onTogglePrintedStatus,
  onToggleItemCheck,
  onOpenSettings,
  isSheetLoaded,
  filteredOutCount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unprinted' | 'printed'>('all');
  const [visibleCols, setVisibleCols] = useState({
    orderId: true,
    date: true,
    client: true,
    items: true,
    quantity: true,
    address: true,
    status: true,
    actions: true,
  });
  const [showColMenu, setShowColMenu] = useState(false);

  // Filter orders by search & printed status
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchTerm === '' ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.itemsText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone.includes(searchTerm);

    if (!matchesSearch) return false;

    if (statusFilter === 'unprinted') return !order.printed;
    if (statusFilter === 'printed') return order.printed;
    return true;
  });

  const allSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrderIds.includes(o.id));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      
      {/* Search & Actions Control Bar */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search Field */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по № заказа, клиенту, товару, адресу..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills & Column Selector */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Print Status Filter */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex text-xs font-medium text-slate-600">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              Все ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('unprinted')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'unprinted'
                  ? 'bg-white text-sky-600 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              К печати ({orders.filter((o) => !o.printed).length})
            </button>
            <button
              onClick={() => setStatusFilter('printed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'printed'
                  ? 'bg-white text-emerald-600 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              Напечатано ({orders.filter((o) => o.printed).length})
            </button>
          </div>

          {/* Column Toggle Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Столбцы</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showColMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-30 text-xs text-slate-700 space-y-1">
                <div className="font-bold text-slate-900 px-2 py-1 border-b border-slate-100 mb-1">
                  Видимость колонок
                </div>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols.orderId}
                    onChange={(e) => setVisibleCols({ ...visibleCols, orderId: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>№ Заказа</span>
                </label>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols.date}
                    onChange={(e) => setVisibleCols({ ...visibleCols, date: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Дата заказа</span>
                </label>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols.client}
                    onChange={(e) => setVisibleCols({ ...visibleCols, client: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Клиент / Контакт</span>
                </label>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols.items}
                    onChange={(e) => setVisibleCols({ ...visibleCols, items: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Состав заказа</span>
                </label>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols.address}
                    onChange={(e) => setVisibleCols({ ...visibleCols, address: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Адрес / Доставка</span>
                </label>
                <div className="pt-1 border-t border-slate-100 mt-1">
                  <button
                    onClick={onOpenSettings}
                    className="w-full text-left px-2 py-1 text-sky-600 font-medium hover:bg-sky-50 rounded"
                  >
                    ⚙ Сопоставление с Google Sheets
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mass Print Action */}
          {selectedOrderIds.length > 0 && (
            <div className="flex items-center gap-2 animate-fadeIn">
              <button
                onClick={onMassPrint}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Печать выделенных ({selectedOrderIds.length})</span>
              </button>
              <button
                onClick={() => {
                  const selectedOrdersList = orders.filter((o) => selectedOrderIds.includes(o.id));
                  onDownloadPdf(selectedOrdersList);
                }}
                className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3 py-1.5 rounded-xl shadow flex items-center gap-1.5"
                title="Скачать PDF архив"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="overflow-x-auto min-h-[350px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAllOrders(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer w-4 h-4"
                />
              </th>
              {visibleCols.orderId && <th className="p-3 w-28">№ Заказа</th>}
              {visibleCols.date && <th className="p-3 w-28">Дата</th>}
              {visibleCols.client && <th className="p-3 min-w-[180px]">Получатель</th>}
              {visibleCols.items && <th className="p-3 min-w-[260px]">Состав для маркировки & сборки</th>}
              {visibleCols.address && <th className="p-3 min-w-[160px]">Адрес / Примечание</th>}
              {visibleCols.status && <th className="p-3 w-28 text-center">Статус</th>}
              <th className="p-3 w-40 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 text-xs sm:text-sm">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <tr
                    key={order.id}
                    className={`transition-colors hover:bg-sky-50/40 ${
                      isSelected ? 'bg-sky-50/70' : order.printed ? 'bg-slate-50/60 opacity-80' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectOrder(order.id)}
                        className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer w-4 h-4"
                      />
                    </td>

                    {/* Order ID */}
                    {visibleCols.orderId && (
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sky-600 font-mono bg-sky-100/70 px-2 py-0.5 rounded text-xs">
                            {order.id}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Date */}
                    {visibleCols.date && (
                      <td className="p-3 whitespace-nowrap">
                        <div className="text-slate-800 font-semibold text-xs">
                          {formatRuDate(order.parsedDate) || order.rawDate}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                          Текущая неделя
                        </span>
                      </td>
                    )}

                    {/* Client Name & Phone */}
                    {visibleCols.client && (
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{order.clientName}</span>
                        </div>
                        {order.phone && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{order.phone}</span>
                          </div>
                        )}
                      </td>
                    )}

                    {/* Items Checklist Preview */}
                    {visibleCols.items && (
                      <td className="p-3">
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {order.parsedItems.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => onToggleItemCheck(order.id, item.id)}
                              className="flex items-start gap-2 group cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors"
                            >
                              <div className="mt-0.5 text-sky-600 shrink-0">
                                {item.checked ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 group-hover:text-sky-600" />
                                )}
                              </div>
                              <div className="text-xs">
                                <span className={item.checked ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                                  {item.name}
                                </span>
                                <span className="ml-1.5 text-[11px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100">
                                  {item.qty}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    )}

                    {/* Address & Notes */}
                    {visibleCols.address && (
                      <td className="p-3 text-xs text-slate-600">
                        {order.address && (
                          <div className="flex items-start gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{order.address}</span>
                          </div>
                        )}
                        {order.notes && (
                          <div className="mt-1 text-[11px] bg-amber-50 text-amber-800 border border-amber-200 p-1 rounded">
                            📝 {order.notes}
                          </div>
                        )}
                      </td>
                    )}

                    {/* Status Badge */}
                    {visibleCols.status && (
                      <td className="p-3 text-center whitespace-nowrap">
                        {order.printed ? (
                          <button
                            onClick={() => onTogglePrintedStatus(order.id)}
                            className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs hover:bg-emerald-200 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Напечатан</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onTogglePrintedStatus(order.id)}
                            className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 hover:bg-amber-200 transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>К сборке</span>
                          </button>
                        )}
                      </td>
                    )}

                    {/* Actions: Direct 1-Click Print & Preview */}
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Preview */}
                        <button
                          onClick={() => onPreviewOrder(order)}
                          className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Предварительный просмотр"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* 1-Click Print */}
                        <button
                          onClick={() => onSinglePrint(order)}
                          className="bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                          title="Отправить на принтер в один клик"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Печать</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-500">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-700">
                      {searchTerm
                        ? 'Ни один заказ не соответствует параметрам поиска'
                        : 'Заявки на текущую неделю не найдены'}
                    </p>
                    {filteredOutCount > 0 && (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          В Google Таблице найдено {filteredOutCount} за с др. датами. Отображаются только заявки ТЕКУЩЕЙ НЕДЕЛИ!
                        </span>
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap justify-between items-center gap-2">
        <div>
          Отображено заказов: <strong>{filteredOrders.length}</strong> из {orders.length}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          <span>Каждый заказ форматируется по шаблону для наклейки и сборки</span>
        </div>
      </div>
    </div>
  );
};
