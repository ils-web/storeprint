import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { OrderTable } from './components/OrderTable';
import { WarehouseView } from './components/WarehouseView';
import { DepartmentOrderView } from './components/DepartmentOrderView';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { PrintConfirmModal } from './components/PrintConfirmModal';
import { ScrollToTop } from './components/ScrollToTop';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { SuperAdminDashboard } from './components/superadmin/SuperAdminDashboard';
import { LandingPage } from './components/landing/LandingPage';
import { StaffOrderPortal } from './components/portal/StaffOrderPortal';
import { MobileStockManager } from './components/mobile/MobileStockManager';
import { InstallAppModal } from './components/portal/InstallAppModal';
import { LoginModal } from './components/auth/LoginModal';
import { EmergencyConfirmModal } from './components/emergency/EmergencyConfirmModal';
import { EmergencyBanner } from './components/emergency/EmergencyBanner';
import { printEmergencyReorderListHtml } from './utils/emergencyPdfGenerator';
import { Order, PrintSettings, StockItem, CloudSyncConfig } from './types';
import { AuthSession, InventoryProduct, TenantDepartment } from './types/multiTenant';
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
  detectPackagingUnitFromProductName,
} from './utils/stockManager';
import {
  loadCloudConfig,
  saveCloudConfig,
  fetchStockFromCloud,
  debouncedPushStockToCloud,
  pushStockToCloud,
} from './utils/cloudSync';
import {
  getActiveAuthSession,
  saveAuthSession,
  logout as logoutDb,
  getTenants,
  getWarehouses,
  saveInventory,
  saveTenantDepartments,
  fetchInventoryFromFirestore,
} from './services/multiTenantDb';
import { printOrdersHtml } from './utils/pdfGenerator';
import { AlertCircle, CheckCircle, RefreshCw, AlertTriangle, Package, Cloud, ShieldCheck, Smartphone, Building2, Download } from 'lucide-react';

const PRINTED_ORDERS_STORAGE_KEY = 'storeprint_printed_orders_v1';
const DEPARTMENTS_CACHE_KEY = 'storeprint_departments_cache_v1';
const PRODUCTS_CACHE_KEY = 'storeprint_products_cache_v1';

