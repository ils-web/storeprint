import {
  doc,
  collection,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseReady } from './firebase';
import { StockItem } from '../types';
import { MultiTenantOrder } from '../types/multiTenant';
import { getDbStock, saveDbStock } from './unifiedDb';
import { saveTenantOrders, getTenantStockMap } from './multiTenantDb';

/**
 * Sanitizes an object before passing to Firestore setDoc/updateDoc
 * to completely eliminate 'Unsupported field value: undefined' errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// Track local stock writes per tenant to prevent Firestore server echo from overwriting rapid local edits
const lastLocalStockWriteAt: Record<string, number> = {};
const activeStockWritesCount: Record<string, number> = {};

export function markLocalStockWrite(tenantId: string = 'tenant-main-01'): void {
  lastLocalStockWriteAt[tenantId] = Date.now();
}

/**
 * Pushes the full master warehouse stock to Firestore
 */
export async function pushStockToFirestore(
  stock: Record<string, StockItem>,
  tenantId: string = 'tenant-main-01'
): Promise<boolean> {
  if (!isFirebaseReady || !db) return false;
  lastLocalStockWriteAt[tenantId] = Date.now();
  activeStockWritesCount[tenantId] = (activeStockWritesCount[tenantId] || 0) + 1;
  try {
    const payload = sanitizeForFirestore({
      stock,
      totalItems: Object.keys(stock).length,
      updatedAt: new Date().toISOString(),
    });

    const docRef = doc(db, 'tenants', tenantId, 'warehouse', 'master_stock');
    if (tenantId === 'tenant-main-01') {
      const globalDocRef = doc(db, 'warehouse', 'master_stock');
      await Promise.all([setDoc(docRef, payload), setDoc(globalDocRef, payload)]);
    } else {
      await setDoc(docRef, payload);
    }
    lastLocalStockWriteAt[tenantId] = Date.now();
    return true;
  } catch (err) {
    console.warn('Firestore pushStock error:', err);
    return false;
  } finally {
    activeStockWritesCount[tenantId] = Math.max(0, (activeStockWritesCount[tenantId] || 1) - 1);
  }
}

/**
 * Fetches the master warehouse stock directly from Firestore
 */
export async function fetchStockFromFirestore(
  tenantId: string = 'tenant-main-01'
): Promise<Record<string, StockItem> | null> {
  if (!isFirebaseReady || !db) return null;
  try {
    const tenantRef = doc(db, 'tenants', tenantId, 'warehouse', 'master_stock');
    const snap = await getDoc(tenantRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.stock && typeof data.stock === 'object' && Object.keys(data.stock).length > 0) {
        return data.stock as Record<string, StockItem>;
      }
    }
    if (tenantId === 'tenant-main-01') {
      const globalRef = doc(db, 'warehouse', 'master_stock');
      const snapG = await getDoc(globalRef);
      if (snapG.exists()) {
        const dataG = snapG.data();
        if (dataG && dataG.stock && typeof dataG.stock === 'object' && Object.keys(dataG.stock).length > 0) {
          return dataG.stock as Record<string, StockItem>;
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('Firestore fetchStockFromFirestore error:', err);
    return null;
  }
}

/**
 * Subscribes to real-time warehouse stock updates from Firestore.
 */
export function subscribeToFirestoreStock(
  onStockUpdated: (stock: Record<string, StockItem>) => void,
  tenantId: string = 'tenant-main-01'
): Unsubscribe | null {
  if (!isFirebaseReady || !db) return null;

  try {
    const docRef = doc(db, 'tenants', tenantId, 'warehouse', 'master_stock');
    const unsub1 = onSnapshot(
      docRef,
      (snapshot) => {
        // Ignore local pending writes and immediate server echoes while user is actively editing stock
        if (snapshot.metadata?.hasPendingWrites) return;
        if ((activeStockWritesCount[tenantId] || 0) > 0) return;
        if (Date.now() - (lastLocalStockWriteAt[tenantId] || 0) < 3000) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.stock && typeof data.stock === 'object') {
            const firestoreStock = data.stock as Record<string, StockItem>;
            if (Object.keys(firestoreStock).length > 0) {
              if (tenantId === 'tenant-main-01') {
                saveDbStock(firestoreStock, false);
              }
              onStockUpdated(firestoreStock);
            }
          }
        } else {
          // If Firestore document is empty, seed it with tenant-specific inventory
          const localStock = getTenantStockMap(tenantId);
          if (Object.keys(localStock).length > 0) {
            pushStockToFirestore(localStock, tenantId).catch(console.warn);
          }
        }
      },
      (err) => {
        console.warn('Firestore stock subscription error:', err);
      }
    );

    return () => {
      try {
        unsub1();
      } catch {}
    };
  } catch (err) {
    console.warn('Failed to start Firestore stock subscription:', err);
    return null;
  }
}

