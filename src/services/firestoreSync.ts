import {
  doc,
  collection,
  setDoc,
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
 * Pushes the full master warehouse stock to Firestore
 */
export async function pushStockToFirestore(
  stock: Record<string, StockItem>,
  tenantId: string = 'tenant-main-01'
): Promise<boolean> {
  if (!isFirebaseReady || !db) return false;
  try {
    const docRef = doc(db, 'tenants', tenantId, 'warehouse', 'master_stock');
    await setDoc(
      docRef,
      {
        stock,
        totalItems: Object.keys(stock).length,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const globalDocRef = doc(db, 'warehouse', 'master_stock');
    await setDoc(
      globalDocRef,
      {
        stock,
        totalItems: Object.keys(stock).length,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
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
  if (!isFirebaseReady || !db) return false;
  try {
    const orderDocRef = doc(db, 'tenants', tenantId, 'orders', order.id);
    await setDoc(orderDocRef, {
      ...order,
      syncedAt: new Date().toISOString(),
    });

    const globalOrderRef = doc(db, 'orders', order.id);
    await setDoc(globalOrderRef, {
      ...order,
      syncedAt: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.warn('Firestore pushOrder error:', err);
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
    const patch = {
      printed,
      status: printed ? 'PRINTED' : 'NEW',
      printedAt: printedAt || (printed ? new Date().toISOString() : null),
      updatedAt: new Date().toISOString(),
    };

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
 * Subscribes to real-time orders from Firestore
 */
export function subscribeToFirestoreOrders(
  onOrdersUpdated: (orders: MultiTenantOrder[]) => void,
  tenantId: string = 'tenant-main-01'
): Unsubscribe | null {
  if (!isFirebaseReady || !db) return null;

  try {
    const ordersCol = collection(db, 'tenants', tenantId, 'orders');
    const q = query(ordersCol, limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveOrders: MultiTenantOrder[] = [];
        snapshot.forEach((docSnap) => {
          liveOrders.push(docSnap.data() as MultiTenantOrder);
        });

        if (liveOrders.length > 0) {
          liveOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          saveTenantOrders(tenantId, liveOrders);
          onOrdersUpdated(liveOrders);
        }
      },
      (err) => {
        console.warn('Firestore orders subscription error:', err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to start Firestore orders subscription:', err);
    return null;
  }
}