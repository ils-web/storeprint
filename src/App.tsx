import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { OrderTable } from './components/OrderTable';
import { WarehouseView } from './components/WarehouseView';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { Order, PrintSettings, StockItem } from './types';
import {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_GID,
  DEFAULT_SPREADSHEET_URL,
  fetchPublicCsvValues,
  processRawRowsToOrders,
  getMockCurrentWeekOrders,
} from './utils/googleSheets';
import {
  loadStoredStock,
  saveStoredStock,
  syncStockWithProductHeaders,
  deductOrdersFromStock,
  getLowStockItems,
} from './utils/stockManager';
import { printOrdersHtml } from './utils/pdfGenerator';
import { AlertCircle, CheckCircle, RefreshCw, AlertTriangle, Package } from 'lucide-react';

export default function App() {
  // Spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState<string>(DEFAULT_SPREADSHEET_ID);
  const [gid, setGid] = useState<string>(DEFAULT_GID);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(DEFAULT_SPREADSHEET_URL);

  // Navigation Tab ('orders' | 'warehouse')
  const [activeTab, setActiveTab] = useState<'orders' | 'warehouse'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [productHeaders, setProductHeaders] = useState<string[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Warehouse Stock State
  const [stock, setStock] = useState<Record<string, StockItem>>(() => loadStoredStock());

  // Auto-refresh timer
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(30);
  const [countdown, setCountdown] = useState<number>(30);

  // Print & Modal Settings
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewOrders, setPreviewOrders] = useState<Order[]>([]);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    selectedPrinterId: 'default',
    paperSize: 'A4',
    orientation: 'portrait',
    ordersPerPage: 1,
    showCheckbox: true,
    showBarcode: false,
    showClientDetails: true,
    showNotes: true,
    customTitle: 'טופס ניפוק והספקה',
    fontSizePt: 12,
  });

  // Count low stock items (< 10)
  const lowStockItems = useMemo(() => getLowStockItems(stock, 10), [stock]);

  // Load orders from Google Sheet
  const loadOrders = useCallback(async (isSilent: boolean = false) => {
    if (!isSilent) setIsLoading(true);
    setErrorMessage(null);

    try {
      const rawRows = await fetchPublicCsvValues(spreadsheetId, gid);
      const result = processRawRowsToOrders(rawRows);

      if (result.orders.length > 0) {
        setOrders(result.orders);
        setDepartments(result.departments);
        setProductHeaders(result.productHeaders);
        setLastUpdated(new Date());

        // Sync stock map with any newly added product headers
        setStock((prevStock) => {
          const synced = syncStockWithProductHeaders(result.productHeaders, prevStock);
          saveStoredStock(synced);
          return synced;
        });

        if (!isSilent) {
          setSuccessMessage(`Загружено ${result.orders.length} заказов по ${result.departments.length} отделениям`);
          setTimeout(() => setSuccessMessage(null), 4000);
        }
      } else {
        setOrders(getMockCurrentWeekOrders());
      }
    } catch (err: any) {
      console.warn('Ошибка загрузки данных из Google Sheets:', err);
      setErrorMessage(
        err.message || 'Не удалось загрузить данные из Google Sheets. Проверьте доступ к таблице.'
      );
      if (orders.length === 0) {
        setOrders(getMockCurrentWeekOrders());
      }
    } finally {
      setIsLoading(false);
      setCountdown(autoRefreshSec);
    }
  }, [spreadsheetId, gid, autoRefreshSec, orders.length]);

  // Initial Load
  useEffect(() => {
    loadOrders();
  }, []);

  // Auto-Refresh Countdown
  useEffect(() => {
    if (autoRefreshSec <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadOrders(true);
          return autoRefreshSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshSec, loadOrders]);

  // Stock Management Handlers
  const handleUpdateStockItem = (name: string, newQty: number, minThreshold?: number) => {
    setStock((prev) => {
      const existing = prev[name] || {
        id: `stock-${Date.now()}`,
        name,
        colIndex: 0,
        currentStock: 0,
        minThreshold: 10,
      };

      const updated = {
        ...prev,
        [name]: {
          ...existing,
          currentStock: newQty,
          minThreshold: minThreshold !== undefined ? minThreshold : (existing.minThreshold || 10),
        },
      };

      saveStoredStock(updated);
      return updated;
    });
  };

  const handleBatchUpdateStock = (newStock: Record<string, StockItem>) => {
    setStock(newStock);
    saveStoredStock(newStock);
  };

  const handleSetAllStock = (qty: number) => {
    setStock((prev) => {
      const updated: Record<string, StockItem> = {};
      Object.keys(prev).forEach((k) => {
        updated[k] = { ...prev[k], currentStock: qty };
      });
      // Also ensure all productHeaders are covered
      productHeaders.forEach((h, idx) => {
        const name = h.trim();
        if (name && !updated[name]) {
          updated[name] = {
            id: `stock-${idx + 4}`,
            name,
            colIndex: idx + 4,
            currentStock: qty,
            minThreshold: 10,
          };
        }
      });
      saveStoredStock(updated);
      return updated;
    });
    setSuccessMessage(`Остаток ${qty} шт установлен для всех товаров склада`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Printing with Auto-Deduction from Warehouse Stock
  const handleSinglePrint = (order: Order) => {
    // 1. Print document
    printOrdersHtml([order], printSettings);

    // 2. Deduct items from warehouse stock
    const deduction = deductOrdersFromStock([order], stock);
    setStock(deduction.updatedStock);

    // 3. Mark order as printed
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, printed: true } : o))
    );

    // 4. Show deduction feedback & alerts
    setSuccessMessage(`Заказ ${order.id} напечатан. Списано ${deduction.totalDeductedCount} ед. со склада.`);
    setTimeout(() => setSuccessMessage(null), 4000);

    if (deduction.newLowStockItems.length > 0) {
      setWarningMessage(
        `⚠️ Внимание: ${deduction.newLowStockItems.length} поз. упали ниже порога 10 шт на складе!`
      );
      setTimeout(() => setWarningMessage(null), 6000);
    }
  };

  const handleMassPrint = () => {
    const ordersToPrint = orders.filter((o) => selectedOrderIds.includes(o.id));
    if (ordersToPrint.length === 0) return;

    // 1. Print all selected
    printOrdersHtml(ordersToPrint, printSettings);

    // 2. Deduct all from warehouse stock
    const deduction = deductOrdersFromStock(ordersToPrint, stock);
    setStock(deduction.updatedStock);

    // 3. Mark selected as printed
    setOrders((prev) =>
      prev.map((o) =>
        selectedOrderIds.includes(o.id) ? { ...o, printed: true } : o
      )
    );

    // 4. Feedback
    setSuccessMessage(
      `Напечатано заказов: ${ordersToPrint.length}. Списано ${deduction.totalDeductedCount} ед. со склада.`
    );
    setTimeout(() => setSuccessMessage(null), 4000);

    if (deduction.newLowStockItems.length > 0) {
      setWarningMessage(
        `⚠️ Внимание: ${deduction.newLowStockItems.length} поз. упали ниже порога 10 шт на складе!`
      );
      setTimeout(() => setWarningMessage(null), 7000);
    }
  };

  const handlePreviewOrder = (order: Order) => {
    setPreviewOrders([order]);
    setIsPreviewOpen(true);
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOrders = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedOrderIds(orders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleTogglePrintedStatus = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, printed: !o.printed } : o))
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      
      {/* Header with Navigation */}
      <Header
        sheetUrl={spreadsheetUrl}
        activeSheetTitle="Заявки"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        autoRefreshSec={autoRefreshSec}
        setAutoRefreshSec={setAutoRefreshSec}
        countdown={countdown}
        onRefresh={() => loadOrders(false)}
        isRefreshing={isLoading}
        ordersCount={orders.length}
        departmentsCount={departments.length}
        lowStockCount={lowStockItems.length}
        lastUpdated={lastUpdated}
      />

      {/* Alert Banners */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full space-y-2">
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => loadOrders(false)}
              className="font-bold underline hover:text-red-900 ml-3 shrink-0 cursor-pointer"
            >
              Повторить
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {warningMessage && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-xs animate-bounce">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">{warningMessage}</span>
            </div>
            <button
              onClick={() => setActiveTab('warehouse')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Открыть Склад
            </button>
          </div>
        )}
      </div>

      {/* Main Content View (Orders OR Warehouse) */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
        {activeTab === 'orders' ? (
          <OrderTable
            orders={orders}
            departments={departments}
            stock={stock}
            selectedOrderIds={selectedOrderIds}
            onToggleSelectOrder={handleToggleSelectOrder}
            onSelectAllOrders={handleSelectAllOrders}
            onSinglePrint={handleSinglePrint}
            onPreviewOrder={handlePreviewOrder}
            onMassPrint={handleMassPrint}
            onTogglePrintedStatus={handleTogglePrintedStatus}
            isSheetLoaded={!isLoading}
          />
        ) : (
          <WarehouseView
            stock={stock}
            onUpdateStockItem={handleUpdateStockItem}
            onBatchUpdateStock={handleBatchUpdateStock}
            onSetAllStock={handleSetAllStock}
          />
        )}
      </main>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        orders={previewOrders}
        settings={printSettings}
        onUpdateSettings={setPrintSettings}
      />

    </div>
  );
}