/**
 * Pushes a newly placed order to Firestore
 */
export async function pushOrderToFirestore(
  order: MultiTenantOrder,
  tenantId: string = 'tenant-main-01',
  timeoutMs: number = 4000
): Promise<boolean> {
  if (!isFirebaseReady || !db) {
    console.warn('Firestore is not ready. Order saved locally.');
    return false;
  }

  const writeOperation = async (): Promise<boolean> => {
    const cleanPayload = sanitizeForFirestore({
      ...order,
      syncedAt: new Date().toISOString(),
    });

    const writes: Promise<any>[] = [];
    const orderDocRef = doc(db!, 'tenants', tenantId, 'orders', order.id);
    writes.push(setDoc(orderDocRef, cleanPayload));

    if (tenantId === 'tenant-main-01') {
      const globalOrderRef = doc(db!, 'orders', order.id);
      writes.push(setDoc(globalOrderRef, cleanPayload));
    }

    await Promise.all(writes);
    console.log('✅ Order pushed to Firestore successfully:', order.id, order.departmentName);
    return true;
  };

  const timeoutPromise = new Promise<boolean>((_, reject) => {
    setTimeout(() => reject(new Error('Firestore sync timeout (4s)')), timeoutMs);
  });

  try {
    return await Promise.race([writeOperation(), timeoutPromise]);
  } catch (err) {
    console.warn('Firestore pushOrder timeout/warning (saved locally, will retry in background):', err);
    // Background retry without blocking the user
    writeOperation().catch((bgErr) => console.warn('Background Firestore push error:', bgErr));
    return false;
  }
}

/**
 * Updates an order's printed status in Firestore
 */
export async function updateOrderPrintedInFirestore(
  orderId: string,
  printed: boolean,
  printedAt?: string,
  tenantId: string = 'tenant-main-01'
): Promise<boolean> {
  if (!isFirebaseReady || !db) return false;
  try {
    const patch = sanitizeForFirestore({
      printed,
      status: printed ? 'PRINTED' : 'NEW',
      printedAt: printedAt || (printed ? new Date().toISOString() : null),
      updatedAt: new Date().toISOString(),
    });

    const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
    await setDoc(docRef, patch, { merge: true });

    if (tenantId === 'tenant-main-01') {
      const globalRef = doc(db, 'orders', orderId);
      await setDoc(globalRef, patch, { merge: true });
    }

    return true;
  } catch (err) {
    console.warn('Firestore updateOrderPrinted error:', err);
    return false;
  }
}

/**
 * Subscribes to real-time orders from Firestore strictly for the specified tenant
 */
