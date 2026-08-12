import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { OrderTable } from './components/OrderTable';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { Order, PrintSettings } from './types';
import {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_GID,
  DEFAULT_SPREADSHEET_URL,
  fetchPublicCsvValues,
  processRawRowsToOrders,
  getMockCurrentWeekOrders,
} from './utils/googleSheets';
import { printOrdersHtml } from './utils/pdfGenerator';
import { AlertCircle, CheckCircle, RefreshCw, Printer } from 'lucide-react';

export default function App() {
  // Spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState<string>(DEFAULT_SPREADSHEET_ID);
  const [gid, setGid] = useState<string>(DEFAULT_GID);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(DEFAULT_SPREADSHEET_URL);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [productHeaders, setProductHeaders] = useState<string[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
        if (!isSilent) {
          setSuccessMessage(`Загружено ${result.orders.length} заказов по ${result.departments.length} отделениям`);
          setTimeout(() => setSuccessMessage(null), 4000);
        }
      } else {
        // Fallback to mock if sheet returns 0 rows
        setOrders(getMockCurrentWeekOrders());
      }
    } catch (err: any) {
      console.warn('Ошибка загрузки данных из Google Sheets:', err);
      setErrorMessage(
        err.message || 'Не удалось загрузить данные из Google Sheets. Проверьте доступ к таблице.'
      );
      // If empty, set mock for preview
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

  // Handlers
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

  const handleSinglePrint = (order: Order) => {
    printOrdersHtml([order], printSettings);
    // Mark as printed
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, printed: true } : o))
    );
  };

  const handlePreviewOrder = (order: Order) => {
    setPreviewOrders([order]);
    setIsPreviewOpen(true);
  };

  const handleMassPrint = () => {
    const ordersToPrint = orders.filter((o) => selectedOrderIds.includes(o.id));
    if (ordersToPrint.length === 0) return;

    printOrdersHtml(ordersToPrint, printSettings);

    // Mark selected as printed
    setOrders((prev) =>
      prev.map((o) =>
        selectedOrderIds.includes(o.id) ? { ...o, printed: true } : o
      )
    );
  };

  const handleTogglePrintedStatus = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, printed: !o.printed } : o))
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      
      {/* Header */}
      <Header
        sheetUrl={spreadsheetUrl}
        activeSheetTitle="Заявки"
        autoRefreshSec={autoRefreshSec}
        setAutoRefreshSec={setAutoRefreshSec}
        countdown={countdown}
        onRefresh={() => loadOrders(false)}
        isRefreshing={isLoading}
        ordersCount={orders.length}
        departmentsCount={departments.length}
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
              className="font-bold underline hover:text-red-900 ml-3 shrink-0"
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
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
        <OrderTable
          orders={orders}
          departments={departments}
          selectedOrderIds={selectedOrderIds}
          onToggleSelectOrder={handleToggleSelectOrder}
          onSelectAllOrders={handleSelectAllOrders}
          onSinglePrint={handleSinglePrint}
          onPreviewOrder={handlePreviewOrder}
          onMassPrint={handleMassPrint}
          onTogglePrintedStatus={handleTogglePrintedStatus}
          isSheetLoaded={!isLoading}
        />
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
