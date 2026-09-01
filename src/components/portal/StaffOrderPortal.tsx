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
} from 'lucide-react';

interface StaffOrderPortalProps {
  initialTenantId?: string;
  initialDepartment?: string;
  onBackToMain?: () => void;
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

export function StaffOrderPortal({ initialTenantId, initialDepartment, onBackToMain }: StaffOrderPortalProps) {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const tenants = getTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    initialTenantId || (tenants.length > 0 ? tenants[0].id : 'tenant-main-01')
  );

  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const warehouses = getWarehouses(selectedTenantId);
  const activeWarehouse = warehouses[0] || null;

  // Departments List (from Unified DB, MultiTenant DB, or Defaults)
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

  const [patientsCount, setPatientsCount] = useState<string>('');
  const [requesterName, setRequesterName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('storeprint_portal_requester_name') || '';
    }
    return '';
  });
  const [activeTab, setActiveTab] = useState<'catalog' | 'my_orders'>('catalog');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'gloves' | 'dressings' | 'hygiene' | 'medical' | 'in_cart'>('all');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');

  // Cart State: Map of productId -> MultiTenantOrderItem
  const [cart, setCart] = useState<Record<string, MultiTenantOrderItem>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccessNumber, setOrderSuccessNumber] = useState<string | null>(null);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveStock, setLiveStock] = useState<Record<string, StockItem>>(() => getDbStock());

  // Save selected department to local storage for convenience
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Available Products: Complete Master Catalog from Warehouse Stock (excluding inactive items)
  const inventoryItems = useMemo(() => {
    const stockItems = (Object.values(liveStock || {}) || []) as StockItem[];

    if (stockItems.length > 0) {
      return stockItems
        .filter((item) => item.isActive !== false)
        .sort((a, b) => (a.colIndex || 0) - (b.colIndex || 0))
        .map((item, idx) => ({
          id: item.id || item.name,
          warehouseId: activeWarehouse?.id || 'wh-default',
          name: item.name,
          unit: (item.unit as PackagingUnit) || "יח'",
          currentStock: typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0,
          minThreshold: item.minThreshold || 10,
          colIndex: item.colIndex || idx + 1,
          isActive: item.isActive !== false,
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
      // 1. Submit directly to Google Sheets Cloud (if configured)
      const cloudConfig = loadCloudConfig();
      if (cloudConfig.enabled && cloudConfig.endpointUrl) {
        const orderItemsMap: Record<string, { qty: number; unit?: string }> = {};
        cartItemsList.forEach((it) => {
          orderItemsMap[it.name] = { qty: it.orderedQty, unit: it.orderedUnit };
        });

        const formattedNotes = [
          requesterName.trim() ? `שם מזמין/ה: ${requesterName.trim()}` : '',
          notes.trim() ? notes.trim() : '',
        ]
          .filter(Boolean)
          .join(' | ');

        await submitDepartmentOrderToCloud(
          {
            department: selectedDepartmentName.trim(),
            orderedBy: requesterName.trim() || undefined,
            patientsCount: patientsCount.trim() || undefined,
            notes: formattedNotes || undefined,
            items: orderItemsMap,
          },
          cloudConfig
        );
      }

      // 2. Save local order & push to Firestore Real-Time DB
      const newOrder = createTenantOrder(selectedTenantId, {
        tenantId: selectedTenantId,
        warehouseId: activeWarehouse?.id || 'wh-default',
        departmentId: `dept-${Date.now()}`,
        departmentName: selectedDepartmentName.trim(),
        items: cartItemsList,
        totalItemsCount: cartItemsList.length,
        notes: [requesterName.trim() ? `שם מזמין/ה: ${requesterName.trim()}` : '', notes.trim()]
          .filter(Boolean)
          .join(' | '),
        status: 'NEW',
        source: 'WEB_PORTAL',
        printed: false,
      });

      pushOrderToFirestore(newOrder, selectedTenantId).catch(console.warn);

      setLastSubmittedOrder(newOrder);
      setOrderSuccessNumber(newOrder.orderNumber);
      setCart({});
      setNotes('');
      setIsCartOpen(false);
      window.dispatchEvent(new Event('storeprint_order_created'));
    } catch (err: any) {
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

  const [refreshPastOrdersKey, setRefreshPastOrdersKey] = useState<number>(0);

  const pastOrders = useMemo(() => {
    return getTenantOrders(selectedTenantId).filter(
      (o) => !selectedDepartmentName || o.departmentName === selectedDepartmentName
    );
  }, [selectedTenantId, selectedDepartmentName, orderSuccessNumber, refreshPastOrdersKey]);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 text-sm selection:bg-indigo-500 selection:text-white"
      dir="rtl"
    >
      {/* Top Fixed Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-4 py-2.5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBackToMain && (
              <button
                onClick={onBackToMain}
                className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer shrink-0"
                title="חזרה למסך ניהול המחסן"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm sm:text-base text-white truncate">
                  פורטל הזמנות מחלקות 📋
                </span>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 shrink-0">
                  {inventoryItems.length} פריטים
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                מחלקה: <strong className="text-indigo-300">{selectedDepartmentName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md transition-all cursor-pointer"
              title="התקנת האפליקציה למסך הבית"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">התקן</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative px-3 py-1.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs ${
                totalCartCount > 0
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>סל ({totalCartCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3.5">
        {/* Success Confirmation Modal / Screen */}
        {orderSuccessNumber && lastSubmittedOrder && (
          <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
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

            <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-slate-300 flex items-center justify-between">
                <span>סיכום פריטים שהוזמנו ({lastSubmittedOrder.items.length}):</span>
                <span className="text-slate-400 font-normal">
                  {new Date(lastSubmittedOrder.createdAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
                {lastSubmittedOrder.items.map((it: any, idx: number) => (
                  <div key={idx} className="pt-1 flex items-center justify-between text-slate-200">
                    <span>{it.name}</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {it.orderedQty} {it.orderedUnit || "יח'"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handlePrintSlip(lastSubmittedOrder)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span>הדפס עותק הזמנה למחלקה</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderSuccessNumber(null);
                  setLastSubmittedOrder(null);
                  setActiveTab('catalog');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ביצוע הזמנה נוספת</span>
              </button>
            </div>
          </div>
        )}

        {/* Department & Requester Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-400" />
              פרטי המחלקה והמזמין/ה
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              סך הכל {inventoryItems.length} פריטים זמינים
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* Department Dropdown */}
            <div className="sm:col-span-5">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                מחלקה מזמינה *
              </label>
              <select
                value={selectedDepartmentName}
                onChange={(e) => setSelectedDepartmentName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
              >
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="custom">+ הקלד מחלקה אחרת...</option>
              </select>
            </div>

            {/* Requester Name */}
            <div className="sm:col-span-4">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                שם המזמין/ה (איש קשר) *
              </label>
              <input
                type="text"
                placeholder="לדוגמה: אילנה / מנהל תורן"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Patients Count */}
            <div className="sm:col-span-3">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                מס' מטופלים במחלקה
              </label>
              <input
                type="number"
                min="0"
                placeholder="מס' מאושפזים"
                value={patientsCount}
                onChange={(e) => setPatientsCount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-center"
              />
            </div>
          </div>

          {selectedDepartmentName === 'custom' && (
            <input
              type="text"
              placeholder="הקלד את שם המחלקה החדשה"
              onChange={(e) => setSelectedDepartmentName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 mt-1"
            />
          )}
        </div>

        {/* Navigation Tabs (Catalog vs Past Orders) */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>קטלוג פריטים להזמנה ({inventoryItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('my_orders')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'my_orders'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>ההזמנות שלי ({pastOrders.length})</span>
          </button>
        </div>

        {activeTab === 'catalog' && (
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="חיפוש מהיר של פריט לפי שם, מק״ט או יחידה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-9 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                  title="נקה חיפוש"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  categoryFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                🌟 הכל ({inventoryItems.length})
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('gloves')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  categoryFilter === 'gloves'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                🧤 כפפות ומיגון
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('dressings')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  categoryFilter === 'dressings'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                🩹 חבישה וגאזות
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('hygiene')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  categoryFilter === 'hygiene'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                🧼 ספיגה והיגיינה
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('medical')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  categoryFilter === 'medical'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                💉 עירוי ורפואי
              </button>

              {cartItemsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('in_cart')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    categoryFilter === 'in_cart'
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'bg-pink-950/40 text-pink-300 border border-pink-700/50 hover:bg-pink-900/40'
                  }`}
                >
                  🛒 בסל ההזמנה ({cartItemsList.length})
                </button>
              )}
            </div>

            {/* Products List */}
            {filteredProducts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
                <Package className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="font-bold text-white text-base">לא נמצאו פריטים תואמים</h4>
                <p className="text-xs text-slate-400">
                  נסה לשנות את מילת החיפוש או לבחור קטגוריה אחרת.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredProducts.map((prod, idx) => {
                  const inCart = cart[prod.id];
                  const qty = inCart ? inCart.orderedQty : 0;
                  const unit = inCart?.orderedUnit || prod.unit || "יח'";

                  return (
                    <div
                      key={prod.id}
                      className={`bg-slate-900 border rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md transition-all ${
                        qty > 0
                          ? 'border-indigo-500/90 ring-2 ring-indigo-500/20 bg-slate-900/95'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded-md border border-slate-800">
                            #{prod.colIndex || idx + 1}
                          </span>
                          <h4 className="font-black text-sm sm:text-base text-white leading-snug">
                            {prod.name}
                          </h4>
                          {prod.limitByPatients && (
                            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-600/50 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              מוגבל למטופלים
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>
                            יתרה במחסן:{' '}
                            <strong className={prod.currentStock > 0 ? 'text-slate-200' : 'text-rose-400'}>
                              {prod.currentStock} {prod.unit || "יח'"}
                            </strong>
                          </span>
                          {qty > 0 && (
                            <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                              ✓ בסל: {qty} {unit}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity & Unit Controls */}
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        {/* Packaging Unit Selector */}
                        <select
                          value={unit}
                          onChange={(e) => handleUnitChange(prod, e.target.value as PackagingUnit)}
                          className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          {STANDARD_PACKAGING_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.labelHe}
                            </option>
                          ))}
                        </select>

                        {/* Quick Batch Increment / Decrement Controls */}
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-700">
                          {/* -5 */}
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod, unit, -5)}
                            disabled={qty === 0}
                            className="w-7 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-bold disabled:opacity-20 cursor-pointer transition-colors"
                            title="הפחת 5"
                          >
                            -5
                          </button>

                          {/* -1 */}
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod, unit, -1)}
                            disabled={qty === 0}
                            className="w-8 h-8 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-20 cursor-pointer transition-colors"
                            title="הפחת 1"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          {/* Numeric Qty Input */}
                          <input
                            type="number"
                            min="0"
                            value={qty === 0 ? '' : qty}
                            placeholder="0"
                            onChange={(e) =>
                              handleSetQty(prod, unit, parseInt(e.target.value, 10) || 0)
                            }
                            className={`w-12 h-8 text-center font-black text-sm font-mono rounded-lg border focus:outline-none focus:ring-1 ${
                              qty > 0
                                ? 'bg-indigo-950/60 border-indigo-500 text-white focus:ring-indigo-400'
                                : 'bg-slate-900 border-slate-700 text-slate-400 focus:ring-slate-500'
                            }`}
                          />

                          {/* +1 */}
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod, unit, 1)}
                            className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                            title="הוסף 1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {/* +5 */}
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod, unit, 5)}
                            className="w-7 h-8 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 text-[10px] font-black cursor-pointer transition-colors"
                            title="הוסף 5"
                          >
                            +5
                          </button>

                          {/* +10 */}
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod, unit, 10)}
                            className="w-7 h-8 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 text-[10px] font-black cursor-pointer transition-colors"
                            title="הוסף 10"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Past Orders Tab */}
        {activeTab === 'my_orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-bold text-white text-sm">
                היסטוריית הזמנות עבור מחלקת {selectedDepartmentName} ({pastOrders.length})
              </h4>
            </div>

            {pastOrders.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
                <ClipboardList className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="font-bold text-white text-base">טרם בוצעו הזמנות עבור מחלקה זו</h4>
                <p className="text-xs text-slate-400">
                  כל הזמנה שתישלח תופיע כאן עם סטטוס מעקב בזמן אמת.
                </p>
              </div>
            ) : (
              pastOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-white text-sm">{ord.orderNumber}</strong>
                        {ord.printed ? (
                          <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            הודפס וסופק מהמחסן ✓
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            ממתין להדפסה וליקוט ⏱
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        תאריך: {new Date(ord.createdAt).toLocaleString('he-IL')}
                        {ord.notes && <span className="mr-2">({ord.notes})</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePrintSlip(ord)}
                        className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                        title="הדפסת שובר"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReorder(ord)}
                        className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 border border-indigo-500/40"
                        title="שכפול פריטים לסל ההזמנה"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>הזמן שוב</span>
                      </button>
                    </div>
                  </div>

                  {/* Items List in Past Order */}
                  <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 divide-y divide-slate-800/60 space-y-1">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="pt-1 first:pt-0 flex justify-between items-center">
                        <span>{it.name}</span>
                        <span className="font-mono font-bold text-indigo-300">
                          {it.orderedQty} {it.orderedUnit || "יח'"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Floating Scroll-To-Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 left-4 z-40 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-2xl border border-slate-700 transition-all cursor-pointer"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Sticky Bottom Cart Bar */}
      {cartItemsList.length > 0 && !isCartOpen && (
        <div className="fixed bottom-3 left-3 right-3 max-w-3xl mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-2xl font-black text-sm shadow-2xl flex items-center justify-between border-2 border-indigo-400/40 cursor-pointer transition-all transform hover:-translate-y-0.5 active:scale-98"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>
                סל הזמנה: <strong>{cartItemsList.length} פריטים</strong> ({totalCartCount} יחידות)
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs bg-white/20 px-3 py-1 rounded-xl">
              <span>לסיום ושליחה למחסן</span>
              <ChevronRight className="w-4 h-4 rotate-180" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">סיכום סל הזמנה למחסן</h3>
                  <p className="text-xs text-slate-400">
                    מחלקה: <strong className="text-indigo-300">{selectedDepartmentName}</strong> • {cartItemsList.length} פריטים
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

            {/* Modal Body */}
            <form onSubmit={handleSubmitOrder} className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Selected Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                  <span>פריטים שנבחרו:</span>
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>רוקן סל</span>
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {cartItemsList.map((item) => {
                    const prod = inventoryItems.find((p) => p.name === item.name || p.id === item.productId);
                    return (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-xs sm:text-sm text-white truncate">
                            {item.name}
                          </h5>
                          <span className="text-[10px] text-slate-400 font-mono">
                            יחידה: {item.orderedUnit || "יח'"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => prod && handleUpdateQty(prod, item.orderedUnit as PackagingUnit, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-10 text-center font-black font-mono text-sm text-white">
                            {item.orderedQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => prod && handleUpdateQty(prod, item.orderedUnit as PackagingUnit, 1)}
                            className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Submission Fields */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    שם המזמין/ה *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="שם מלא / תפקיד במחלקה"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

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

      {/* PWA Install Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        tenantName={activeTenant?.name}
      />
    </div>
  );
}
