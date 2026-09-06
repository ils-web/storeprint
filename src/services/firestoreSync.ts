import {
  doc,
  collection,
  setDoc,
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
import { saveTenantOrders } from './multiTenantDb';

/**
 * Sanitizes an object before passing to Firestore setDoc/updateDoc
 * to completely eliminate 'Unsupported field value: undefined' errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Pushes the full master warehouse stock to Firestore
 */
export async function pushStockToFirestore(
  stock: Record<string, StockItem>,
  tenantId: string = 'tenant-main-01'
): Promise<boolean> {
  if (!isFirebaseReady || !db) return false;
  try {
    const payload = sanitizeForFirestore({
      stock,
      totalItems: Object.keys(stock).length,
      updatedAt: new Date().toISOString(),
    });

    const docRef = doc(db, 'tenants', tenantId, 'warehouse', 'master_stock');
    await setDoc(docRef, payload, { merge: true });

    const globalDocRef = doc(db, 'warehouse', 'master_stock');
    await setDoc(globalDocRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore pushStock error:', err);
    return false;
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
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.stock && typeof data.stock === 'object') {
            const firestoreStock = data.stock as Record<string, StockItem>;
            if (Object.keys(firestoreStock).length > 0) {
              saveDbStock(firestoreStock, false);
              onStockUpdated(firestoreStock);
            }
          }
        } else {
          // If Firestore document is empty, seed it with current local stock
          const localStock = getDbStock();
          if (Object.keys(localStock).length > 0) {
            pushStockToFirestore(localStock, tenantId).catch(console.warn);
          }
        }
      },
      (err) => {
        console.warn('Firestore stock subscription error:', err);
      }
    );

    return unsubscribe;
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
  tenantId: string = 'tenant-main-01'
): Promise<boolean> {
  if (!isFirebaseReady || !db) {
    console.warn('Firestore is not ready. Order saved locally.');
    return false;
  }
  try {
    const cleanPayload = sanitizeForFirestore({
      ...order,
      syncedAt: new Date().toISOString(),
    });

    // Write to tenant collection
    const orderDocRef = doc(db, 'tenants', tenantId, 'orders', order.id);
    await setDoc(orderDocRef, cleanPayload);

    // Also write to global orders collection
    const globalOrderRef = doc(db, 'orders', order.id);
    await setDoc(globalOrderRef, cleanPayload);

    console.log('✅ Order pushed to Firestore successfully:', order.id, order.departmentName);
    return true;
  } catch (err) {
    console.error('Firestore pushOrder error:', err);
    throw err;
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

    const globalRef = doc(db, 'orders', orderId);
    await setDoc(globalRef, patch, { merge: true });

    return true;
  } catch (err) {
    console.warn('Firestore updateOrderPrinted error:', err);
    return false;
  }
}

/**
 * Subscribes to real-time orders from Firestore across both tenant and global collections
 */
export function subscribeToFirestoreOrders(
  onOrdersUpdated: (orders: MultiTenantOrder[]) => void,
  tenantId: string = 'tenant-main-01'
): Unsubscribe | null {
  if (!isFirebaseReady || !db) return null;

  try {
    const ordersMap = new Map<string, MultiTenantOrder>();

    const handleSnapshot = (snapshot: any) => {
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data() as MultiTenantOrder;
        if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
          ordersMap.set(docSnap.id, data);
        }
      });

      const liveOrders = Array.from(ordersMap.values());
      if (liveOrders.length > 0) {
        liveOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveTenantOrders(tenantId, liveOrders);
        onOrdersUpdated(liveOrders);
      }
    };

    // 1. Subscribe to tenant collection
    const tenantCol = collection(db, 'tenants', tenantId, 'orders');
    const q1 = query(tenantCol, limit(200));
    const unsub1 = onSnapshot(
      q1,
      handleSnapshot,
      (err) => console.warn('Firestore tenant orders subscription error:', err)
    );

    // 2. Subscribe to global collection
    const globalCol = collection(db, 'orders');
    const q2 = query(globalCol, limit(200));
    const unsub2 = onSnapshot(
      q2,
      handleSnapshot,
      (err) => console.warn('Firestore global orders subscription error:', err)
    );

    return () => {
      try {
        unsub1();
      } catch {}
      try {
        unsub2();
      } catch {}
    };
  } catch (err) {
    console.warn('Failed to start Firestore orders subscription:', err);
    return null;
  }
}

/**
 * Fetches all orders directly from Firestore across both tenant and global collections
 */
export async function fetchOrdersFromFirestore(
  tenantId: string = 'tenant-main-01'
): Promise<MultiTenantOrder[]> {
  if (!isFirebaseReady || !db) return [];
  try {
    const ordersMap = new Map<string, MultiTenantOrder>();

    // Fetch tenant collection
    try {
      const ordersCol = collection(db, 'tenants', tenantId, 'orders');
      const q = query(ordersCol, limit(250));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
          ordersMap.set(docSnap.id, data as MultiTenantOrder);
        }
      });
    } catch (e) {
      console.warn('Error fetching tenant orders:', e);
    }

    // Fetch global collection
    try {
      const globalCol = collection(db, 'orders');
      const qG = query(globalCol, limit(250));
      const snapG = await getDocs(qG);
      snapG.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
          ordersMap.set(docSnap.id, data as MultiTenantOrder);
        }
      });
    } catch (e) {
      console.warn('Error fetching global orders:', e);
    }

    const orders = Array.from(ordersMap.values());
    if (orders.length > 0) {
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      saveTenantOrders(tenantId, orders);
    }
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

    // 2. Delete from global collection
    const globalRef = doc(db, 'orders', cleanId);
    await deleteDoc(globalRef);

    console.log('✅ Order deleted from Firestore permanently:', cleanId);
    return true;
  } catch (err) {
    console.warn('Firestore deleteOrderFromFirestore error:', err);
    return false;
  }
}