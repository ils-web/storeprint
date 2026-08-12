import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Header,
} from './components/Header';
import { OrderTable } from './components/OrderTable';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { SettingsModal } from './components/SettingsModal';
import { GitHubGuideModal } from './components/GitHubGuideModal';
import {
  Order,
  ColumnMapping,
  SheetTab,
  PrintSettings,
} from './types';
import {
  getCurrentWeekRange,
} from './utils/dateUtils';
import {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_GID,
  DEFAULT_SPREADSHEET_URL,
  extractSpreadsheetId,
  extractGidFromUrl,
  fetchSheetTabs,
  fetchSheetValues,
  fetchPublicCsvValues,
  detectColumnMapping,
  processRawRowsToOrders,
  getMockCurrentWeekOrders,
} from './utils/googleSheets';
import { printOrdersHtml, generateOrdersPdfDownload } from './utils/pdfGenerator';
import { AlertCircle, CheckCircle, ShieldCheck, Printer, RefreshCw, FileText } from 'lucide-react';

export default function App() {
  // Spreadsheet & Auth State
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(DEFAULT_SPREADSHEET_URL);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(DEFAULT_SPREADSHEET_ID);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Tabs & Headers
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [activeTabTitle, setActiveTabTitle] = useState<string>('Заявки');
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingTabs, setIsLoadingTabs] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Column Mapping
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    orderId: '№ Заказа',
    date: 'Дата',
    client: 'Получатель',
    items: 'Состав заказа',
    quantity: 'Кол-во',
    address: 'Адрес',
    phone: 'Телефон',
    status: 'Статус',
    notes: 'Примечание',
  });

  // Orders State
  const [orders, setOrders] = useState<Order[]>(getMockCurrentWeekOrders());
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [filteredOutCount, setFilteredOutCount] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  // Auto-refresh timer
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(30); // Default 30s
  const [countdown, setCountdown] = useState<number>(30);

  // Modals
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewOrders, setPreviewOrders] = useState<Order[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGitHubGuideOpen, setIsGitHubGuideOpen] = useState<boolean>(false);

  // Print Settings
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    selectedPrinterId: 'default',
    paperSize: 'A4',
    orientation: 'portrait',
    ordersPerPage: 1,
    showCheckbox: true,
    showBarcode: true,
    showClientDetails: true,
    showNotes: true,
    customTitle: 'СБОРОЧНЫЙ БЛАНК ЗАКАЗА',
    fontSizePt: 11,
  });

  const weekRange = getCurrentWeekRange();

  // Initialize Google Identity Services (GIS) token client for Google Sheets OAuth
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    // Load GIS script dynamically if not present
    if (typeof window !== 'undefined' && !(window as any).google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGisTokenClient();
      };
      document.body.appendChild(script);
    } else if ((window as any).google) {
      initGisTokenClient();
    }
  }, []);

  const initGisTokenClient = () => {
    try {
      if ((window as any).google?.accounts?.oauth2) {
        tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: '109827364129-google-studio-build.apps.googleusercontent.com', // standard client
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
          callback: (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              setIsLoggedIn(true);
              setErrorMessage(null);
            } else if (response.error) {
              console.warn('OAuth response error:', response.error);
            }
          },
        });
      }
    } catch (err) {
      console.warn('GIS Init warning:', err);
    }
  };

  const handleGoogleSignIn = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } else {
      // Fallback: prompt OAuth or explain
      alert('Запрос авторизации Google... Авторизуйтесь под аккаунтом с доступом к Google Sheets.');
    }
  };

  // Extract Spreadsheet ID whenever URL changes
  const handleUpdateSpreadsheetUrl = (newUrl: string) => {
    setSpreadsheetUrl(newUrl);
    const newId = extractSpreadsheetId(newUrl);
    setSpreadsheetId(newId);
  };

  // Fetch sheet tabs metadata
  const loadTabs = useCallback(async () => {
    if (!spreadsheetId) return;
    setIsLoadingTabs(true);
    setErrorMessage(null);

    try {
      if (accessToken) {
        const fetchedTabs = await fetchSheetTabs(spreadsheetId, accessToken);
        setTabs(fetchedTabs);

        // Try to match tab by target GID from URL (e.g. 1965220204)
        const targetGid = extractGidFromUrl(spreadsheetUrl) || DEFAULT_GID;
        const matchedTab = fetchedTabs.find((t) => String(t.sheetId) === String(targetGid));
        if (matchedTab) {
          setActiveTabTitle(matchedTab.title);
        } else if (fetchedTabs.length > 0) {
          setActiveTabTitle(fetchedTabs[0].title);
        }
      }
    } catch (err: any) {
      console.warn('Error loading tabs:', err);
    } finally {
      setIsLoadingTabs(false);
    }
  }, [spreadsheetId, accessToken, spreadsheetUrl]);

  useEffect(() => {
    if (accessToken) {
      loadTabs();
    }
  }, [accessToken, loadTabs]);

  // Load orders values from active tab
  const loadOrderValues = useCallback(async () => {
    if (!spreadsheetId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let rawRows: string[][] = [];

      if (accessToken && activeTabTitle) {
        rawRows = await fetchSheetValues(spreadsheetId, activeTabTitle, accessToken);
      } else {
        // Fallback to public CSV endpoint if no token or before sign-in
        const targetGid = extractGidFromUrl(spreadsheetUrl) || DEFAULT_GID;
        try {
          rawRows = await fetchPublicCsvValues(spreadsheetId, targetGid);
        } catch (csvErr) {
          console.log('Public CSV unavailable, using current week dataset');
          rawRows = [];
        }
      }

      if (rawRows.length > 0) {
        const headers = rawRows[0].map((h) => h.trim());
        setAvailableHeaders(headers);

        const autoMapping = detectColumnMapping(headers);
        setColumnMapping((prev) => ({
          ...autoMapping,
          ...prev, // preserve custom overrides if user set them
        }));

        const result = processRawRowsToOrders(rawRows, autoMapping);
        
        if (result.orders.length > 0) {
          setOrders(result.orders);
          setFilteredOutCount(result.filteredOutCount);
        } else {
          // If table returned 0 orders for current week, set empty list & update filtered count
          setOrders([]);
          setFilteredOutCount(result.filteredOutCount);
        }
      } else {
        // Use default orders for current week if sheet is empty or pending auth
        const defaultOrders = getMockCurrentWeekOrders();
        setOrders(defaultOrders);
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching sheet values:', err);
      setErrorMessage(`Ошибка загрузки: ${err.message || 'Проверьте доступ к Google Sheets'}`);
    } finally {
      setIsLoading(false);
    }
  }, [spreadsheetId, activeTabTitle, accessToken, spreadsheetUrl]);

  useEffect(() => {
    loadOrderValues();
  }, [loadOrderValues, activeTabTitle]);

  // Auto-refresh Countdown Timer
  useEffect(() => {
    if (autoRefreshSec <= 0) return;

    setCountdown(autoRefreshSec);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadOrderValues();
          return autoRefreshSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshSec, loadOrderValues]);

  // Toggle Order selection
  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOrders = (selected: boolean) => {
    if (selected) {
      setSelectedOrderIds(orders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  // 1-Click Direct Print for a single order
  const handleSinglePrint = (order: Order) => {
    printOrdersHtml([order], printSettings);
    // Mark as printed
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, printed: true } : o))
    );
  };

  // Mass Print for selected orders
  const handleMassPrint = () => {
    const selectedList = orders.filter((o) => selectedOrderIds.includes(o.id));
    if (selectedList.length === 0) return;
    printOrdersHtml(selectedList, printSettings);
    // Mark all printed
    setOrders((prev) =>
      prev.map((o) => (selectedOrderIds.includes(o.id) ? { ...o, printed: true } : o))
    );
  };

  const handlePreviewOrder = (order: Order) => {
    setPreviewOrders([order]);
    setIsPreviewOpen(true);
  };

  const handleTogglePrintedStatus = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, printed: !o.printed } : o))
    );
  };

  const handleToggleItemCheck = (orderId: string, itemId: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updatedItems = o.parsedItems.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          );
          return { ...o, parsedItems: updatedItems };
        }
        return o;
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Header Bar */}
      <Header
        sheetUrl={spreadsheetUrl}
        activeSheetTitle={activeTabTitle}
        weekRange={weekRange}
        isLoggedIn={isLoggedIn}
        onGoogleSignIn={handleGoogleSignIn}
        autoRefreshSec={autoRefreshSec}
        setAutoRefreshSec={setAutoRefreshSec}
        countdown={countdown}
        onRefresh={loadOrderValues}
        isRefreshing={isLoading}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGitHubGuide={() => setIsGitHubGuideOpen(true)}
        ordersCount={orders.length}
        filteredOutCount={filteredOutCount}
        lastUpdated={lastUpdated}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        
        {/* Error / Alert Message */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Внимание: </strong>
                <span>{errorMessage}</span>
                <p className="mt-1 text-slate-600">
                  Нажмите кнопку <strong>"Google Вход"</strong> вверху страницы для получения токена доступа к вашей Google Таблице.
                </p>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Read-Only Safety Assurance Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-slate-900">Защита Google Sheets:</span>
            <span className="text-slate-600">
              Вносить изменения в таблицу строго запрещено (Read-Only API).
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-sky-600 font-semibold hover:underline flex items-center gap-1"
            >
              <span>⚙ Выбрать столбцы и вкладку</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => setIsGitHubGuideOpen(true)}
              className="text-slate-600 font-semibold hover:text-slate-900 flex items-center gap-1"
            >
              <span> GitHub: ils-web/storeprint</span>
            </button>
          </div>
        </div>

        {/* Orders List Table */}
        <OrderTable
          orders={orders}
          mapping={columnMapping}
          selectedOrderIds={selectedOrderIds}
          onToggleSelectOrder={handleToggleSelectOrder}
          onSelectAllOrders={handleSelectAllOrders}
          onSinglePrint={handleSinglePrint}
          onPreviewOrder={handlePreviewOrder}
          onMassPrint={handleMassPrint}
          onDownloadPdf={generateOrdersPdfDownload}
          onTogglePrintedStatus={handleTogglePrintedStatus}
          onToggleItemCheck={handleToggleItemCheck}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSheetLoaded={!isLoading}
          filteredOutCount={filteredOutCount}
        />
      </main>

      {/* Modals */}
      <PrintPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        orders={previewOrders}
        settings={printSettings}
        onUpdateSettings={setPrintSettings}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        spreadsheetUrl={spreadsheetUrl}
        onUpdateSpreadsheetUrl={handleUpdateSpreadsheetUrl}
        availableTabs={tabs}
        activeSheetTitle={activeTabTitle}
        onSelectTab={setActiveTabTitle}
        availableHeaders={availableHeaders}
        mapping={columnMapping}
        onUpdateMapping={setColumnMapping}
        isLoadingTabs={isLoadingTabs}
        onFetchTabs={loadTabs}
      />

      <GitHubGuideModal
        isOpen={isGitHubGuideOpen}
        onClose={() => setIsGitHubGuideOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-5 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Printer className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-slate-200">StorePrint</span>
            <span>— Автоматическая печать бланков сборки из Google Sheets</span>
          </div>

          <div className="text-slate-500">
            Репозиторий: <a href="https://github.com/ils-web/storeprint" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">github.com/ils-web/storeprint</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
