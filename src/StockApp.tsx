import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MobileStockManager } from './components/mobile/MobileStockManager';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { EmergencyConfirmModal } from './components/emergency/EmergencyConfirmModal';
import { LoginModal } from './components/auth/LoginModal';
import { Lock, ShieldCheck } from 'lucide-react';
import { StockItem } from './types';
import {
  getDbStock,
  saveDbStock,
  updateDbStockItem,
  saveOrUpdateDbStockItem,
  deleteDbStockItem,
  moveDbStockItem,
  insertDbStockItemAtPosition,
} from './services/unifiedDb';
import {
  updateStockItemInMap,
  upsertStockItemInMap,
  deleteStockItemFromMap,
  moveStockItemInMap,
} from './utils/stockManager';
import {
  subscribeToFirestoreStock,
  fetchStockFromFirestore,
  pushStockToFirestore,
} from './services/firestoreSync';
import {
  getPublicTenants,
  getWarehouses,
  getTenantStockMap,
  saveInventory,
  fetchTenantsFromFirestore,
  subscribeToTenantsFirestore,
  fetchInventoryFromFirestore,
  inventoryProductsToStockMap,
  stockMapToInventoryProducts,
  getActiveAuthSession,
} from './services/multiTenantDb';
import {
  getLocalStaffDirectory,
  subscribeToStaffDirectory,
} from './services/staffAccessService';
import { AuthSession, StaffDirectory, Tenant } from './types/multiTenant';