export function subscribeToFirestoreOrders(
  onOrdersUpdated: (orders: MultiTenantOrder[]) => void,
  tenantId: string = 'tenant-main-01'
): Unsubscribe | null {
  if (!isFirebaseReady || !db) return null;

  try {
    const ordersMap = new Map<string, MultiTenantOrder>();

    const isMain = tenantId === 'tenant-main-01';
    const handleSnapshot = (snapshot: any) => {
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data() as MultiTenantOrder;
        if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
          if (isMain) {
            if (!data.tenantId || data.tenantId === 'tenant-main-01') {
              ordersMap.set(docSnap.id, data);
            }
          } else {
            if (data.tenantId === tenantId) {
              ordersMap.set(docSnap.id, data);
            }
          }
        }
      });

      const liveOrders = Array.from(ordersMap.values()).filter(
        (o) => isMain ? (!o.tenantId || o.tenantId === 'tenant-main-01') : o.tenantId === tenantId
      );
      liveOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      saveTenantOrders(tenantId, liveOrders);
      onOrdersUpdated(liveOrders);
    };

    // 1. Subscribe to tenant collection
    const tenantCol = collection(db, 'tenants', tenantId, 'orders');
    const q1 = query(tenantCol, limit(1000));
    const unsub1 = onSnapshot(
      q1,
      handleSnapshot,
      (err) => console.warn('Firestore tenant orders subscription error:', err)
    );

    // 2. Subscribe to global collection ONLY for main hospital tenant
    let unsub2: (() => void) | null = null;
    if (tenantId === 'tenant-main-01') {
      const globalCol = collection(db, 'orders');
      const q2 = query(globalCol, limit(1000));
      unsub2 = onSnapshot(
        q2,
        handleSnapshot,
        (err) => console.warn('Firestore global orders subscription error:', err)
      );
    }

    return () => {
      try {
        unsub1();
      } catch {}
      if (unsub2) {
        try {
          unsub2();
        } catch {}
      }
    };
  } catch (err) {
    console.warn('Failed to start Firestore orders subscription:', err);
    return null;
  }
}

/**
 * Fetches all orders directly from Firestore strictly for the specified tenant
 */
export async function fetchOrdersFromFirestore(
  tenantId: string = 'tenant-main-01'
): Promise<MultiTenantOrder[]> {
  if (!isFirebaseReady || !db) return [];
  try {
    const isMain = tenantId === 'tenant-main-01';
    const ordersMap = new Map<string, MultiTenantOrder>();

    // 1. Fetch tenant collection
    try {
      const ordersCol = collection(db, 'tenants', tenantId, 'orders');
      const q = query(ordersCol, limit(1000));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
          if (isMain) {
            if (!data.tenantId || data.tenantId === 'tenant-main-01') {
              ordersMap.set(docSnap.id, data as MultiTenantOrder);
            }
          } else {
            if (data.tenantId === tenantId) {
              ordersMap.set(docSnap.id, data as MultiTenantOrder);
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error fetching tenant orders:', e);
    }

    // 2. Fetch global collection ONLY for main hospital tenant
    if (tenantId === 'tenant-main-01') {
      try {
        const globalCol = collection(db, 'orders');
        const qG = query(globalCol, limit(1000));
        const snapG = await getDocs(qG);
        snapG.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
            if (!data.tenantId || data.tenantId === 'tenant-main-01') {
              ordersMap.set(docSnap.id, data as MultiTenantOrder);
            }
          }
        });
      } catch (e) {
        console.warn('Error fetching global orders:', e);
      }
    }

    const orders = Array.from(ordersMap.values()).filter(
      (o) => isMain ? (!o.tenantId || o.tenantId === 'tenant-main-01') : o.tenantId === tenantId
    );
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    saveTenantOrders(tenantId, orders);
    return orders;
  } catch (err) {
    console.warn('Firestore fetchOrdersFromFirestore error:', err);
    return [];
  }
}

/**
 * Permanently deletes an order from Cloud Firestore (both tenant and global collections)
 */
export async function deleteOrderFromFirestore(
  orderId: string,
  tenantId: string = 'tenant-main-01'
): Promise<boolean> {
  if (!isFirebaseReady || !db) return false;
  try {
    const cleanId = orderId.trim();
    if (!cleanId) return false;

    // 1. Delete from tenant collection
    const docRef = doc(db, 'tenants', tenantId, 'orders', cleanId);
    await deleteDoc(docRef);

    // 2. Delete from global collection ONLY for main hospital tenant
    if (tenantId === 'tenant-main-01') {
      const globalRef = doc(db, 'orders', cleanId);
      await deleteDoc(globalRef);
    }

    console.log('✅ Order deleted from Firestore permanently:', cleanId);
    return true;
  } catch (err) {
    console.warn('Firestore deleteOrderFromFirestore error:', err);
    return false;
  }
}

