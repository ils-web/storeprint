import React, { useState, useMemo } from 'react';
import {
  Printer,
  Eye,
  Search,
  CheckSquare,
  Square,
  CheckCircle,
  Clock,
  Building2,
  Package,
  Layers,
  Sparkles,
  Download,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { Order, StockItem } from '../types';

interface OrderTableProps {
  orders: Order[];
  departments: string[];
  stock: Record<string, StockItem>;
  selectedOrderIds: string[];
  onToggleSelectOrder: (id: string) => void;
  onSelectAllOrders: (selected: boolean) => void;
  onSinglePrint: (order: Order) => void;
  onPreviewOrder: (order: Order) => void;
  onMassPrint: () => void;
  onTogglePrintedStatus: (orderId: string) => void;
  isSheetLoaded: boolean;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  departments,
  stock,
  selectedOrderIds,
  onToggleSelectOrder,
  onSelectAllOrders,
  onSinglePrint,
  onPreviewOrder,
  onMassPrint,
  onTogglePrintedStatus,
  isSheetLoaded,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unprinted' | 'printed'>('all');

  // Filter orders by search, department, and status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Dept filter
      if (selectedDept !== 'ALL' && order.department !== selectedDept) {
        return false;
      }

      // Printed status filter
      if (statusFilter === 'unprinted' && order.printed) return false;
      if (statusFilter === 'printed' && !order.printed) return false;

      // Search term filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesDept = order.department.toLowerCase().includes(query);
        const matchesTime = order.timestamp.toLowerCase().includes(query);
        const matchesItems = order.items.some((it) => it.name.toLowerCase().includes(query));
        if (!matchesId && !matchesDept && !matchesTime && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [orders, selectedDept, statusFilter, searchTerm]);

  const isAllSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrderIds.includes(o.id));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Filters & Actions Bar */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по отделению, дате, предмету или номеру..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Department Filter Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="ALL">Все отделения ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Tabs */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('unprinted')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'unprinted'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              К печати ({orders.filter((o) => !o.printed).length})
            </button>
            <button
              onClick={() => setStatusFilter('printed')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'printed'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Напечатано ({orders.filter((o) => o.printed).length})
            </button>
          </div>

          {/* Mass Print Button */}
          {selectedOrderIds.length > 0 && (
            <button
              onClick={onMassPrint}
              className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-sky-600/20 flex items-center gap-1.5 transition-all transform active:scale-95 animate-pulse cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Печать выбранных ({selectedOrderIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
              <th className="py-3 px-4 w-12 text-center">
                <button
                  onClick={() => onSelectAllOrders(!isAllSelected)}
                  className="text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                  title={isAllSelected ? 'Снять выделение' : 'Выбрать все'}
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-sky-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 w-28">Дата и Время</th>
              <th className="py-3 px-4 w-52">Отделение (מחלקה)</th>
              <th className="py-3 px-4">Заказанные позиции (E..FM с количеством)</th>
              <th className="py-3 px-4 w-32 text-center">Позиций</th>
              <th className="py-3 px-4 w-28 text-center">Статус</th>
              <th className="py-3 px-4 w-36 text-center">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-500">
                  <div className="max-w-md mx-auto space-y-2">
                    <Package className="w-10 h-10 text-slate-300 mx-auto" />
                    <div className="font-bold text-slate-700">Заказы не найдены</div>
                    <p className="text-xs text-slate-400">
                      Попробуйте сбросить фильтры или строку поиска.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <tr
                    key={order.id}
                    className={`transition-colors hover:bg-sky-50/40 ${
                      isSelected ? 'bg-sky-50/70' : order.printed ? 'bg-slate-50/40' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleSelectOrder(order.id)}
                        className="text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{order.timestamp}</span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span
                          className="font-bold text-slate-900 text-sm"
                          dir="rtl"
                        >
                          {order.department}
                        </span>
                      </div>
                    </td>

                    {/* Ordered Items Preview with stock alerts */}
                    <td className="py-3 px-4">
                      {order.items.length === 0 ? (
                        <span className="text-slate-400 italic">Нет выбранных позиций</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5" dir="rtl">
                          {order.items.slice(0, 5).map((item) => {
                            const stockItem = stock[item.name];
                            const isLow = stockItem && stockItem.currentStock < (stockItem.minThreshold || 10);
                            const isOut = stockItem && stockItem.currentStock === 0;

                            return (
                              <span
                                key={item.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border transition-colors font-medium ${
                                  isOut
                                    ? 'bg-slate-100 text-slate-500 border-slate-300 line-through'
                                    : isLow
                                    ? 'bg-red-50 text-red-800 border-red-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                                }`}
                                title={
                                  stockItem
                                    ? `Остаток на складе: ${stockItem.currentStock} шт`
                                    : ''
                                }
                              >
                                {isLow && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-ping" />
                                )}
                                <span>{item.name}</span>
                                <span className="bg-sky-600 text-white px-1.5 py-0.2 rounded font-bold text-[10px]">
                                  {item.qty}
                                </span>
                              </span>
                            );
                          })}
                          {order.items.length > 5 && (
                            <span className="inline-flex items-center bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                              +{order.items.length - 5} еще
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Total Items Count */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block bg-slate-100 text-slate-800 font-black px-2.5 py-1 rounded-full text-xs border border-slate-200">
                        {order.items.length} поз.
                      </span>
                    </td>

                    {/* Status / Printed Checkbox */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onTogglePrintedStatus(order.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                          order.printed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {order.printed ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Печать: Да</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>В очереди</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSinglePrint(order)}
                          className="bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-xl shadow-xs transition-transform active:scale-90 cursor-pointer"
                          title="Распечатать (списать со склада)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onPreviewOrder(order)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition-colors cursor-pointer"
                          title="Предварительный просмотр"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div>
          Отображено заказов: <strong>{filteredOrders.length}</strong> из <strong>{orders.length}</strong>
        </div>
        <div className="text-slate-400">
          * При нажатии «Печать» количество позиций автоматически вычитается из остатков склада
        </div>
      </div>
    </div>
  );
};
