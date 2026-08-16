import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { OrderTable } from './components/OrderTable';
import { WarehouseView } from './components/WarehouseView';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { Order, PrintSettings, StockItem, CloudSyncConfig } from './types';
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
import {
  loadCloudConfig,
  saveCloudConfig,
  fetchStockFromCloud,
  pushStockToCloud,
} from './utils/cloudSync';
import { printOrdersHtml } from './utils/pdfGenerator';
import { AlertCircle, CheckCircle, RefreshCw, AlertTriangle, Package, Cloud } from 'lucide-react';

const PRINTED_ORDERS_STORAGE_KEY = 'storeprint_printed_orders_v1';

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

  // Printed Orders Memory Set
  const [printedOrderIds, setPrintedOrderIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(PRINTED_ORDERS_STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Warehouse Stock State
  const [stock, setStock] = useState<Record<string, StockItem>>(() => loadStoredStock());

  // Cloud Sync State
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>(() => loadCloudConfig());
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

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

  // Sync with Cloud
  const handleSyncWithCloud = useCallback(async () => {
    if (!cloudConfig.endpointUrl) return false;
    setIsSyncingCloud(true);
    try {
      const cloudData = await fetchStockFromCloud(cloudConfig);
      if (cloudData && typeof cloudData === 'object') {
        if (Object.keys(cloudData).length > 0) {
          setStock(cloudData);
          saveStoredStock(cloudData);
        } else {
          // If cloud data is empty (fresh sheet), initialize it with local stock
          pushStockToCloud(stock, cloudConfig).catch(() => {});
        }
        setSuccessMessage('המלאי סונכרן בהצלחה מול הטבלה בענן! ☁️');
        setTimeout(() => setSuccessMessage(null), 4000);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Cloud sync failed:', err);
      return false;
    } finally {
      setIsSyncingCloud(false);
    }
  }, [cloudConfig, stock]);

  // Load orders from Google Sheet
  const loadOrders = useCallback(async (isSilent: boolean = false) => {
    if (!isSilent) setIsLoading(true);
    setErrorMessage(null);

    try {
      const rawRows = await fetchPublicCsvValues(spreadsheetId, gid);
      const result = processRawRowsToOrders(rawRows);

      if (result.orders.length > 0) {
        // Apply printed status memory
        const hydratedOrders = result.orders.map((o) => ({
          ...o,
          printed: printedOrderIds.has(o.id) || o.printed,
        }));

        setOrders(hydratedOrders);
        setDepartments(result.departments);
        setProductHeaders(result.productHeaders);
        setLastUpdated(new Date());

        // Sync stock map with product headers
        setStock((prevStock) => {
          const synced = syncStockWithProductHeaders(result.productHeaders, prevStock);
          saveStoredStock(synced);
          return synced;
        });

        if (!isSilent) {
          setSuccessMessage(`נטענו ${result.orders.length} הזמנות מ-${result.departments.length} מחלקות`);
          setTimeout(() => setSuccessMessage(null), 4000);
        }
      } else {
        setOrders(getMockCurrentWeekOrders());
      }
    } catch (err: any) {
      console.warn('שגיאה בטעינת נתונים מ-Google Sheets:', err);
      setErrorMessage(
        err.message || 'לא ניתן לטעון נתונים מ-Google Sheets. אנא בדקו את החיבור וההרשאות.'
      );
      if (orders.length === 0) {
        setOrders(getMockCurrentWeekOrders());
      }
    } finally {
      setIsLoading(false);
      setCountdown(autoRefreshSec);
    }
  }, [spreadsheetId, gid, autoRefreshSec, orders.length, printedOrderIds]);

  // Initial Load & Cloud Sync
  useEffect(() => {
    loadOrders();
    if (cloudConfig.enabled && cloudConfig.endpointUrl) {
      handleSyncWithCloud();
    }
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

  // Save printed order IDs in localStorage
  const markOrdersPrinted = (ids: string[], isPrinted: boolean = true) => {
    setPrintedOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (isPrinted) next.add(id);
        else next.delete(id);
      });
      try {
        localStorage.setItem(PRINTED_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Failed to save printed orders:', e);
      }
      return next;
    });

    setOrders((prev) =>
      prev.map((o) =>
        ids.includes(o.id) ? { ...o, printed: isPrinted, printedAt: isPrinted ? new Date().toISOString() : undefined } : o
      )
    );
  };

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
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        pushStockToCloud(updated, cloudConfig).catch(() => {});
      }
      return updated;
    });
  };

  const handleBatchUpdateStock = (newStock: Record<string, StockItem>) => {
    setStock(newStock);
    saveStoredStock(newStock);
    if (cloudConfig.enabled && cloudConfig.endpointUrl) {
      pushStockToCloud(newStock, cloudConfig).catch(() => {});
    }
  };

  const handleSetAllStock = (qty: number) => {
    setStock((prev) => {
      const updated: Record<string, StockItem> = {};
      Object.keys(prev).forEach((k) => {
        updated[k] = { ...prev[k], currentStock: qty };
      });
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
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        pushStockToCloud(updated, cloudConfig).catch(() => {});
      }
      return updated;
    });
    setSuccessMessage(`יתרת מלאי של ${qty} יח' הוגדרה לכל הפריטים בהצלחה!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Printing with Auto-Deduction & Cloud Push
  const handleSinglePrint = (order: Order) => {
    // 1. Print document
    printOrdersHtml([order], printSettings);

    // 2. Deduct items from warehouse stock
    const deduction = deductOrdersFromStock([order], stock);
    setStock(deduction.updatedStock);

    // Push to cloud if configured
    if (cloudConfig.enabled && cloudConfig.endpointUrl && cloudConfig.autoSyncOnPrint) {
      pushStockToCloud(deduction.updatedStock, cloudConfig).catch(() => {});
    }

    // 3. Mark order as printed
    markOrdersPrinted([order.id], true);

    // 4. Feedback
    setSuccessMessage(`הזמנה עבור ${order.department} הודפסה. קוזזו ${deduction.totalDeductedCount} פריטים מהמלאי.`);
    setTimeout(() => setSuccessMessage(null), 4000);

    if (deduction.newLowStockItems.length > 0) {
      setWarningMessage(
        `⚠️ שים לב: ${deduction.newLowStockItems.length} פריטים ירדו מתחת לסף 10 יח' במלאי!`
      );
      setTimeout(() => setWarningMessage(null), 6000);
    }
  };

  const handleMassPrint = () => {
    const ordersToPrint = orders.filter((o) => selectedOrderIds.includes(o.id));
    if (ordersToPrint.length === 0) return;

    printOrdersHtml(ordersToPrint, printSettings);

    const deduction = deductOrdersFromStock(ordersToPrint, stock);
    setStock(deduction.updatedStock);

    if (cloudConfig.enabled && cloudConfig.endpointUrl && cloudConfig.autoSyncOnPrint) {
      pushStockToCloud(deduction.updatedStock, cloudConfig).catch(() => {});
    }

    markOrdersPrinted(selectedOrderIds, true);

    setSuccessMessage(
      `הודפסו ${ordersToPrint.length} הזמנות בהצלחה. קוזזו ${deduction.totalDeductedCount} פריטים מהמלאי.`
    );
    setTimeout(() => setSuccessMessage(null), 4000);

    if (deduction.newLowStockItems.length > 0) {
      setWarningMessage(
        `⚠️ שים לב: ${deduction.newLowStockItems.length} פריטים ירדו מתחת לסף 10 יח' במלאי!`
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
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    markOrdersPrinted([orderId], !order.printed);
  };

  const handleSaveCloudConfig = (newCfg: CloudSyncConfig) => {
    setCloudConfig(newCfg);
    saveCloudConfig(newCfg);
    if (newCfg.endpointUrl) {
      // Auto-push current stock to cloud to populate the new sheet
      pushStockToCloud(stock, newCfg)
        .then(() => {
          setSuccessMessage('טבלת המחסן החדשה חוברה ואוכלסה בהצלחה! ☁️');
          setTimeout(() => setSuccessMessage(null), 4000);
        })
        .catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900" dir="rtl">
      
      {/* Header */}
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => loadOrders(false)}
              className="font-bold underline hover:text-red-900 mr-3 shrink-0 cursor-pointer"
            >
              נסה שוב
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-xs animate-fadeIn font-bold">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {warningMessage && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-bounce">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">{warningMessage}</span>
            </div>
            <button
              onClick={() => setActiveTab('warehouse')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-xl text-xs transition-colors cursor-pointer"
            >
              פתח מסך מחסן
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
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
            cloudConfig={cloudConfig}
            onOpenCloudModal={() => setIsCloudModalOpen(true)}
            onSyncWithCloud={handleSyncWithCloud}
            isSyncingCloud={isSyncingCloud}
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

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        config={cloudConfig}
        totalItemsCount={productHeaders.length || 187}
        onSaveConfig={handleSaveCloudConfig}
        onSyncNow={handleSyncWithCloud}
      />

    </div>
  );
}