export default function StockApp() {
  const [tenants, setTenants] = useState<Tenant[]>(() => getPublicTenants());
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getActiveAuthSession());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Resolve active tenant from URL (?tenant=... or ?tenantId=...)
  const [activeTenantId] = useState<string>(() => {
    const initialTenants = getPublicTenants();
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tParam = urlParams.get('tenant') || urlParams.get('tenantId');
        if (tParam) {
          const match = initialTenants.find((t) => t.id === tParam || t.slug === tParam);
          if (match) return match.id;
          return tParam;
        }
      }
    } catch {}
    return initialTenants.length > 0 ? initialTenants[0].id : 'tenant-main-01';
  });

  const [staffDirectory, setStaffDirectory] = useState<StaffDirectory>(() =>
    getLocalStaffDirectory(activeTenantId)
  );

  useEffect(() => {
    fetchTenantsFromFirestore()
      .then((list) => {
        if (list && list.length > 0) setTenants(list.map((t) => ({ ...t, passwordHash: '' })));
      })
      .catch(console.warn);
    const unsub = subscribeToTenantsFirestore((list) => {
      if (list && list.length > 0) setTenants(list.map((t) => ({ ...t, passwordHash: '' })));
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToStaffDirectory(activeTenantId, setStaffDirectory);
    return () => {
      if (unsub) unsub();
    };
  }, [activeTenantId]);

  const activeTenant = useMemo(() => {
    return tenants.find((t) => t.id === activeTenantId) || tenants[0];
  }, [tenants, activeTenantId]);

  const isAuthorizedForTenant = useMemo(() => {
    if (!authSession) return false;
    if (authSession.userRole === 'superadmin') return true;
    return authSession.userRole === 'tenant_admin' && authSession.tenantId === activeTenantId;
  }, [authSession, activeTenantId]);

  const isWorkspaceLocked =
    Boolean(staffDirectory?.policy?.requireAdminLoginForWorkspace) && !isAuthorizedForTenant;

  const persistTenantInventory = useCallback((tId: string, stockMap: Record<string, StockItem>, syncCloud: boolean = true) => {
    if (tId === 'tenant-main-01') return;
    const whId = getWarehouses(tId)[0]?.id || 'wh-01';
    const items = stockMapToInventoryProducts(stockMap, tId, whId);
    saveInventory(tId, items, syncCloud);
  }, []);

  const [stock, setStock] = useState<Record<string, StockItem>>(() => {
    try {
      if (activeTenantId !== 'tenant-main-01') {
        const tenantMap = getTenantStockMap(activeTenantId);
        return tenantMap && Object.keys(tenantMap).length > 0 ? tenantMap : {};
      }
      return getDbStock();
    } catch {
      return {};
    }
  });

  const stockRef = useRef<Record<string, StockItem>>(stock);
  stockRef.current = stock;

  const emergencyKey =
    !activeTenantId || activeTenantId === 'tenant-main-01'
      ? 'storeprint_emergency_mode_v1'
      : `storeprint_emergency_mode_v1_${activeTenantId}`;

  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(emergencyKey) === 'true';
    } catch {
      return false;
    }
  });
  const [isEmergencyConfirmOpen, setIsEmergencyConfirmOpen] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Hydrate & subscribe to real-time Firestore updates for active tenant
  useEffect(() => {
    let cancelled = false;
    const applyRemoteStock = (remoteStock: Record<string, StockItem>) => {
      if (cancelled || !remoteStock || Object.keys(remoteStock).length === 0) return;
      stockRef.current = remoteStock;
      setStock(remoteStock);
      if (activeTenantId === 'tenant-main-01') {
        saveDbStock(remoteStock, false);
      } else {
        persistTenantInventory(activeTenantId, remoteStock, false);
      }
    };

    fetchStockFromFirestore(activeTenantId)
      .then((remoteStock) => {
        if (remoteStock && Object.keys(remoteStock).length > 0) {
          applyRemoteStock(remoteStock);
          return null;
        }
        if (activeTenantId !== 'tenant-main-01') {
          return fetchInventoryFromFirestore(activeTenantId);
        }
        return null;
      })
      .then((fallbackItems) => {
        if (fallbackItems && Array.isArray(fallbackItems) && fallbackItems.length > 0) {
          applyRemoteStock(inventoryProductsToStockMap(fallbackItems));
        }
      })
      .catch(console.warn);

    const unsubscribe = subscribeToFirestoreStock((remoteStock) => {
      applyRemoteStock(remoteStock);
    }, activeTenantId);

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [activeTenantId, persistTenantInventory]);

  // Handle item stock updates cleanly outside React state updaters (StrictMode safe)
  const handleUpdateStockItem = useCallback(
    async (
      name: string,
      newQty: number,
      minThreshold?: number,
      unit?: string,
      isActive?: boolean,
      limitByPatients?: boolean
    ): Promise<boolean> => {
      const current = stockRef.current;
      let nextStock: Record<string, StockItem>;

      if (activeTenantId === 'tenant-main-01') {
        nextStock = updateDbStockItem(name, newQty, minThreshold, unit, isActive, limitByPatients, current);
      } else {
        nextStock = updateStockItemInMap(current, name, newQty, minThreshold, unit, isActive, limitByPatients);
        persistTenantInventory(activeTenantId, nextStock);
      }

      stockRef.current = nextStock;
      setStock(nextStock);
      try {
        return await pushStockToFirestore(nextStock, activeTenantId);
      } catch (err) {
        console.error('[StockApp] Error syncing stock update to Firestore:', err);
        return false;
      }
    },
    [activeTenantId, persistTenantInventory]
  );

  // Sync with Firestore manually on demand
  const handleSyncWithFirestore = useCallback(async () => {
    setIsSyncingCloud(true);
    try {
      const freshStock = await fetchStockFromFirestore(activeTenantId);
      if (freshStock && Object.keys(freshStock).length > 0) {
        stockRef.current = freshStock;
        setStock(freshStock);
        if (activeTenantId === 'tenant-main-01') {
          saveDbStock(freshStock, false);
        } else {
          persistTenantInventory(activeTenantId, freshStock, false);
        }
        return { count: Object.keys(freshStock).length };
      }
      if (activeTenantId !== 'tenant-main-01') {
        const fallbackItems = await fetchInventoryFromFirestore(activeTenantId);
        if (fallbackItems && fallbackItems.length > 0) {
          const mapped = inventoryProductsToStockMap(fallbackItems);
          stockRef.current = mapped;
          setStock(mapped);
          persistTenantInventory(activeTenantId, mapped, false);
          return { count: Object.keys(mapped).length };
        }
      }
      return { count: Object.keys(stockRef.current).length };
    } finally {
      setIsSyncingCloud(false);
    }
  }, [activeTenantId, persistTenantInventory]);

  // Handle moving items up or down
  const handleMoveStockItem = useCallback(
    (idOrName: string, direction: 'up' | 'down') => {
      let nextStock: Record<string, StockItem>;
      if (activeTenantId === 'tenant-main-01') {
        nextStock = moveDbStockItem(idOrName, direction);
      } else {
        nextStock = moveStockItemInMap(stockRef.current, idOrName, direction);
        persistTenantInventory(activeTenantId, nextStock);
      }

      stockRef.current = nextStock;
      setStock(nextStock);
      pushStockToFirestore(nextStock, activeTenantId).catch(console.error);
    },
    [activeTenantId, persistTenantInventory]
  );

  // Handle saving full item outside React state updater
  const handleSaveFullItem = useCallback(
    (savedItem: StockItem, oldNameOrId?: string, targetPosition?: number) => {
      let nextStock: Record<string, StockItem>;
      if (activeTenantId === 'tenant-main-01') {
        if (typeof targetPosition === 'number' && targetPosition > 0) {
          nextStock = insertDbStockItemAtPosition(savedItem, targetPosition, oldNameOrId);
        } else {
          nextStock = saveOrUpdateDbStockItem(savedItem, oldNameOrId);
        }
      } else {
        nextStock = upsertStockItemInMap(stockRef.current, savedItem, oldNameOrId, targetPosition);
        persistTenantInventory(activeTenantId, nextStock);
      }

      stockRef.current = nextStock;
      setStock(nextStock);
      pushStockToFirestore(nextStock, activeTenantId).catch(console.error);
    },
    [activeTenantId, persistTenantInventory]
  );

  // Handle item deletion outside React state updater
  const handleDeleteStockItem = useCallback(
    (idOrName: string) => {
      let nextStock: Record<string, StockItem>;
      if (activeTenantId === 'tenant-main-01') {
        nextStock = deleteDbStockItem(idOrName);
      } else {
        nextStock = deleteStockItemFromMap(stockRef.current, idOrName);
        persistTenantInventory(activeTenantId, nextStock);
      }

      stockRef.current = nextStock;
      setStock(nextStock);
      pushStockToFirestore(nextStock, activeTenantId).catch(console.error);
    },
    [activeTenantId, persistTenantInventory]
  );

  const handleBackToMain = () => {
    if (typeof window !== 'undefined') {
      const tenantParam = activeTenantId ? `?tenant=${encodeURIComponent(activeTenantId)}` : '';
      window.location.href = `./index.html${tenantParam}`;
    }
  };

  if (isWorkspaceLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">ממשק ניהול המלאי נעול</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              סניף <strong>{activeTenant?.name || activeTenantId}</strong> הפעיל דרישת הזדהות מנהל בכניסה לעדכוני מלאי.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>התחברות מנהל סניף</span>
          </button>
        </div>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          subtitle={`נדרשת התחברות מנהל עבור ${activeTenant?.name || activeTenantId}`}
          onSuccess={(session) => setAuthSession(session)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500 selection:text-white" dir="rtl">
      <MobileStockManager
        stock={stock}
        tenantId={activeTenantId}
        tenantName={activeTenant?.name}
        isEmergencyMode={isEmergencyMode}
        onOpenEmergencyConfirm={() => setIsEmergencyConfirmOpen(true)}
        onUpdateStockItem={handleUpdateStockItem}
        onSyncWithCloud={handleSyncWithFirestore}
        isSyncingCloud={isSyncingCloud}
        onMoveItem={handleMoveStockItem}
        onSaveFullItem={handleSaveFullItem}
        onDeleteItem={handleDeleteStockItem}
        onBackToMain={handleBackToMain}
      />

      {/* Emergency Mode Confirmation Modal */}
      <EmergencyConfirmModal
        isOpen={isEmergencyConfirmOpen}
        onClose={() => setIsEmergencyConfirmOpen(false)}
        isCurrentlyEmergency={isEmergencyMode}
        onConfirm={(targetState) => {
          setIsEmergencyMode(targetState);
          try {
            localStorage.setItem(emergencyKey, String(targetState));
          } catch {}
          setIsEmergencyConfirmOpen(false);
        }}
      />

      {/* PWA Install Banner */}
      <PWAInstallBanner appType="stock" />
    </div>
  );
}
