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
import { pushOrderToFirestore, subscribeToFirestoreStock } from '../../services/firestoreSync';
import { isFirebaseReady, db } from '../../services/firebase';
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
  Sun,
  Moon,
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

const QUICK_NOTE_CHIPS = [
  '⚡ דחוף להיום',
  '☀️ משמרת בוקר',
  '🌙 משמרת לילה',
  '📦 להניח בחדר אחיות',
  '🔄 השלמת ציוד חסר',
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

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('storeprint_portal_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('storeprint_portal_theme', next);
    }
  };

  const isLight = theme === 'light';

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

  const handleForceUpdate = () => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
        if ('caches' in window) {
          caches.keys().then((keys) => {
            Promise.all(keys.map((k) => caches.delete(k))).then(() => {
              (window as any).location.reload();
            });
          });
        } else {
          (window as any).location.reload();
        }
      });
    } else {
      window.location.reload();
    }
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
    setIsHistoryModalOpen(false);
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
        patientsCount: patientsCount.trim() || '',
        status: 'NEW',
        source: 'WEB_PORTAL',
        printed: false,
      });

      // Pure Database saving: pushes to Firestore and saves in local tenant DB
      const firestoreSuccess = await pushOrderToFirestore(newOrder, selectedTenantId);
      if (!firestoreSuccess) {
        console.warn('Firestore push returned false, order stored in local tenant DB');
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
      className={`min-h-screen ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      } font-sans pb-36 text-sm selection:bg-indigo-500 selection:text-white transition-colors duration-200`}
      dir="rtl"
    >
      {/* Top App Header */}
      <header
        className={`${
          isLight ? 'bg-white/95 border-slate-200/90 shadow-xs' : 'bg-slate-900/95 border-slate-800 shadow-md'
        } backdrop-blur-md border-b sticky top-0 z-30 px-3 sm:px-4 py-2.5 transition-colors duration-200`}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Department Selector Pill & Cloud Status */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setIsDeptModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300'
                  : 'bg-slate-800/90 hover:bg-slate-800 text-slate-100 border-slate-700'
              } rounded-xl border transition-all cursor-pointer min-w-0 text-right shadow-xs`}
              title="לחץ להחלפת מחלקה"
            >
              <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'} leading-none`}>
                  מחלקה מזמינה:
                </div>
                <div
                  className={`font-black text-xs sm:text-sm ${
                    isLight ? 'text-slate-900' : 'text-white'
                  } truncate flex items-center gap-1`}
                >
                  <span>{selectedDepartmentName}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </div>
            </button>

            <div
              className={`hidden xs:flex items-center gap-1.5 px-2.5 py-1 ${
                isLight
                  ? 'bg-emerald-50 border-emerald-300/80 text-emerald-800'
                  : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
              } border rounded-xl text-[11px] font-bold`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>ענן מחובר</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-indigo-600 border-slate-300 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
              title={isLight ? 'מעבר למצב כהה (Dark Mode)' : 'מעבר למצב בהיר קליני (Light Mode)'}
            >
              {isLight ? <Moon className="w-4 h-4 text-indigo-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {myDeptOrders.length > 0 && (
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer relative ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="היסטוריית הזמנות המחלקה"
              >
                <Clock className="w-4 h-4 text-sky-500" />
                <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {myDeptOrders.length}
                </span>
              </button>
            )}

            <button
              onClick={handleForceUpdate}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="רענן ומשוך גרסה עדכנית מהענן"
            >
              <RotateCcw className="w-4 h-4 text-emerald-500" />
            </button>

            <button
              onClick={() => setIsInstallModalOpen(true)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="התקנת האפליקציה למסך הבית"
            >
              <Smartphone className="w-4 h-4 text-sky-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Sticky Search & Category Sub-Header */}
      <div
        className={`sticky top-[53px] z-20 ${
          isLight ? 'bg-slate-100/95 border-slate-200' : 'bg-slate-950/95 border-slate-800'
        } backdrop-blur-md border-b px-3 sm:px-4 py-2.5 shadow-sm transition-colors duration-200`}
      >
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש פריט, ציוד רפואי, חבישה, כפפות..."
              className={`w-full pr-10 pl-10 py-2.5 rounded-xl text-sm font-medium ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-xs'
                  : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-inner'
              } border focus:outline-none transition-all`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute left-3.5 top-2.5 p-1 rounded-full cursor-pointer ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="נקה חיפוש"
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
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : isLight
                        ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-indigo-800/80 text-white'
                          : isLight
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Shopping Area */}
      <main className="max-w-2xl mx-auto p-3 sm:p-4 space-y-3">
        {/* Success Confirmation Card */}
        {orderSuccessNumber && lastSubmittedOrder && (
          <div
            className={`${
              isLight
                ? 'bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-500 shadow-xl'
                : 'bg-gradient-to-br from-emerald-950/90 to-slate-900 border-2 border-emerald-500/60 shadow-2xl'
            } rounded-3xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 ${
                    isLight
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  } rounded-2xl border`}
                >
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className={`text-lg font-black ${isLight ? 'text-emerald-950' : 'text-white'}`}>
                    ההזמנה נשלחה בהצלחה למחסן! 🎉
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-emerald-800' : 'text-emerald-300'} font-mono mt-0.5`}>
                    מספר הזמנה: <strong>{orderSuccessNumber}</strong> • מחלקת {lastSubmittedOrder.departmentName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setOrderSuccessNumber(null);
                  setLastSubmittedOrder(null);
                }}
                className={`p-1.5 rounded-lg cursor-pointer ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
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
                className={`py-2.5 px-4 rounded-xl font-bold text-xs cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                בצע הזמנה נוספת
              </button>
            </div>
          </div>
        )}

        {/* Results Counter if searching or filtering */}
        {(searchQuery || categoryFilter !== 'all') && (
          <div className="flex items-center justify-between text-xs px-1">
            <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              נמצאו {filteredProducts.length} פריטים
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
              }}
              className="text-indigo-600 hover:underline cursor-pointer font-bold"
            >
              איפוס סינון
            </button>
          </div>
        )}

        {/* Product Cards List */}
        <div className="space-y-3 pt-0.5">
          {filteredProducts.length === 0 ? (
            <div
              className={`${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
              } border rounded-3xl p-8 text-center space-y-3 shadow-xs`}
            >
              <Package className={`w-12 h-12 ${isLight ? 'text-slate-400' : 'text-slate-600'} mx-auto`} />
              <div>
                <h4 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  לא נמצאו פריטים מתאימים
                </h4>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'} mt-1`}>
                  נסה לשנות את מילת החיפוש או לבחור קטגוריה אחרת
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
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
                  className={`rounded-2xl p-3.5 sm:p-4 border transition-all ${
                    isSelected
                      ? isLight
                        ? 'bg-indigo-50/70 border-indigo-400 shadow-md ring-1 ring-indigo-400/30'
                        : 'bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                      : isLight
                        ? 'bg-white border-slate-200/90 hover:border-slate-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Product Info */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Index number badge */}
                        <span
                          className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                            isLight
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          #{product.colIndex}
                        </span>

                        <span
                          className={`font-black text-base sm:text-lg leading-snug ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          {product.name}
                        </span>

                        {product.limitByPatients && (
                          <span className="text-[11px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            מוגבל לפי מטופלים
                          </span>
                        )}
                      </div>

                      {/* Badges: Stock Availability & Packaging Unit */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Live Stock Badge */}
                        {isOutOfStock ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                              isLight
                                ? 'text-rose-700 bg-rose-50 border-rose-200'
                                : 'text-rose-400 bg-rose-950/40 border-rose-900/40'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            אזל זמנית מהמלאי
                          </span>
                        ) : isLowStock ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                              isLight
                                ? 'text-amber-800 bg-amber-50 border-amber-300'
                                : 'text-amber-300 bg-amber-950/40 border-amber-800/40'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            נותרו במלאי: {product.currentStock} {product.unit}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                              isLight
                                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                : 'text-emerald-400 bg-emerald-950/40 border-emerald-900/40'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            במלאי: {product.currentStock} {product.unit}
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                            isLight
                              ? 'bg-slate-50 text-slate-700 border-slate-200'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700'
                          }`}
                        >
                          <span>אריזה:</span>
                          <strong className={isLight ? 'text-slate-900' : 'text-white'}>
                            {product.unit}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Quantity Selector - Large Touch Targets */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      {!isSelected ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(product, product.unit, 1)}
                          className="h-11 sm:h-12 px-5 sm:px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white rounded-xl text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>הוסף</span>
                        </button>
                      ) : (
                        <div className="space-y-1.5">
                          {/* Stepper Pill */}
                          <div
                            className={`flex items-center rounded-2xl p-1 shadow-sm border ${
                              isLight
                                ? 'bg-white border-indigo-300 shadow-sm'
                                : 'bg-slate-950 border-indigo-500/60 shadow-inner'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(product, product.unit, -1)}
                              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                inCartQty === 1
                                  ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
                                  : isLight
                                    ? 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                    : 'text-slate-300 hover:bg-slate-800 active:bg-slate-700'
                              }`}
                              title={inCartQty === 1 ? 'הסר מהסל' : 'הפחת 1'}
                            >
                              {inCartQty === 1 ? (
                                <Trash2 className="w-5 h-5 text-rose-500" />
                              ) : (
                                <Minus className="w-5 h-5 stroke-[2.5]" />
                              )}
                            </button>

                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min="0"
                              value={inCartQty}
                              onChange={(e) =>
                                handleSetQty(product, product.unit, parseInt(e.target.value, 10) || 0)
                              }
                              className={`w-14 sm:w-16 h-11 text-center bg-transparent text-lg sm:text-xl font-black focus:outline-none ${
                                isLight ? 'text-slate-900' : 'text-white'
                              }`}
                            />

                            <button
                              type="button"
                              onClick={() => handleUpdateQty(product, product.unit, 1)}
                              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer active:scale-95"
                              title="הוסף 1"
                            >
                              <Plus className="w-5 h-5 stroke-[3]" />
                            </button>
                          </div>

                          {/* Quick Increment Chips */}
                          <div className="flex items-center justify-end gap-1.5 pt-0.5">
                            {[1, 5, 10].map((inc) => (
                              <button
                                key={inc}
                                type="button"
                                onClick={() => handleUpdateQty(product, product.unit, inc)}
                                className={`h-7 px-2.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer active:scale-95 ${
                                  isLight
                                    ? 'bg-slate-50 hover:bg-indigo-50 text-indigo-700 border-slate-200 hover:border-indigo-300'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                }`}
                                title={`הוסף עוד ${inc} ${product.unit}`}
                              >
                                +{inc}
                              </button>
                            ))}
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
        <div className="fixed bottom-4 inset-x-0 z-30 px-3 max-w-2xl mx-auto animate-in slide-in-from-bottom-5 duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-2xl shadow-2xl flex items-center justify-between font-black text-sm sm:text-base cursor-pointer transition-all active:scale-[0.99] border border-white/20"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-sm sm:text-base font-black">
                  {cartItemsList.length} פריטים בסל ({totalCartCount} יח')
                </div>
                <div className="text-xs text-emerald-100 font-medium">
                  מחלקת {selectedDepartmentName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-colors">
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
          className={`fixed left-4 z-20 p-3 ${
            isLight
              ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
              : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
          } rounded-full shadow-xl border cursor-pointer transition-all ${
            totalCartCount > 0 ? 'bottom-24' : 'bottom-6'
          }`}
          title="חזרה לראש העמוד"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* Slide-Up Bottom Cart Drawer / Checkout Sheet */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 p-0 sm:p-4"
          dir="rtl"
        >
          <div
            className={`${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            } border rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200`}
          >
            {/* Drawer Header */}
            <div
              className={`p-4 border-b ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              } flex items-center justify-between shrink-0`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/10 text-indigo-600 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    סל הזמנה למחלקה
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {selectedDepartmentName} • {cartItemsList.length} פריטים ({totalCartCount} יח')
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className={`p-1.5 rounded-lg cursor-pointer ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Form */}
            <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Items List */}
              <div className="space-y-2">
                <div
                  className={`flex items-center justify-between text-xs ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  <span>רשימת הפריטים שנבחרו:</span>
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-rose-500 hover:underline cursor-pointer font-bold"
                  >
                    רוקן סל
                  </button>
                </div>

                {cartItemsList.length === 0 ? (
                  <div
                    className={`text-center py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'} text-xs`}
                  >
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
                          className={`${
                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                          } p-3 rounded-xl border flex items-center justify-between gap-2`}
                        >
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-bold text-xs sm:text-sm truncate ${
                                isLight ? 'text-slate-900' : 'text-white'
                              }`}
                            >
                              {item.name}
                            </div>
                            <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              אריזה: {item.orderedUnit || "יח'"}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(product, item.orderedUnit as PackagingUnit, -1)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${
                                isLight
                                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span
                              className={`font-black text-sm w-8 text-center ${
                                isLight ? 'text-slate-900' : 'text-white'
                              }`}
                            >
                              {item.orderedQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(product, item.orderedUnit as PackagingUnit, 1)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetQty(product, item.orderedUnit as PackagingUnit, 0)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer mr-1"
                              title="הסר פריט"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order Info Fields */}
              <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <div>
                  <label
                    className={`text-xs font-bold block mb-1.5 ${
                      isLight ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    שם המזמין/ה (איש קשר במחלקה) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="שם מלא / תפקיד"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600'
                        : 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                {cartItemsList.some((it) => {
                  const p = inventoryItems.find((prod) => prod.name === it.name);
                  return p?.limitByPatients;
                }) && (
                  <div>
                    <label
                      className={`text-xs font-bold block mb-1.5 ${
                        isLight ? 'text-amber-800' : 'text-amber-300'
                      }`}
                    >
                      מספר מטופלים במחלקה כעת (נדרש לפריטים מוגבלים) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="לדוגמה: 36"
                      value={patientsCount}
                      onChange={(e) => setPatientsCount(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                        isLight
                          ? 'bg-amber-50/50 border-amber-300 text-amber-950 placeholder-amber-400 focus:border-amber-600'
                          : 'bg-slate-950 border-amber-600/40 text-white placeholder-slate-500 focus:border-amber-500'
                      }`}
                    />
                  </div>
                )}

                <div>
                  <label
                    className={`text-xs font-bold block mb-1.5 ${
                      isLight ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    הערות מיוחדות למחסן (אופציונלי)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="לדוגמה: דחוף למשמרת בוקר, להניח בחדר אחיות..."
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600'
                        : 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                    }`}
                  />

                  {/* Quick Preset Note Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                    <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      הוספה מהירה:
                    </span>
                    {QUICK_NOTE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setNotes((prev) => {
                            const trimmed = prev.trim();
                            if (!trimmed) return chip;
                            if (trimmed.includes(chip)) return trimmed;
                            return `${trimmed}, ${chip}`;
                          });
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || cartItemsList.length === 0}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <span>שולח הזמנה למחסן...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>שלח הזמנה למחסן ({totalCartCount} יח') 🚀</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className={`${
              isLight ? 'bg-white border-slate-200 text-slate-900 shadow-2xl' : 'bg-slate-900 border-slate-800 text-white shadow-2xl'
            } border rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col p-5 animate-in zoom-in-95 duration-150`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>בחירת מחלקה מזמינה</h3>
              </div>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className={`p-1 rounded-lg cursor-pointer ${
                  isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
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
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600'
                    : 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500'
                }`}
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
                          : isLight
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className={`${
              isLight ? 'bg-white border-slate-200 text-slate-900 shadow-2xl' : 'bg-slate-900 border-slate-800 text-white shadow-2xl'
            } border rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col p-5 animate-in zoom-in-95 duration-150`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-500" />
                <div>
                  <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    הזמנות קודמות של מחלקת {selectedDepartmentName}
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {myDeptOrders.length} הזמנות שנשלחו למחסן
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className={`p-1 rounded-lg cursor-pointer ${
                  isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              {myDeptOrders.length === 0 ? (
                <div className={`text-center py-10 ${isLight ? 'text-slate-400' : 'text-slate-500'} text-xs`}>
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
                      className={`${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                      } p-3.5 rounded-2xl border space-y-2.5`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                            {order.orderNumber}
                          </div>
                          <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{dateStr}</div>
                        </div>

                        <div>
                          {order.printed ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              הודפס וסופק ✓
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
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
                            className={`text-[11px] px-2 py-0.5 rounded-lg border ${
                              isLight
                                ? 'bg-white border-slate-200 text-slate-800'
                                : 'bg-slate-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            <strong>{it.orderedQty}</strong> {it.name}
                          </span>
                        ))}
                      </div>

                      <div className={`flex gap-2 pt-1 border-t ${isLight ? 'border-slate-200' : 'border-slate-900'}`}>
                        <button
                          onClick={() => handlePrintSlip(order)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                            isLight
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>הדפס שובר</span>
                        </button>
                        <button
                          onClick={() => handleReorder(order)}
                          className="flex-1 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
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