/**
 * Pushes the full set of printed order keys to Firestore so printed status survives
 * across different computers, browsers, and reloads.
 */
export async function pushPrintedOrderKeysToFirestore(
  keys: string[],
  tenantId: string = 'tenant-main-01'
): Promise<boolean> {
  if (!isFirebaseReady || !db) return false;
  try {
    const payload = sanitizeForFirestore({
      keys: Array.from(new Set(keys.filter((k) => k && typeof k === 'string' && !k.startsWith('unprinted_')))),
      totalPrinted: keys.length,
      updatedAt: new Date().toISOString(),
    });

    const tenantRef = doc(db, 'tenants', tenantId, 'warehouse', 'printed_orders');
    await setDoc(tenantRef, payload, { merge: true });

    if (tenantId === 'tenant-main-01') {
      const globalRef = doc(db, 'warehouse', 'printed_orders');
      await setDoc(globalRef, payload, { merge: true });
    }
    return true;
  } catch (err) {
    console.warn('Firestore pushPrintedOrderKeys error:', err);
    return false;
  }
}

/**
 * Fetches printed order keys from Firestore
 */
export async function fetchPrintedOrderKeysFromFirestore(
  tenantId: string = 'tenant-main-01'
): Promise<string[]> {
  if (!isFirebaseReady || !db) return [];
  try {
    const tenantRef = doc(db, 'tenants', tenantId, 'warehouse', 'printed_orders');
    const snap = await getDoc(tenantRef);
    if (snap.exists() && Array.isArray(snap.data()?.keys)) {
      return snap.data()?.keys;
    }
    if (tenantId === 'tenant-main-01') {
      const globalRef = doc(db, 'warehouse', 'printed_orders');
      const snapG = await getDoc(globalRef);
      if (snapG.exists() && Array.isArray(snapG.data()?.keys)) {
        return snapG.data()?.keys;
      }
    }
    return [];
  } catch (err) {
    console.warn('Firestore fetchPrintedOrderKeys error:', err);
    return [];
  }
}

/**
 * Subscribes to real-time printed order keys from Firestore
 */
export function subscribeToFirestorePrintedOrderKeys(
  onKeysUpdated: (keys: string[]) => void,
  tenantId: string = 'tenant-main-01'
): Unsubscribe | null {
  if (!isFirebaseReady || !db) return null;
  try {
    const tenantRef = doc(db, 'tenants', tenantId, 'warehouse', 'printed_orders');
    return onSnapshot(
      tenantRef,
      (snap) => {
        if (snap.exists()) {
          const keys = snap.data()?.keys;
          if (Array.isArray(keys)) {
            onKeysUpdated(keys);
          }
        }
      },
      (err) => console.warn('Firestore printed order keys subscription error:', err)
    );
  } catch (err) {
    console.warn('Failed to start printed order keys subscription:', err);
    return null;
  }
}

/**
 * Saves a cloud stock backup for the specified tenant
 */
export async function saveCloudStockBackup(
  tenantId: string,
  stock: Record<string, StockItem>
): Promise<void> {
  if (!isFirebaseReady || !db) throw new Error('Firebase לא מחובר');
  const docRef = doc(db, 'tenants', tenantId, 'warehouse', 'stock_backup');
  await setDoc(docRef, sanitizeForFirestore({
    stock,
    savedAt: new Date().toISOString(),
    itemCount: Object.keys(stock).length,
  }));
}

/**
 * Restores a cloud stock backup for the specified tenant
 */
export async function restoreCloudStockBackup(
  tenantId: string
): Promise<Record<string, StockItem> | null> {
  if (!isFirebaseReady || !db) throw new Error('Firebase לא מחובר');
  const docRef = doc(db, 'tenants', tenantId, 'warehouse', 'stock_backup');
  const snap = await getDoc(docRef);
  if (snap.exists() && snap.data()?.stock) {
    return snap.data().stock as Record<string, StockItem>;
  }
  return null;
}
