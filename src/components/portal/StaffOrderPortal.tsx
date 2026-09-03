import React, { useState, useMemo, useEffect } from 'react';
import {
  Tenant,
  Warehouse,
  InventoryProduct,
  TenantDepartment,
  MultiTenantOrderItem,
  PackagingUnit,
  STANDARD_PACKAGING_UNITS,
} from '../../types/multiTenant';
import {
  getTenants,
  getWarehouses,
  getInventory,
  getTenantDepartments,
  getTenantOrders,
  saveTenantOrders,
  createTenantOrder,
} from '../../services/multiTenantDb';
import { getDbStock, getDbDepartments } from '../../services/unifiedDb';
import { loadCloudConfig, submitDepartmentOrderToCloud } from '../../utils/cloudSync';
import { pushOrderToFirestore, subscribeToFirestoreStock } from '../../services/firestoreSync';
import { StockItem } from '../../types';
import { InstallAppModal } from './InstallAppModal';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  Package,
  Building2,
  ArrowRight,
  Send,
  AlertCircle,
  Sparkles,
  ClipboardList,
  Smartphone,
  Download,
  Trash2,
  Users,
  ArrowUp,
  X,
  RotateCcw,
  Tag,
  FileText,
  ShieldCheck,
  Flame,
  Check,
  ChevronDown,
} from 'lucide-react';

interface StaffOrderPortalProps {
  initialTenantId?: string;
  initialDepartment?: string;
}

const DEFAULT_DEPARTMENTS = [
  "ג' 1 סיעוד מורכב",
  "ג' 2 סיעוד מורכב",
  "ג' 3 סיעוד מורכב",
  "שיקום א'",
  "שיקום ב' 1",
  "שיקום ב' 2",
  "סיעודית א'",
  "סיעודית ב'",
  "תשושי נפש",
  "פיזיותרפיה",
  "ריפוי בעיסוק",
  "קלינאות תקשורת",
  "הנהלה / כללי",
];

// Smart Category Classifier
function detectItemCategory(name: string): 'gloves' | 'dressings' | 'hygiene' | 'medical' | 'general' {
  const n = (name || '').toLowerCase();
  if (n.includes('כפפ') || n.includes('כפפות') || n.includes('מסכ') || n.includes('חלוק') || n.includes('מיגון')) {
    return 'gloves';
  }
  if (
    n.includes('גאז') ||
    n.includes('חביש') ||
    n.includes('פלסטר') ||
    n.includes('תחבושת') ||
    n.includes('אגד') ||
    n.includes('פד') ||
    n.includes('ספוג') ||
    n.includes('סרט הדבקה')
  ) {
    return 'dressings';
  }
  if (
    n.includes('סדינ') ||
    n.includes('חיתול') ||
    n.includes('מגבונ') ||
    n.includes('שמפו') ||
    n.includes('סבון') ||
    n.includes('נייר') ||
    n.includes('שקית') ||
    n.includes('קרם') ||
    n.includes('משחה') ||
    n.includes('ספיגה')
  ) {
    return 'hygiene';
  }
  if (
    n.includes('מזרק') ||
    n.includes('מחט') ||
    n.includes('עירוי') ||
    n.includes('צינור') ||
    n.includes('קטטר') ||
    n.includes('ונפלון') ||
    n.includes('מדחום') ||
    n.includes('סט עירוי') ||
    n.includes('סליין') ||
    n.includes('אלכוהול') ||
    n.includes('כלורהקסידין')
  ) {
    return 'medical';
  }
  return 'general';
}

