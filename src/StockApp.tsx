import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MobileStockManager } from './components/mobile/MobileStockManager';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { EmergencyConfirmModal } from './components/emergency/EmergencyConfirmModal';
import { StockItem } from './types';
import {
  getDbStock,
  saveDbStock,
  saveOrUpdateDbStockItem,
  deleteDbStockItem,
  moveDbStockItem,
  insertDbStockItemAtPosition,
} from './services/unifiedDb';
import {
  subscribeToFirestoreStock,
  fetchStockFromFirestore,
  pushStockToFirestore,
} from './services/firestoreSync';
import {
  getTenants,
  getWarehouses,
  getTenantStockMap,
  saveInventory,
  fetchTenantsFromFirestore,
  subscribeToTenantsFirestore,
} from './services/multiTenantDb';
import { Tenant, InventoryProduct, PackagingUnit } from './types/multiTenant';

export default function StockApp() {
  const [tenants, setTenants] = useState<Tenant[]>(() => getTenants());

  // Resolve active tenant from URL (?tenant=... or ?tenantId=...)
  const [activeTenantId, setActiveTenantId] = useState<string>(() => {
    const initialTenants = getTenants();
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

  // Subscribe to tenants from Firestore so all 4+ warehouses resolve their names properly on mobile
  useEffect(() => {
    fetchTenantsFromFirestore()
      .then((list) => {
        if (list && list.length > 0) setTenants(list);
      })
      .catch(console.warn);
    const unsub = subscribeToTenantsFirestore((list) => {
      if (list && list.length > 0) setTenants(list);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const activeTenant = useMemo(() => {
    return tenants.find((t) => t.id === activeTenantId) || tenants[0];
  }, [tenants, activeTenantId]);

  const persistTenantInventory = useCallback((tId: string, stockMap: Record<string, StockItem>) => {
    if (tId === 'tenant-main-01') return;
    const whId = getWarehouses(tId)[0]?.id || 'wh-01';
    const items: InventoryProduct[] = Object.values(stockMap).map((item, idx) => ({
      id: item.id || `prod-${tId}-${idx}`,
      tenantId: tId,
      warehouseId: whId,
      name: item.name,
      colIndex: item.colIndex || idx + 1,
      currentStock: item.currentStock || 0,
      minThreshold: item.minThreshold || 10,
      unit: (item.unit || "יח'") as PackagingUnit,
      isActive: item.isActive !== false,
      limitByPatients: Boolean(item.limitByPatients),
      updatedAt: item.lastUpdated || new Date().toISOString(),
    }));
    saveInventory(tId, items);
  }, []);

  // Initial stock from local DB cache strictly isolated per tenant
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

  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
  const [isEmergencyConfirmOpen, setIsEmergencyConfirmOpen] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Subscribe to real-time Firestore updates for active tenant
  useEffect(() => {
    const unsubscribe = subscribeToFirestoreStock((remoteStock) => {
      setStock(remoteStock);
      if (activeTenantId === 'tenant-main-01') {
        saveDbStock(remoteStock);
      } else {
        persistTenantInventory(activeTenantId, remoteStock);
      }
    }, activeTenantId);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [activeTenantId, persistTenantInventory]);

  // Handle item stock updates
  const handleUpdateStockItem = useCallback(
    (
      name: string,
      newQty: number,
      minThreshold?: number,
      unit?: string,
      isActive?: boolean,
      limitByPatients?: boolean
    ) => {
      setStock((prev) => {
        const existing = prev[name];
        if (!existing) return prev;

        const updatedItem: StockItem = {
          ...existing,
          currentStock: Math.max(0, newQty),
          minThreshold: minThreshold !== undefined ? minThreshold : existing.minThreshold,
          unit: unit !== undefined ? unit : existing.unit,
          isActive: isActive !== undefined ? isActive : existing.isActive,
          limitByPatients: limitByPatients !== undefined ? limitByPatients : existing.limitByPatients,
        };

        const nextStock = {
          ...prev,
          [name]: updatedItem,
        };

        if (activeTenantId === 'tenant-main-01') {
          saveOrUpdateDbStockItem(updatedItem);
        } else {
          persistTenantInventory(activeTenantId, nextStock);
        }

        // Push immediately to Firestore
        pushStockToFirestore(nextStock, activeTenantId).catch((err) => {
          console.error('[StockApp] Error syncing stock update to Firestore:', err);
        });

        return nextStock;
      });
    },
    [activeTenantId, persistTenantInventory]
  );

  // Sync with Firestore manually on demand
  const handleSyncWithFirestore = useCallback(async () => {
    setIsSyncingCloud(true);
    try {
      const freshStock = await fetchStockFromFirestore(activeTenantId);
      if (freshStock && Object.keys(freshStock).length > 0) {
        setStock(freshStock);
        if (activeTenantId === 'tenant-main-01') {
          saveDbStock(freshStock);
        } else {
          persistTenantInventory(activeTenantId, freshStock);
        }
        return { count: Object.keys(freshStock).length };
      }
      return { count: Object.keys(stock).length };
    } finally {
      setIsSyncingCloud(false);
    }
  }, [activeTenantId, stock, persistTenantInventory]);

  // Handle moving items up or down
  const handleMoveStockItem = useCallback(
    (idOrName: string, direction: 'up' | 'down') => {
      const currentList: StockItem[] = Object.values(stock) as StockItem[];
      const currentIndex = currentList.findIndex(
        (item) => (item.id && item.id === idOrName) || item.name === idOrName
      );
      if (currentIndex === -1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentList.length) return;

      const updatedList = [...currentList];
      const [movedItem] = updatedList.splice(currentIndex, 1);
      updatedList.splice(targetIndex, 0, movedItem);

      const nextStock: Record<string, StockItem> = {};
      updatedList.forEach((item, idx) => {
        item.colIndex = idx + 1;
        nextStock[item.name] = item;
      });

      setStock(nextStock);
      if (activeTenantId === 'tenant-main-01') {
        moveDbStockItem(idOrName, direction);
      } else {
        persistTenantInventory(activeTenantId, nextStock);
      }
      pushStockToFirestore(nextStock, activeTenantId).catch(console.error);
    },
    [stock, activeTenantId, persistTenantInventory]
  );

  // Handle saving full item
  const handleSaveFullItem = useCallback(
    (savedItem: StockItem, oldNameOrId?: string, targetPosition?: number) => {
      setStock((prev) => {
        let list: StockItem[] = Object.values(prev) as StockItem[];

        if (oldNameOrId) {
          list = list.filter(
            (item) => item.id !== oldNameOrId && item.name !== oldNameOrId
          );
        } else {
          list = list.filter(
            (item) => item.id !== savedItem.id && item.name !== savedItem.name
          );
        }

        if (typeof targetPosition === 'number' && targetPosition >= 1 && targetPosition <= list.length + 1) {
          list.splice(targetPosition - 1, 0, savedItem);
        } else {
          list.unshift(savedItem);
        }

        const nextStock: Record<string, StockItem> = {};
        list.forEach((item, idx) => {
          item.colIndex = idx + 1;
          nextStock[item.name] = item;
        });

        if (activeTenantId === 'tenant-main-01') {
          if (typeof targetPosition === 'number') {
            insertDbStockItemAtPosition(savedItem, targetPosition, oldNameOrId);
          } else {
            saveOrUpdateDbStockItem(savedItem, oldNameOrId);
          }
        } else {
          persistTenantInventory(activeTenantId, nextStock);
        }

        pushStockToFirestore(nextStock, activeTenantId).catch(console.error);
        return nextStock;
      });
    },
    [activeTenantId, persistTenantInventory]
  );

  // Handle item deletion
  const handleDeleteStockItem = useCallback(
    (idOrName: string) => {
      setStock((prev) => {
        const nextStock: Record<string, StockItem> = { ...prev };
        let foundKey: string | null = null;

        for (const [key, item] of Object.entries(nextStock) as [string, StockItem][]) {
          if ((item.id && item.id === idOrName) || item.name === idOrName || key === idOrName) {
            foundKey = key;
            break;
          }
        }

        if (foundKey) {
          delete nextStock[foundKey];
          if (activeTenantId === 'tenant-main-01') {
            deleteDbStockItem(idOrName);
          } else {
            persistTenantInventory(activeTenantId, nextStock);
          }
          pushStockToFirestore(nextStock, activeTenantId).catch(console.error);
        }

        return nextStock;
      });
    },
    [activeTenantId, persistTenantInventory]
  );

  // Return to main app
  const handleBackToMain = () => {
    if (typeof window !== 'undefined') {
      const tenantParam = activeTenantId ? `?tenant=${encodeURIComponent(activeTenantId)}` : '';
      window.location.href = `./index.html${tenantParam}`;
    }
  };

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
          setIsEmergencyConfirmOpen(false);
        }}
      />

      {/* PWA Install Banner */}
      <PWAInstallBanner appType="stock" />
    </div>
  );
}