export default function App() {
  // Navigation View ('app' | 'landing' | 'superadmin' | 'portal_pwa' | 'mobile_stock')
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getActiveAuthSession());
  const [currentView, setCurrentView] = useState<'app' | 'landing' | 'superadmin' | 'portal_pwa' | 'mobile_stock'>('app');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [preselectedDept, setPreselectedDept] = useState<string>('');

  // Active Tenant
  const tenants = getTenants();
  const [activeTenantId, setActiveTenantId] = useState<string>(
    authSession?.tenantId || (tenants.length > 0 ? tenants[0].id : 'tenant-main-01')
  );
  const activeTenant = tenants.find((t) => t.id === activeTenantId) || tenants[0];

  // Deep Link Routing (URL params ?view=... &dept=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const deptParam = params.get('dept');
      if (deptParam) setPreselectedDept(deptParam);

      if (viewParam === 'portal_pwa') {
        setCurrentView('portal_pwa');
      } else if (viewParam === 'mobile_stock') {
        setCurrentView('mobile_stock');
      } else if (viewParam === 'superadmin') {
        setCurrentView('superadmin');
      }
    }
  }, []);

  // Spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState<string>(activeTenant?.spreadsheetId || DEFAULT_SPREADSHEET_ID);
  const [gid, setGid] = useState<string>(activeTenant?.spreadsheetGid || DEFAULT_GID);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(DEFAULT_SPREADSHEET_URL);

  // Navigation Tab inside app ('orders' | 'warehouse' | 'order_portal')
  const [activeTab, setActiveTab] = useState<'orders' | 'warehouse' | 'order_portal'>('orders');

  // Orders & Fast Cached Departments State
  const [orders, setOrders] = useState<Order[]>([]);
  const [departments, setDepartments] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DEPARTMENTS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [productHeaders, setProductHeaders] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
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

  // Warehouse Stock State (Initialized from localStorage)
  const [stock, setStock] = useState<Record<string, StockItem>>(() => loadStoredStock());

  // Cloud Sync State
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>(() => loadCloudConfig());
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Print Confirm Modal State
  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false);
  const [ordersForConfirm, setOrdersForConfirm] = useState<Order[]>([]);

  // Emergency Mode State (Hospital x3 Buffer Stock)
  const EMERGENCY_MODE_STORAGE_KEY = 'storeprint_emergency_mode_v1';
  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(EMERGENCY_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isEmergencyConfirmOpen, setIsEmergencyConfirmOpen] = useState(false);

  const handleToggleEmergencyMode = (targetState: boolean) => {
    setIsEmergencyMode(targetState);
    try {
      localStorage.setItem(EMERGENCY_MODE_STORAGE_KEY, String(targetState));
    } catch {}

    if (targetState) {
      setErrorMessage('🚨 הופעל מצב חירום רפואי (מלאי משולש X3). כל ספי המינימום שולשו למוכנות שיא!');
      setTimeout(() => setErrorMessage(null), 6000);
    } else {
      setSuccessMessage('🟢 המערכת חזרה לשגרת פעילות רגילה. ספי המינימום הוחזרו לרמתם המקורית.');
      setTimeout(() => setSuccessMessage(null), 4500);
    }
  };

  const emergencyDeficitCount = useMemo(() => {
    if (!isEmergencyMode) return 0;
    return Object.values(stock).filter((item: StockItem) => {
      if (item.isActive === false) return false;
      const routineTh = item.minThreshold || 10;
      const emergencyTh = routineTh * 3;
      return (item.currentStock || 0) < emergencyTh;
    }).length;
  }, [stock, isEmergencyMode]);

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
    fontSizePt: 10,
  });

  // Sync to Multi-Tenant DB helper
  const syncToMultiTenantDb = useCallback((prods: string[], depts: string[], currentStockMap: Record<string, StockItem>) => {
    if (!activeTenant) return;
    const warehouses = getWarehouses(activeTenant.id);
    const primaryWhId = warehouses[0]?.id || 'wh-main-01';

    // Build Inventory Products with preserved packaging units and active status
    const items: InventoryProduct[] = prods.map((name, idx) => {
      const existing = currentStockMap[name] || Object.values(currentStockMap).find((v) => v.name === name);
      const detectedUnit = detectPackagingUnitFromProductName(name);
      const safeQty = typeof existing?.currentStock === 'number' && !isNaN(existing.currentStock) ? existing.currentStock : 0;
      const safeMin = typeof existing?.minThreshold === 'number' && !isNaN(existing.minThreshold) ? existing.minThreshold : 10;
      return {
        id: `prod-${idx}-${encodeURIComponent(name.slice(0, 10))}`,
        tenantId: activeTenant.id,
        warehouseId: primaryWhId,
        name,
        colIndex: idx + 4,
        currentStock: safeQty,
        minThreshold: safeMin,
        unit: existing?.unit || detectedUnit,
        isActive: existing?.isActive !== undefined ? existing.isActive : true,
        updatedAt: new Date().toISOString(),
      };
    });

    saveInventory(activeTenant.id, items);

    // Build Departments
    const deptItems: TenantDepartment[] = depts.map((dName, idx) => ({
      id: `dept-${idx}`,
      tenantId: activeTenant.id,
      name: dName,
    }));
    saveTenantDepartments(activeTenant.id, deptItems);
  }, [activeTenant]);

  // Load and Process Google Sheet Orders
  const loadOrders = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        const rows = await fetchPublicCsvValues(spreadsheetId, gid);

        if (!rows || rows.length < 2) {
          throw new Error('קובץ הטבלה ריק או שאין בו מספיק נתונים');
        }

        const result = processRawRowsToOrders(rows);

        const currentPrinted = new Set<string>();
        try {
          const raw = localStorage.getItem(PRINTED_ORDERS_STORAGE_KEY);
          if (raw) {
            const arr = JSON.parse(raw);
            arr.forEach((id: string) => currentPrinted.add(id));
          }
        } catch {}

        const syncedOrders = result.orders.map((o) => ({
          ...o,
          printed: currentPrinted.has(o.id),
        }));

        setOrders(syncedOrders);
        setDepartments(result.departments);
        setProductHeaders(result.productHeaders);
        setLastUpdated(new Date());

        // Cache departments and products for instant next startup
        localStorage.setItem(DEPARTMENTS_CACHE_KEY, JSON.stringify(result.departments));
        localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(result.productHeaders));

        // Sync and initialize warehouse stock without losing user custom units or quantities
        setStock((prevStock) => {
          const updatedStock = syncStockWithProductHeaders(result.productHeaders, prevStock);
          saveStoredStock(updatedStock);
          syncToMultiTenantDb(result.productHeaders, result.departments, updatedStock);
          return updatedStock;
        });

        if (isManualRefresh) {
          setSuccessMessage('הנתונים נטענו בהצלחה!');
          setTimeout(() => setSuccessMessage(null), 3500);
        }
      } catch (err: any) {
        console.warn('Live fetch error, falling back to mock data:', err);
        const mockOrders = getMockCurrentWeekOrders();
        const mockProductNames = Array.from(new Set(mockOrders.flatMap((o) => o.items.map((i) => i.name))));
        const mockDeptNames = Array.from(new Set(mockOrders.map((o) => o.department)));

        setOrders(mockOrders);
        setDepartments(mockDeptNames);
        setProductHeaders(mockProductNames);
        setLastUpdated(new Date());

        setStock((prevStock) => {
          const updatedStock = syncStockWithProductHeaders(mockProductNames, prevStock);
          saveStoredStock(updatedStock);
          syncToMultiTenantDb(mockProductNames, mockDeptNames, updatedStock);
          return updatedStock;
        });

        if (isManualRefresh) {
          setWarningMessage('נטענו נתוני גיבוי (בדוק חיבור ל-Google Sheets)');
          setTimeout(() => setWarningMessage(null), 5000);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [spreadsheetId, gid, cloudConfig, syncToMultiTenantDb]
  );

  // Initial Load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle Cloud Sync
  const handleSyncWithCloud = useCallback(async () => {
    if (!cloudConfig.enabled || !cloudConfig.endpointUrl) {
      setIsCloudModalOpen(true);
      return;
    }

    setIsSyncingCloud(true);
    try {
      const fetched = await fetchStockFromCloud(cloudConfig);
      if (fetched && Object.keys(fetched).length > 0) {
        setStock((prev) => {
          const merged = { ...prev };
          Object.values(fetched).forEach((item) => {
            if (item && item.name) {
              const cleanStock = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
              const cleanMin = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : 10;
              if (merged[item.name]) {
                merged[item.name] = {
                  ...merged[item.name],
                  currentStock: cleanStock,
                  minThreshold: cleanMin,
                  unit: item.unit || merged[item.name].unit || "יח'",
                };
              } else {
                merged[item.name] = {
                  ...item,
                  currentStock: cleanStock,
                  minThreshold: cleanMin,
                  unit: item.unit || "יח'",
                };
              }
            }
          });
          saveStoredStock(merged);
          syncToMultiTenantDb(productHeaders, departments, merged);
          return merged;
        });
        setSuccessMessage('סנכרון ענן הושלם בהצלחה! יתרות המלאי עודכנו.');
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        const ok = await pushStockToCloud(stock, cloudConfig);
        if (ok) {
          setSuccessMessage('מלאי נשלח בהצלחה לענן!');
          setTimeout(() => setSuccessMessage(null), 3000);
        }
      }
    } catch (err: any) {
      setErrorMessage(`שגיאת סנכרון: ${err.message}`);
    } finally {
      setIsSyncingCloud(false);
    }
  }, [cloudConfig, stock, productHeaders, departments, syncToMultiTenantDb]);

  // Handle Cloud Config Save
  const handleSaveCloudConfig = (newConfig: CloudSyncConfig) => {
    setCloudConfig(newConfig);
    saveCloudConfig(newConfig);
    setSuccessMessage('הגדרות סנכרון ענן נשמרו בהצלחה!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Hydrate stock from Firebase Firestore on startup only if local stock is empty
  useEffect(() => {
    if (activeTenantId) {
      fetchInventoryFromFirestore(activeTenantId).then((items) => {
        if (items && items.length > 0) {
          setStock((prev) => {
            // If local stock is already populated with custom edits, preserve it
            const hasLocalItems = Object.keys(prev).length > 0;
            if (hasLocalItems) return prev;

            const updated = { ...prev };
            items.forEach((item) => {
              if (item.name && item.currentStock !== undefined) {
                const cleanStock = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
                const cleanMin = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : 10;
                updated[item.name] = {
                  id: item.id,
                  name: item.name,
                  colIndex: item.colIndex || 0,
                  currentStock: cleanStock,
                  minThreshold: cleanMin,
                  unit: item.unit || "יח'",
                  lastUpdated: item.updatedAt || new Date().toISOString(),
                };
              }
            });
            saveStoredStock(updated);
            return updated;
          });
        }
      });
    }
  }, [activeTenantId]);

  // Robust, Immediate Stock Updates with Debounced Cloud Sync to prevent UI flicker
  const handleUpdateStockItem = useCallback((
    itemIdOrName: string,
    newStock: number,
    minThreshold?: number,
    unit?: string,
    isActive?: boolean
  ) => {
    setStock((prev) => {
      // Direct lookup by key, name, or ID
      const targetKey = prev[itemIdOrName]
        ? itemIdOrName
        : Object.keys(prev).find(
            (k) => prev[k]?.name === itemIdOrName || prev[k]?.id === itemIdOrName
          ) || itemIdOrName;

      const existing = prev[targetKey];
      const cleanStock = typeof newStock === 'number' && !isNaN(newStock) ? Math.max(0, newStock) : 0;
      const cleanMin = typeof minThreshold === 'number' && !isNaN(minThreshold) ? minThreshold : (existing?.minThreshold || 10);
      const cleanUnit = unit || existing?.unit || "יח'";
      const cleanIsActive = isActive !== undefined ? isActive : (existing?.isActive !== undefined ? existing.isActive : true);
      const nowIso = new Date().toISOString();

      const updated = {
        ...prev,
        [targetKey]: {
          ...(existing || {
            id: `stock-${Date.now()}`,
            name: itemIdOrName,
            colIndex: 0,
          }),
          currentStock: cleanStock,
          minThreshold: cleanMin,
          unit: cleanUnit,
          isActive: cleanIsActive,
          lastDeducted: nowIso,
          lastUpdated: nowIso,
        },
      };

      // 1. Save locally INSTANTLY (0 ms latency)
      saveStoredStock(updated);
      syncToMultiTenantDb(productHeaders, departments, updated);

      // 2. Debounced background cloud sync (1.5s debounce) to prevent network lag & flickering
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        debouncedPushStockToCloud(updated, cloudConfig, 1500).catch(console.warn);
      }

      return updated;
    });
  }, [productHeaders, departments, cloudConfig, syncToMultiTenantDb]);

  const handleBatchUpdateStock = useCallback((updates: Record<string, StockItem | number>) => {
    setStock((prev) => {
      const next = { ...prev };
      Object.entries(updates).forEach(([key, val]) => {
        if (val && typeof val === 'object') {
          const item = val as StockItem;
          const targetKey = next[item.name] ? item.name : key;
          const currentQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
          const currentMin = typeof item.minThreshold === 'number' && !isNaN(item.minThreshold) ? item.minThreshold : (next[targetKey]?.minThreshold || 10);
          const currentUnit = item.unit || next[targetKey]?.unit || "יח'";

          if (next[targetKey]) {
            next[targetKey] = {
              ...next[targetKey],
              currentStock: Math.max(0, currentQty),
              minThreshold: currentMin,
              unit: currentUnit,
              lastDeducted: new Date().toISOString(),
            };
          } else if (item.name) {
            next[item.name] = {
              id: item.id || `stock-${Date.now()}`,
              name: item.name,
              colIndex: item.colIndex || 0,
              currentStock: Math.max(0, currentQty),
              minThreshold: currentMin,
              unit: currentUnit,
              lastDeducted: new Date().toISOString(),
            };
          }
        } else if (typeof val === 'number') {
          const qty = !isNaN(val) ? val : 0;
          if (next[key]) {
            next[key] = {
              ...next[key],
              currentStock: Math.max(0, qty),
              lastDeducted: new Date().toISOString(),
            };
          }
        }
      });
      saveStoredStock(next);
      syncToMultiTenantDb(productHeaders, departments, next);
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        debouncedPushStockToCloud(next, cloudConfig, 1500).catch(console.warn);
      }
      return next;
    });
  }, [productHeaders, departments, cloudConfig, syncToMultiTenantDb]);

  const handleSetAllStock = useCallback((defaultVal: number) => {
    setStock((prev) => {
      const next: Record<string, StockItem> = {};
      Object.keys(prev).forEach((id) => {
        const item = prev[id];
        if (item) {
          next[id] = {
            ...item,
            currentStock: defaultVal,
          };
        }
      });
      saveStoredStock(next);
      syncToMultiTenantDb(productHeaders, departments, next);
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        debouncedPushStockToCloud(next, cloudConfig, 1500).catch(console.warn);
      }
      return next;
    });
  }, [productHeaders, departments, cloudConfig, syncToMultiTenantDb]);

  // Print Handlers
  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAllOrders = (orderIds: string[]) => {
    setSelectedOrderIds(orderIds);
  };

  const handleSinglePrint = (order: Order) => {
    setOrdersForConfirm([order]);
    setIsPrintConfirmOpen(true);
  };

  const handleMassPrint = (selectedIds: string[]) => {
    const toPrint = orders.filter((o) => selectedIds.includes(o.id));
    if (toPrint.length === 0) return;
    setOrdersForConfirm(toPrint);
    setIsPrintConfirmOpen(true);
  };

  const handlePreviewOrder = (order: Order) => {
    setPreviewOrders([order]);
    setIsPreviewOpen(true);
  };

  const handleDirectCopyPrint = (order: Order) => {
    printOrdersHtml([order], printSettings, false);
  };

  const handleExecutePrint = (ordersToPrint: Order[], deductStock: boolean) => {
    printOrdersHtml(ordersToPrint, printSettings, deductStock);

    const newPrinted = new Set(printedOrderIds);
    ordersToPrint.forEach((o) => newPrinted.add(o.id));
    setPrintedOrderIds(newPrinted);
    localStorage.setItem(PRINTED_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(newPrinted)));

    setOrders((prev) =>
      prev.map((o) => (newPrinted.has(o.id) ? { ...o, printed: true } : o))
    );

    if (deductStock) {
      setStock((prevStock) => {
        const { updatedStock } = deductOrdersFromStock(ordersToPrint, prevStock);
        saveStoredStock(updatedStock);
        if (cloudConfig.enabled && cloudConfig.autoSyncOnPrint) {
          debouncedPushStockToCloud(updatedStock, cloudConfig, 1000).catch(console.error);
        }
        return updatedStock;
      });
    }

    setIsPrintConfirmOpen(false);
    setIsPreviewOpen(false);
    setSelectedOrderIds([]);
  };

  const handleTogglePrintedStatus = (orderId: string) => {
    setPrintedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      localStorage.setItem(PRINTED_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, printed: !o.printed } : o))
    );
  };

  // Auth & View Handlers
  const handleLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
    if (session.userRole === 'superadmin') {
      setCurrentView('superadmin');
    } else if (session.tenantId) {
      setActiveTenantId(session.tenantId);
      setCurrentView('app');
    }
  };

  const handleLogout = () => {
    logoutDb();
    setAuthSession(null);
    setCurrentView('landing');
  };

  // Low stock calculation
  const lowStockCount = useMemo(() => {
    return getLowStockItems(stock).length;
  }, [stock]);

  // VIEW ROUTER:
  // 1. SuperAdmin View
  if (currentView === 'superadmin' && authSession?.userRole === 'superadmin') {
    return (
      <SuperAdminDashboard
        currentSession={authSession}
        onLogout={handleLogout}
        onSelectTenantApp={(tenantId) => {
          setActiveTenantId(tenantId);
          setCurrentView('app');
        }}
      />
    );
  }

  // 2. Landing View
  if (currentView === 'landing') {
    return (
      <LandingPage
        onLoginSuccess={handleLoginSuccess}
        onOpenOrderPortal={() => setCurrentView('portal_pwa')}
      />
    );
  }

  // 3. PWA Staff Order Portal View
  if (currentView === 'portal_pwa') {
    return (
      <StaffOrderPortal
        initialTenantId={activeTenantId}
        initialDepartment={preselectedDept}
        onBackToMain={() => setCurrentView('app')}
      />
    );
  }

  // 4. Dedicated Mobile Stock Adjuster View
  if (currentView === 'mobile_stock') {
    return (
      <MobileStockManager
        stock={stock}
        isEmergencyMode={isEmergencyMode}
        onOpenEmergencyConfirm={() => setIsEmergencyConfirmOpen(true)}
        onUpdateStockItem={handleUpdateStockItem}
        onSyncWithCloud={handleSyncWithCloud}
        isSyncingCloud={isSyncingCloud}
        onBackToMain={() => setCurrentView('app')}
      />
    );
  }

  // 5. Main Tenant Warehouse & Orders Workspace View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white" dir="rtl">
      {/* Header */}
      <Header
        sheetUrl={spreadsheetUrl}
        activeSheetTitle="טבלת הזמנות אספקה"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isEmergencyMode={isEmergencyMode}
        onOpenEmergencyConfirm={() => setIsEmergencyConfirmOpen(true)}
        autoRefreshSec={autoRefreshSec}
        setAutoRefreshSec={setAutoRefreshSec}
        countdown={countdown}
        onRefresh={() => loadOrders(true)}
        isRefreshing={isLoading}
        ordersCount={orders.length}
        departmentsCount={departments.length}
        lowStockCount={lowStockCount}
        lastUpdated={lastUpdated}
        authSession={authSession}
        onOpenSuperadmin={() => {
          if (authSession?.userRole === 'superadmin') {
            setCurrentView('superadmin');
          } else {
            setIsLoginModalOpen(true);
          }
        }}
        onOpenLanding={() => setCurrentView('landing')}
        onOpenPortalPwa={() => setCurrentView('portal_pwa')}
        onOpenMobileStock={() => setCurrentView('mobile_stock')}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onLogout={handleLogout}
        tenantName={activeTenant?.name}
      />

      {/* Top Hospital Emergency Mode Banner */}
      <EmergencyBanner
        isEmergencyMode={isEmergencyMode}
        emergencyDeficitCount={emergencyDeficitCount}
        onOpenEmergencyPrint={() =>
          printEmergencyReorderListHtml(Object.values(stock), 10, 3, activeTenant?.name)
        }
        onRequestDeactivate={() => setIsEmergencyConfirmOpen(true)}
      />

      {/* Multi-Tenant Quick Switcher & Info Banner */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>סניף פעיל:</span>
            <select
              value={activeTenantId}
              onChange={(e) => {
                setActiveTenantId(e.target.value);
                const t = tenants.find((item) => item.id === e.target.value);
                if (t?.spreadsheetId) setSpreadsheetId(t.spreadsheetId);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.plan.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>התקנת אפליקציה לנייד</span>
            </button>

            <button
              onClick={() => setCurrentView('mobile_stock')}
              className="px-2.5 py-1 bg-sky-600/80 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>ספירת מלאי במובייל</span>
            </button>

            <button
              onClick={() => setCurrentView('portal_pwa')}
              className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>פורטל הזמנות (PWA)</span>
            </button>

            <button
              onClick={() => {
                if (authSession?.userRole === 'superadmin') {
                  setCurrentView('superadmin');
                } else {
                  setIsLoginModalOpen(true);
                }
              }}
              className="px-2.5 py-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>סופר-אדמין</span>
            </button>

            <button
              onClick={() => setCurrentView('landing')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              דף ראשי
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast Messages */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 w-full space-y-2">
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {warningMessage && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold">{warningMessage}</span>
            </div>
            <button
              onClick={() => setActiveTab('warehouse')}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1 rounded-xl text-xs transition-colors cursor-pointer"
            >
              פתח מסך מחסן
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
        {activeTab === 'orders' && (
          <OrderTable
            orders={orders}
            departments={departments}
            stock={stock}
            selectedOrderIds={selectedOrderIds}
            onToggleSelectOrder={handleToggleSelectOrder}
            onSelectAllOrders={handleSelectAllOrders}
            onSinglePrint={handleSinglePrint}
            onDirectCopyPrint={handleDirectCopyPrint}
            onPreviewOrder={handlePreviewOrder}
            onMassPrint={handleMassPrint}
            onTogglePrintedStatus={handleTogglePrintedStatus}
            isSheetLoaded={!isLoading}
          />
        )}

        {activeTab === 'warehouse' && (
          <WarehouseView
            stock={stock}
            departments={departments}
            tenantName={activeTenant?.name}
            isEmergencyMode={isEmergencyMode}
            onOpenEmergencyConfirm={() => setIsEmergencyConfirmOpen(true)}
            cloudConfig={cloudConfig}
            onOpenCloudModal={() => setIsCloudModalOpen(true)}
            onSyncWithCloud={handleSyncWithCloud}
            isSyncingCloud={isSyncingCloud}
            onUpdateStockItem={handleUpdateStockItem}
            onBatchUpdateStock={handleBatchUpdateStock}
            onSetAllStock={handleSetAllStock}
          />
        )}

        {activeTab === 'order_portal' && (
          <DepartmentOrderView
            productHeaders={productHeaders}
            stock={stock}
            departments={departments}
            cloudConfig={cloudConfig}
            onOrderSubmitted={() => {
              loadOrders(true);
              setSuccessMessage('ההזמנה נקלטה בהצלחה ותופיע בטבלת ההזמנות! 🎉');
              setTimeout(() => setSuccessMessage(null), 5000);
            }}
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
        onOpenConfirmPrint={(ordersToConfirm) => {
          setOrdersForConfirm(ordersToConfirm);
          setIsPrintConfirmOpen(true);
        }}
      />

      {/* Print Confirmation & Stock Control Modal */}
      <PrintConfirmModal
        isOpen={isPrintConfirmOpen}
        onClose={() => setIsPrintConfirmOpen(false)}
        ordersToPrint={ordersForConfirm}
        stock={stock}
        onConfirmPrint={handleExecutePrint}
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

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
        onOpenOrderPortal={() => {
          setIsLoginModalOpen(false);
          setCurrentView('portal_pwa');
        }}
      />

      {/* Install App Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        tenantName={activeTenant?.name}
      />

      {/* Hospital Emergency Confirm Modal */}
      <EmergencyConfirmModal
        isOpen={isEmergencyConfirmOpen}
        onClose={() => setIsEmergencyConfirmOpen(false)}
        isCurrentlyEmergency={isEmergencyMode}
        onConfirm={handleToggleEmergencyMode}
      />

      {/* Floating Scroll-to-Top Button */}
      <ScrollToTop />

      {/* PWA Mobile Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}