export function StaffOrderPortal({ initialTenantId, initialDepartment }: StaffOrderPortalProps) {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const tenants = getTenants();
  const [selectedTenantId] = useState<string>(
    initialTenantId || (tenants.length > 0 ? tenants[0].id : 'tenant-main-01')
  );

  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const warehouses = getWarehouses(selectedTenantId);
  const activeWarehouse = warehouses[0] || null;

  // Departments List
  const departmentsList = useMemo(() => {
    const fromDb = getDbDepartments();
    const fromTenant = getTenantDepartments(selectedTenantId).map((d) => d.name);
    const merged = Array.from(new Set([...fromDb, ...fromTenant, ...DEFAULT_DEPARTMENTS])).filter(Boolean);
    return merged;
  }, [selectedTenantId]);

  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string>(() => {
    if (initialDepartment && initialDepartment.trim()) return initialDepartment.trim();
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const d = urlParams.get('dept');
      if (d) return decodeURIComponent(d);
      const saved = localStorage.getItem('storeprint_portal_saved_dept');
      if (saved) return saved;
    }
    return departmentsList[0] || "ג' 1 סיעוד מורכב";
  });

  const [deptSearchTerm, setDeptSearchTerm] = useState('');
  const [patientsCount, setPatientsCount] = useState<string>('');
  const [requesterName, setRequesterName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('storeprint_portal_requester_name') || '';
    }
    return '';
  });

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'gloves' | 'dressings' | 'hygiene' | 'medical' | 'in_stock' | 'in_cart'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');

  // Cart State: Map of productId -> MultiTenantOrderItem
  const [cart, setCart] = useState<Record<string, MultiTenantOrderItem>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccessNumber, setOrderSuccessNumber] = useState<string | null>(null);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveStock, setLiveStock] = useState<Record<string, StockItem>>(() => getDbStock());

  // Save selected department
  useEffect(() => {
    if (selectedDepartmentName && typeof window !== 'undefined') {
      localStorage.setItem('storeprint_portal_saved_dept', selectedDepartmentName);
    }
  }, [selectedDepartmentName]);

  // Save requester name
  useEffect(() => {
    if (requesterName && typeof window !== 'undefined') {
      localStorage.setItem('storeprint_portal_requester_name', requesterName);
    }
  }, [requesterName]);

  // Subscribe to real-time warehouse stock from Firestore
  useEffect(() => {
    const unsub = subscribeToFirestoreStock((newStock) => {
      setLiveStock(newStock);
    }, selectedTenantId);
    return () => {
      if (unsub) unsub();
    };
  }, [selectedTenantId]);

  // Scroll to Top Listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 250);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-prompt mobile installation on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (!isStandalone) {
      const alreadyPrompted = sessionStorage.getItem('storeprint_portal_installed_prompted');
      if (!alreadyPrompted) {
        sessionStorage.setItem('storeprint_portal_installed_prompted', 'true');
        const timer = setTimeout(() => {
          setIsInstallModalOpen(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // RULE 1: Catalog strictly matches active warehouse stock and EXCLUDES frozen/inactive items
  const inventoryItems = useMemo(() => {
    const dbStock = getDbStock();
    const mergedStock: Record<string, StockItem> = { ...dbStock, ...(liveStock || {}) };

    const stockList = Object.values(mergedStock);

    if (stockList.length > 0) {
      return stockList
        .filter((item) => item && item.isActive !== false && item.name && !item.name.startsWith('פריט '))
        .sort((a, b) => {
          const colA = typeof a.colIndex === 'number' ? a.colIndex : 999;
          const colB = typeof b.colIndex === 'number' ? b.colIndex : 999;
          return colA - colB;
        })
        .map((item, idx) => ({
          id: item.id || item.name,
          warehouseId: activeWarehouse?.id || 'wh-default',
          name: item.name,
          unit: (item.unit as PackagingUnit) || "יח'",
          currentStock: typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0,
          minThreshold: item.minThreshold || 10,
          colIndex: item.colIndex || idx + 1,
          isActive: true,
          limitByPatients: Boolean(item.limitByPatients),
          category: detectItemCategory(item.name),
        }));
    }

    if (!activeTenant || !activeWarehouse) return [];
    return getInventory(activeTenant.id, activeWarehouse.id)
      .filter((p) => p.isActive !== false)
      .map((p) => ({ ...p, category: detectItemCategory(p.name) }));
  }, [liveStock, activeTenant, activeWarehouse]);

  // Filtered Products by Category & Search Query
  const filteredProducts = useMemo(() => {
    return inventoryItems.filter((p) => {
      // Category Filter
      if (categoryFilter === 'in_cart') {
        const inCartQty = cart[p.id]?.orderedQty || 0;
        if (inCartQty <= 0) return false;
      } else if (categoryFilter === 'in_stock') {
        if (p.currentStock <= 0) return false;
      } else if (categoryFilter !== 'all') {
        if (p.category !== categoryFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesUnit = p.unit && p.unit.toLowerCase().includes(q);
        const matchesIndex = String(p.colIndex).includes(q);
        if (!matchesName && !matchesUnit && !matchesIndex) return false;
      }

      return true;
    });
  }, [inventoryItems, categoryFilter, searchQuery, cart]);

  // Cart totals
  const cartItemsList: MultiTenantOrderItem[] = useMemo(() => {
    return (Object.values(cart) as MultiTenantOrderItem[]).filter(
      (item) => Boolean(item && item.orderedQty > 0)
    );
  }, [cart]);

  const totalCartCount = useMemo(() => {
    return cartItemsList.reduce((acc, item) => acc + item.orderedQty, 0);
  }, [cartItemsList]);

  // Handlers for cart
  const handleSetQty = (product: any, unit: PackagingUnit, exactQty: number) => {
    const safeQty = Math.max(0, exactQty);
    if (product.limitByPatients && safeQty > 0) {
      const maxAllowed = parseInt(patientsCount, 10);
      if (isNaN(maxAllowed) || maxAllowed <= 0) {
        alert(
          `הפריט "${product.name}" מוגבל לפי כמות המטופלים במחלקה.\nנא להזין תחילה את מספר המטופלים במחלקה.`
        );
        return;
      }
      if (safeQty > maxAllowed) {
        alert(
          `הכמות המרבית להזמנה עבור "${product.name}" היא ${maxAllowed} יח' (לפי מספר המטופלים הרשום במחלקה).`
        );
        return;
      }
    }

    setCart((prev) => {
      if (safeQty === 0) {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      }

      const existing = prev[product.id] || {
        id: `item-${product.id}`,
        productId: product.id,
        name: product.name,
        orderedQty: 0,
        orderedUnit: unit || product.unit || "יח'",
      };

      return {
        ...prev,
        [product.id]: {
          ...existing,
          orderedQty: safeQty,
          orderedUnit: unit,
        },
      };
    });
  };

  const handleUpdateQty = (product: any, unit: PackagingUnit, delta: number) => {
    const currentQty = cart[product.id]?.orderedQty || 0;
    handleSetQty(product, unit, currentQty + delta);
  };

  const handleUnitChange = (product: any, newUnit: PackagingUnit) => {
    setCart((prev) => {
      if (!prev[product.id]) return prev;
      return {
        ...prev,
        [product.id]: {
          ...prev[product.id],
          orderedUnit: newUnit,
        },
      };
    });
  };

  const handleClearCart = () => {
    if (window.confirm('האם לאפס ולרוקן את כל סל ההזמנה?')) {
      setCart({});
    }
  };

  const handleReorder = (pastOrder: any) => {
    const newCart: Record<string, MultiTenantOrderItem> = {};
    pastOrder.items.forEach((it: any) => {
      const matchingProduct = inventoryItems.find((p) => p.name === it.name) || {
        id: `prod-${it.name}`,
        name: it.name,
        unit: it.orderedUnit || "יח'",
      };
      newCart[matchingProduct.id] = {
        id: `item-${matchingProduct.id}`,
        productId: matchingProduct.id,
        name: it.name,
        orderedQty: it.orderedQty,
        orderedUnit: it.orderedUnit || "יח'",
      };
    });
    setCart(newCart);
    setActiveTab('catalog');
    setCategoryFilter('in_cart');
    setIsCartOpen(true);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartmentName.trim()) {
      alert('נא לבחור את שם המחלקה המזמינה');
      return;
    }
    if (!requesterName.trim()) {
      alert('נא להזין את שם המזמין/ה (איש קשר במחלקה)');
      return;
    }
    if (cartItemsList.length === 0) {
      alert('סל ההזמנה ריק. נא לבחור לפחות פריט אחד להזמנה.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedNotes = [
        requesterName.trim() ? `שם מזמין/ה: ${requesterName.trim()}` : '',
        notes.trim() ? notes.trim() : '',
      ]
        .filter(Boolean)
        .join(' | ');

      // 1. Create order & push to Firestore Real-Time DB FIRST (instant delivery!)
      const newOrder = createTenantOrder(selectedTenantId, {
        tenantId: selectedTenantId,
        warehouseId: activeWarehouse?.id || 'wh-default',
        departmentId: `dept-${Date.now()}`,
        departmentName: selectedDepartmentName.trim(),
        items: cartItemsList,
        totalItemsCount: cartItemsList.length,
        notes: formattedNotes,
        patientsCount: patientsCount.trim() || undefined,
        status: 'NEW',
        source: 'WEB_PORTAL',
        printed: false,
      });

      await pushOrderToFirestore(newOrder, selectedTenantId);

      // 2. Submit directly to Google Sheets Cloud in background (non-blocking)
      const cloudConfig = loadCloudConfig();
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        const orderItemsMap: Record<string, { qty: number; unit?: string }> = {};
        cartItemsList.forEach((it) => {
          orderItemsMap[it.name] = { qty: it.orderedQty, unit: it.orderedUnit };
        });

        submitDepartmentOrderToCloud(
          {
            department: selectedDepartmentName.trim(),
            orderedBy: requesterName.trim() || undefined,
            patientsCount: patientsCount.trim() || undefined,
            notes: formattedNotes || undefined,
            items: orderItemsMap,
          },
          cloudConfig
        ).catch((err) => console.warn('Cloud sync error (order already in Firestore):', err));
      }

      setLastSubmittedOrder(newOrder);
      setOrderSuccessNumber(newOrder.orderNumber);
      setCart({});
      setNotes('');
      setIsCartOpen(false);
      window.dispatchEvent(new Event('storeprint_order_created'));
    } catch (err: any) {
      console.error('Order submit error:', err);
      alert(err.message || 'שגיאה בשליחת ההזמנה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSlip = (orderToPrint: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateStr = new Date(orderToPrint.createdAt || Date.now()).toLocaleString('he-IL');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <title>עותק הזמנה - ${orderToPrint.orderNumber}</title>
        <style>
          * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
          body { padding: 20px; color: #000; }
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 20px; font-weight: 900; }
          .info { font-size: 14px; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #000; padding: 6px 10px; font-size: 13px; text-align: right; }
          th { background: #f0f0f0; }
          .footer { margin-top: 20px; font-size: 12px; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">📋 טופס הזמנת אספקה למחלקה</div>
          <div class="info"><strong>מחלקה:</strong> ${orderToPrint.departmentName} | <strong>מספר הזמנה:</strong> ${orderToPrint.orderNumber}</div>
          <div class="info"><strong>תאריך ושעה:</strong> ${dateStr} ${orderToPrint.notes ? `| <strong>הערות:</strong> ${orderToPrint.notes}` : ''}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>שם הפריט</th>
              <th style="width: 80px; text-align: center;">כמות</th>
              <th style="width: 90px; text-align: center;">יחידת אריזה</th>
            </tr>
          </thead>
          <tbody>
            ${orderToPrint.items
              .map(
                (item: any, idx: number) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${item.name}</strong></td>
                <td style="text-align: center; font-size: 15px; font-weight: bold;">${item.orderedQty}</td>
                <td style="text-align: center;">${item.orderedUnit || "יח'"}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <div class="footer">הופק באמצעות מערכת StorePrint • לבירורים מול המחסן יש למסור מספר הזמנה</div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Department's own past submissions
  const myDeptOrders = useMemo(() => {
    return getTenantOrders(selectedTenantId).filter(
      (o) => o.departmentName === selectedDepartmentName
    );
  }, [selectedTenantId, selectedDepartmentName, orderSuccessNumber]);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 text-sm selection:bg-indigo-500 selection:text-white"
      dir="rtl"
    >
      {/* Top App Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-4 py-2.5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Department Selector Pill */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setIsDeptModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-800 text-slate-100 rounded-xl border border-slate-700 transition-all cursor-pointer min-w-0 text-right"
              title="לחץ להחלפת מחלקה"
            >
              <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 leading-none">מחלקה מזמינה:</div>
                <div className="font-black text-xs sm:text-sm text-white truncate flex items-center gap-1">
                  <span>{selectedDepartmentName}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </div>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {myDeptOrders.length > 0 && (
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer relative"
                title="היסטוריית הזמנות המחלקה"
              >
                <Clock className="w-4 h-4 text-sky-400" />
                <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {myDeptOrders.length}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              title="התקנת האפליקציה למסך הבית"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Shopping Area */}
      <main className="max-w-2xl mx-auto p-3 sm:p-4 space-y-3">
        {/* Success Confirmation Card */}
        {orderSuccessNumber && lastSubmittedOrder && (
          <div className="bg-gradient-to-br from-emerald-950/90 to-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">ההזמנה נשלחה בהצלחה למחסן! 🎉</h3>
                  <p className="text-xs text-emerald-300 font-mono mt-0.5">
                    מספר הזמנה: <strong>{orderSuccessNumber}</strong> • מחלקת {lastSubmittedOrder.departmentName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setOrderSuccessNumber(null);
                  setLastSubmittedOrder(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handlePrintSlip(lastSubmittedOrder)}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>הדפס עותק הזמנה למחלקה</span>
              </button>
              <button
                onClick={() => {
                  setOrderSuccessNumber(null);
                  setLastSubmittedOrder(null);
                }}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                בצע הזמנה נוספת
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש פריט, ציוד רפואי, חבישה, כפפות..."
            className="w-full pr-10 pl-10 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-inner transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-3.5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills (Horizontal Scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: '🌟 הכל', count: inventoryItems.length },
            { id: 'gloves', label: '🧤 כפפות ומיגון', count: inventoryItems.filter((i) => i.category === 'gloves').length },
            { id: 'dressings', label: '🩹 חבישה וגאזות', count: inventoryItems.filter((i) => i.category === 'dressings').length },
            { id: 'hygiene', label: '🧼 ספיגה והיגיינה', count: inventoryItems.filter((i) => i.category === 'hygiene').length },
            { id: 'medical', label: '💉 עירוי ורפואי', count: inventoryItems.filter((i) => i.category === 'medical').length },
            { id: 'in_stock', label: '⚡ במלאי זמין', count: inventoryItems.filter((i) => i.currentStock > 0).length },
            { id: 'in_cart', label: `🛒 בסל (${totalCartCount})`, count: cartItemsList.length },
          ].map((cat) => {
            const isSelected = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                {cat.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Product Cards List */}
        <div className="space-y-2.5 pt-1">
          {filteredProducts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-white">לא נמצאו פריטים מתאימים</h4>
                <p className="text-xs text-slate-400 mt-1">
                  נסה לשנות את מילת החיפוש או לבחור קטגוריה אחרת
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                הצג את כל הפריטים
              </button>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const inCartQty = cart[product.id]?.orderedQty || 0;
              const isSelected = inCartQty > 0;
              const isOutOfStock = product.currentStock <= 0;
              const isLowStock = product.currentStock > 0 && product.currentStock <= product.minThreshold;

              return (
                <div
                  key={product.id}
                  className={`bg-slate-900 rounded-2xl p-3.5 border transition-all ${
                    isSelected
                      ? 'border-indigo-500/80 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                      : 'border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Product Info */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-white leading-snug">
                          {product.name}
                        </span>
                        {product.limitByPatients && (
                          <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                            מוגבל לפי מטופלים
                          </span>
                        )}
                      </div>

                      {/* Badges: Stock Availability & Packaging Unit */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Live Stock Badge */}
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-900/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            אזל זמנית מהמלאי
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            נותרו במלאי: {product.currentStock} {product.unit}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-900/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            במלאי: {product.currentStock} {product.unit}
                          </span>
                        )}

                        <span className="text-slate-400 text-[11px]">
                          אריזה: <strong className="text-slate-300">{product.unit}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Quantity Selector (E-commerce Style) */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      {!isSelected ? (
                        <button
                          onClick={() => handleUpdateQty(product, product.unit, 1)}
                          className="px-3.5 py-2 bg-indigo-600/90 hover:bg-indigo-600 active:scale-95 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>הוסף</span>
                        </button>
                      ) : (
                        <div className="space-y-1">
                          {/* Stepper Pill */}
                          <div className="flex items-center bg-slate-950 border border-indigo-500/60 rounded-xl p-0.5 shadow-inner">
                            <button
                              onClick={() => handleUpdateQty(product, product.unit, -1)}
                              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="הפחת 1"
                            >
                              {inCartQty === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-400" /> : <Minus className="w-3.5 h-3.5" />}
                            </button>

                            <input
                              type="number"
                              min="0"
                              value={inCartQty}
                              onChange={(e) => handleSetQty(product, product.unit, parseInt(e.target.value, 10) || 0)}
                              className="w-12 text-center bg-transparent text-sm font-black text-white focus:outline-none"
                            />

                            <button
                              onClick={() => handleUpdateQty(product, product.unit, 1)}
                              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="הוסף 1"
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                          </div>

                          {/* Quick Increment Chips */}
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleUpdateQty(product, product.unit, 5)}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded border border-slate-700 cursor-pointer"
                              title="הוסף 5"
                            >
                              +5
                            </button>
                            <button
                              onClick={() => handleUpdateQty(product, product.unit, 10)}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded border border-slate-700 cursor-pointer"
                              title="הוסף 10"
                            >
                              +10
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Bottom Sticky Cart Bar */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-3 inset-x-0 z-30 px-3 max-w-2xl mx-auto animate-in slide-in-from-bottom-5 duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-2xl shadow-2xl flex items-center justify-between font-black text-sm cursor-pointer transition-all active:scale-[0.99] border border-white/20"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-white/20 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-sm font-black">{cartItemsList.length} פריטים בסל ({totalCartCount} יח')</div>
                <div className="text-[11px] text-emerald-100 font-normal">מחלקה: {selectedDepartmentName}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-xl text-xs font-black">
              <span>המשך להזמנה</span>
              <ChevronRight className="w-4 h-4 rotate-180" />
            </div>
          </button>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className={`fixed left-4 z-20 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-xl border border-slate-700 cursor-pointer transition-all ${
            totalCartCount > 0 ? 'bottom-20' : 'bottom-6'
          }`}
          title="חזרה לראש העמוד"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* Slide-Up Bottom Cart Drawer / Checkout Sheet */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 p-0 sm:p-4"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">סל הזמנה למחלקה</h3>
                  <p className="text-xs text-slate-400">
                    {selectedDepartmentName} • {cartItemsList.length} פריטים ({totalCartCount} יח')
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Form */}
            <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>רשימת הפריטים שנבחרו:</span>
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    רוקן סל
                  </button>
                </div>

                {cartItemsList.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    הסל ריק כרגע. סגור את החלון והוסף פריטים מהקטלוג.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {cartItemsList.map((item) => {
                      const product = inventoryItems.find((p) => p.name === item.name) || {
                        id: item.productId,
                        name: item.name,
                        unit: item.orderedUnit || "יח'",
                        currentStock: 99,
                        minThreshold: 10,
                      };

                      return (
                        <div
                          key={item.productId}
                          className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-white truncate">{item.name}</div>
                            <div className="text-[10px] text-slate-400">אריזה: {item.orderedUnit || "יח'"}</div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(product, item.orderedUnit as PackagingUnit, -1)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-black text-xs text-white w-7 text-center">
                              {item.orderedQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(product, item.orderedUnit as PackagingUnit, 1)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-emerald-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetQty(product, item.orderedUnit as PackagingUnit, 0)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer mr-1"
                              title="הסר פריט"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order Info Fields */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    שם המזמין/ה (איש קשר במחלקה) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="שם מלא / תפקיד"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {cartItemsList.some((it) => {
                  const p = inventoryItems.find((prod) => prod.name === it.name);
                  return p?.limitByPatients;
                }) && (
                  <div>
                    <label className="text-xs font-bold text-amber-300 block mb-1">
                      מספר מטופלים במחלקה כעת (נדרש לפריטים מוגבלים) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="לדוגמה: 36"
                      value={patientsCount}
                      onChange={(e) => setPatientsCount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-amber-600/40 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    הערות מיוחדות למחסן (אופציונלי)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="לדוגמה: דחוף למשמרת בוקר, להניח בחדר אחיות..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || cartItemsList.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>שולח הזמנה למחסן...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>שלח הזמנה למחסן ({totalCartCount} פריטים) 🚀</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Department Picker Modal */}
      {isDeptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">בחירת מחלקה מזמינה</h3>
              </div>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3">
              <input
                type="text"
                placeholder="חפש מחלקה..."
                value={deptSearchTerm}
                onChange={(e) => setDeptSearchTerm(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {departmentsList
                .filter((d) => !deptSearchTerm || d.toLowerCase().includes(deptSearchTerm.toLowerCase()))
                .map((dept) => {
                  const isSelected = dept === selectedDepartmentName;
                  return (
                    <button
                      key={dept}
                      onClick={() => {
                        setSelectedDepartmentName(dept);
                        setIsDeptModalOpen(false);
                      }}
                      className={`w-full p-3 rounded-xl text-right font-bold text-xs sm:text-sm flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800/80'
                      }`}
                    >
                      <span>{dept}</span>
                      {isSelected && <Check className="w-4 h-4" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Department History Modal */}
      {isHistoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-base font-black text-white">הזמנות קודמות של מחלקת {selectedDepartmentName}</h3>
                  <p className="text-xs text-slate-400">{myDeptOrders.length} הזמנות שנשלחו למחסן</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              {myDeptOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  לא נמצאו הזמנות קודמות עבור מחלקה זו.
                </div>
              ) : (
                myDeptOrders.map((order) => {
                  const dateStr = new Date(order.createdAt).toLocaleString('he-IL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={order.id}
                      className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-xs text-indigo-400">
                            {order.orderNumber}
                          </div>
                          <div className="text-[11px] text-slate-400">{dateStr}</div>
                        </div>

                        <div>
                          {order.printed ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              הודפס וסופק ✓
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              ממתין להדפסה ⏱
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {order.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg text-slate-300"
                          >
                            <strong>{it.orderedQty}</strong> {it.name}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1 border-t border-slate-900">
                        <button
                          onClick={() => handlePrintSlip(order)}
                          className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>הדפס שובר</span>
                        </button>
                        <button
                          onClick={() => handleReorder(order)}
                          className="flex-1 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>הזמן שוב 🔁</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        tenantName={activeTenant?.name}
      />
    </div>
  );
}
