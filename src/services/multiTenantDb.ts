import {
  Tenant,
  Warehouse,
  InventoryProduct,
  TenantDepartment,
  MultiTenantOrder,
  AuthSession,
  PlanType,
} from '../types/multiTenant';
import { StockItem } from '../types';
import { DEFAULT_SPREADSHEET_ID, DEFAULT_GID } from '../utils/googleSheets';
import { CANONICAL_DEPARTMENTS, getDbStock, saveDbDepartments } from './unifiedDb';
import { db, ensureFirebaseAuth } from './firebase';
import { hashSecret, verifySecret, isHashedSecret, generateSessionToken } from '../utils/crypto';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';

const STORAGE_KEY_PREFIX = 'storeprint_mt_v1_';
const TENANTS_KEY = `${STORAGE_KEY_PREFIX}tenants`;
const WAREHOUSES_KEY = `${STORAGE_KEY_PREFIX}warehouses`;
const INVENTORY_KEY = `${STORAGE_KEY_PREFIX}inventory_`;
const DEPARTMENTS_KEY = `${STORAGE_KEY_PREFIX}departments_`;
const ORDERS_KEY = `${STORAGE_KEY_PREFIX}orders_`;
const AUTH_SESSION_KEY = `${STORAGE_KEY_PREFIX}auth_session`;
const SUPERADMIN_AUTH_KEY = `${STORAGE_KEY_PREFIX}superadmin_auth_v1`;
const AUTH_THROTTLE_KEY = `${STORAGE_KEY_PREFIX}auth_throttle_v1`;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const SUPERADMIN_DISPLAY_NAME = 'מנהל מערכת ראשי (SuperAdmin)';
const DEFAULT_SUPERADMIN_LOGIN = 'admin';
const DEFAULT_SUPERADMIN_BOOTSTRAP_HASH =
  'sha256$sp_sa_2026_k9$b3663e725c8de8934f1a4613610d1c78ead4df923d2cd12a6bd81cc407240ca5';
const DEFAULT_TENANT1_BOOTSTRAP_HASH =
  'sha256$sp_t1_2026_m4$e1c6d88afa85dcd293967ade996661ffc02c3b0fe8354b781d908264d9ecf15b';
const DEFAULT_TENANT2_BOOTSTRAP_HASH =
  'sha256$sp_t2_2026_v7$6efb1a71fcd6b54760b9bbfd3bc16f133e4b2549ad883856b07be3e63b99bc0a';

const BOOTSTRAP_HASHES = new Set([
  DEFAULT_SUPERADMIN_BOOTSTRAP_HASH,
  DEFAULT_TENANT1_BOOTSTRAP_HASH,
  DEFAULT_TENANT2_BOOTSTRAP_HASH,
]);

export const BILLING_PLANS: Record<PlanType, {
  id: PlanType;
  name: string;
  priceMonthlyNis: number;
  description: string;
  features: string[];
  maxWarehouses: number;
  maxDepartments: number;
  maxOrdersPerMonth: number;
}> = {
  free: {
    id: 'free',
    name: 'בסיסי / ניסיון',
    priceMonthlyNis: 0,
    description: 'לסניפים קטנים ובדיקת המערכת',
    features: ['מחסן סניף 1', 'עד 10 מחלקות', 'עד 200 הזמנות בחודש', 'הדפסת טפסי ניפוק'],
    maxWarehouses: 1,
    maxDepartments: 10,
    maxOrdersPerMonth: 200,
  },
  starter: {
    id: 'starter',
    name: 'התחלתי (Starter)',
    priceMonthlyNis: 99,
    description: 'למרפאות ומרכזים רפואיים בינוניים',
    features: ['2 מחסנים בסניף', 'עד 25 מחלקות', 'הזמנות ללא הגבלה', 'ניהול סוגי אריזות', 'גישת QR מהירה'],
    maxWarehouses: 2,
    maxDepartments: 25,
    maxOrdersPerMonth: 5000,
  },
  pro: {
    id: 'pro',
    name: 'מקצועי (Pro)',
    priceMonthlyNis: 279,
    description: 'לבתי חולים ומרכזים גריאטריים/סיעודיים',
    features: ['עד 5 מחסנים בסניף', 'מחלקות ללא הגבלה', 'פורטל הזמנות PWA למובייל', 'סנכרון ענן בזמן אמת', 'העברות בין מחסנים'],
    maxWarehouses: 5,
    maxDepartments: 100,
    maxOrdersPerMonth: 50000,
  },
  enterprise: {
    id: 'enterprise',
    name: 'ארגוני (Enterprise)',
    priceMonthlyNis: 699,
    description: 'לרשתות מוסדות וארגוני בריאות גדולים',
    features: ['מחסנים ללא הגבלה', 'יצירת מחסנים עצמאית ע״י הסניף', 'מסד נתונים ייעודי מבודד', 'התאמה אישית מלאה', 'תמיכה טכנית 24/7'],
    maxWarehouses: 999,
    maxDepartments: 999,
    maxOrdersPerMonth: 999999,
  },
};

// Initial Default Tenants (Matching user's live setup)
export const DEFAULT_INITIAL_TENANT: Tenant = {
  id: 'tenant-main-01',
  name: 'Naot Hatichon',
  slug: 'main-center',
  login: 'andrey_p',
  passwordHash: DEFAULT_TENANT1_BOOTSTRAP_HASH,
  contactPerson: 'מחלקת אספקה ולוגיסטיקה',
  phone: '050-000-0000',
  address: 'בניין מרכזי',
  status: 'active',
  plan: 'pro',
  billing: {
    status: 'active',
    planId: 'pro',
    monthlyPriceNis: 279,
    paymentProvider: 'manual',
    subscriptionRenewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  limits: {
    maxWarehouses: 5,
    maxDepartments: 50,
    maxOrdersPerMonth: 50000,
    allowSelfWarehouseCreation: false,
  },
  spreadsheetId: DEFAULT_SPREADSHEET_ID,
  spreadsheetGid: DEFAULT_GID,
  createdAt: '2026-09-24T12:00:00.000Z',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_TENANT_MOSHAVA: Tenant = {
  id: 'tenant-1790255044467',
  name: 'Naot Moshava',
  slug: 'naot-moshava',
  login: 'aviad',
  passwordHash: DEFAULT_TENANT2_BOOTSTRAP_HASH,
  contactPerson: 'Aviad',
  phone: '',
  address: 'NesZiona HaPatish',
  status: 'active',
  plan: 'pro',
  billing: {
    status: 'active',
    planId: 'pro',
    monthlyPriceNis: 279,
    paymentProvider: 'manual',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  limits: {
    maxWarehouses: 5,
    maxDepartments: 100,
    maxOrdersPerMonth: 50000,
    allowSelfWarehouseCreation: false,
  },
  spreadsheetId: '',
  spreadsheetGid: '0',
  createdAt: '2026-09-24T13:04:04.468Z',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_INITIAL_TENANTS: Tenant[] = [
  DEFAULT_INITIAL_TENANT,
  DEFAULT_TENANT_MOSHAVA,
];

export const DEFAULT_INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-main-01',
    tenantId: 'tenant-main-01',
    name: 'מחסן מתכלים מרכזי',
    code: 'WH-01',
    isPrimary: true,
    address: 'קומת קרקע - אגף לוגיסטיקה',
    responsiblePerson: 'מנהל מחסן ראשי',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wh-main-02',
    tenantId: 'tenant-main-01',
    name: 'מחסן ציוד רפואי וחירום',
    code: 'WH-02',
    isPrimary: false,
    address: 'אגף ב׳ - קומה 1',
    responsiblePerson: 'אחראי מחסן משני',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'wh-moshava-01',
    tenantId: 'tenant-1790255044467',
    name: 'מחסן ראשי - Naot Moshava',
    code: 'WH-01',
    isPrimary: true,
    address: 'NesZiona HaPatish',
    responsiblePerson: 'Aviad',
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_INITIAL_WAREHOUSE: Warehouse = DEFAULT_INITIAL_WAREHOUSES[0];

function getStoredJson<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.warn(`Failed reading storage key "${key}":`, err);
    return defaultValue;
  }
}

function setStoredJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed writing storage key "${key}":`, err);
  }
}

/**
 * Initializes database with default tenants and warehouses if empty
 */
export function initMultiTenantDb(): void {
  const tenants = getStoredJson<Tenant[]>(TENANTS_KEY, []);
  if (tenants.length === 0) {
    setStoredJson(TENANTS_KEY, DEFAULT_INITIAL_TENANTS);
  }

  const warehouses = getStoredJson<Warehouse[]>(WAREHOUSES_KEY, []);
  if (warehouses.length === 0) {
    setStoredJson(WAREHOUSES_KEY, DEFAULT_INITIAL_WAREHOUSES);
  }
}

async function syncTenantToFirestore(tenant: Tenant): Promise<void> {
  try {
    if (!db) return;
    await ensureFirebaseAuth();
    const cleanPayload = JSON.parse(JSON.stringify(tenant));
    const docRef = doc(db, 'tenants', tenant.id);
    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (e) {
    console.warn('syncTenantToFirestore warning:', e);
  }
}

async function syncWarehouseToFirestore(warehouse: Warehouse): Promise<void> {
  try {
    if (!db) return;
    await ensureFirebaseAuth();
    const cleanWarehouse = JSON.parse(JSON.stringify(warehouse));
    const docRef = doc(db, 'tenants', warehouse.tenantId, 'warehouses', warehouse.id);
    await setDoc(docRef, cleanWarehouse, { merge: true });

    const allWarehouses = getStoredJson<Warehouse[]>(WAREHOUSES_KEY, DEFAULT_INITIAL_WAREHOUSES);
    const cleanList = JSON.parse(JSON.stringify(allWarehouses));
    const globalRef = doc(db, 'system', 'warehouses');
    await setDoc(globalRef, { list: cleanList, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('syncWarehouseToFirestore warning:', e);
  }
}

async function syncOrderToFirestore(order: MultiTenantOrder): Promise<void> {
  try {
    if (!db) return;
    await ensureFirebaseAuth();
    const cleanPayload = JSON.parse(JSON.stringify(order));
    const docRef = doc(db, 'tenants', order.tenantId, 'orders', order.id);
    await setDoc(docRef, cleanPayload, { merge: true });

    if (order.tenantId === 'tenant-main-01') {
      const globalRef = doc(db, 'orders', order.id);
      await setDoc(globalRef, cleanPayload, { merge: true });
    }
  } catch (e) {
    console.warn('syncOrderToFirestore warning:', e);
  }
}

// ----------------------------------------------------------------------------
// TENANT OPERATIONS
// ----------------------------------------------------------------------------

export function isTenantSecretWeak(tenant: Pick<Tenant, 'passwordHash'>): boolean {
  const hash = tenant?.passwordHash;
  if (!hash) return true;
  if (!isHashedSecret(hash)) return true;
  return BOOTSTRAP_HASHES.has(hash);
}

export function sortTenants(list: Tenant[]): Tenant[] {
  return [...list].sort((a, b) => {
    if (a.id === 'tenant-main-01') return -1;
    if (b.id === 'tenant-main-01') return 1;
    return a.name.localeCompare(b.name, 'he');
  });
}

export function getTenants(): Tenant[] {
  initMultiTenantDb();
  let list = getStoredJson<Tenant[]>(TENANTS_KEY, DEFAULT_INITIAL_TENANTS);
  let changed = false;

  list = list.map((t) => {
    if (t.id === 'tenant-main-01') {
      let updated = false;
      let name = t.name;
      let login = t.login;
      let passwordHash = t.passwordHash;

      // Migrate from old placeholder display name/login without ever resetting a changed password
      if (t.name === 'מרכז רפואי (סניף ראשי מרכזי)' || t.login === 'center1') {
        name = 'Naot Hatichon';
        login = 'andrey_p';
        if (!passwordHash) passwordHash = DEFAULT_TENANT1_BOOTSTRAP_HASH;
        updated = true;
      }

      let sId = t.spreadsheetId;
      let sGid = t.spreadsheetGid;
      if (!sId || sId === 'null' || sId === 'undefined') {
        sId = DEFAULT_SPREADSHEET_ID;
        updated = true;
      }
      if (!sGid || sGid === '0' || sGid === 'null' || sGid === 'undefined') {
        sGid = DEFAULT_GID;
        updated = true;
      }
      if (updated) {
        changed = true;
        return { ...t, name, login, passwordHash, spreadsheetId: sId, spreadsheetGid: sGid };
      }
    }
    return t;
  });

  // Ensure Naot Moshava is always included
  if (!list.some((t) => t.id === 'tenant-1790255044467' || t.slug === 'naot-moshava')) {
    list.push(DEFAULT_TENANT_MOSHAVA);
    changed = true;
  }

  const sortedList = sortTenants(list);
  if (changed || JSON.stringify(list) !== JSON.stringify(sortedList)) {
    setStoredJson(TENANTS_KEY, sortedList);
  }
  return sortedList;
}

/**
 * Returns branch metadata safe for public portals (strips passwordHash).
 */
export function getPublicTenants(): Tenant[] {
  return getTenants().map((t) => ({ ...t, passwordHash: '' }));
}

/**
 * Loads all tenants directly from Firestore into local cache
 */
export async function fetchTenantsFromFirestore(): Promise<Tenant[]> {
  try {
    if (!db) return getTenants();
    await ensureFirebaseAuth();
    const snap = await getDocs(collection(db, 'tenants'));
    if (!snap.empty) {
      const remoteList: Tenant[] = [];
      snap.forEach((d) => {
        const item = d.data() as Tenant;
        if (item && item.id && item.name) {
          remoteList.push(item);
        }
      });
      if (remoteList.length > 0) {
        const normalized = remoteList.map((t) => {
          if (t.id === 'tenant-main-01' && (t.name === 'מרכז רפואי (סניף ראשי מרכזי)' || t.login === 'center1')) {
            return {
              ...t,
              name: 'Naot Hatichon',
              login: 'andrey_p',
              passwordHash: t.passwordHash || DEFAULT_TENANT1_BOOTSTRAP_HASH,
            };
          }
          return t;
        });
        const sorted = sortTenants(normalized);
        setStoredJson(TENANTS_KEY, sorted);
        return sorted;
      }
    }
  } catch (err) {
    console.warn('fetchTenantsFromFirestore warning:', err);
  }
  return getTenants();
}

/**
 * Subscribes to real-time changes in Firestore collection 'tenants'
 */
export function subscribeToTenantsFirestore(callback: (tenants: Tenant[]) => void): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  ensureFirebaseAuth().finally(() => {
    if (cancelled || !db) return;
    try {
      unsub = onSnapshot(
        collection(db, 'tenants'),
        (snap) => {
          if (!snap.empty) {
            const list: Tenant[] = [];
            snap.forEach((d) => {
              const item = d.data() as Tenant;
              if (item && item.id && item.name) {
                list.push(item);
              }
            });
            if (list.length > 0) {
              const sorted = sortTenants(list);
              setStoredJson(TENANTS_KEY, sorted);
              callback(sorted);
            }
          }
        },
        (err) => {
          console.warn('Realtime tenants listener warning:', err);
        }
      );
    } catch {
      // Offline / permission fallback handled locally
    }
  });

  return () => {
    cancelled = true;
    if (unsub) {
      try {
        unsub();
      } catch {}
    }
  };
}

export function getTenantById(tenantId: string): Tenant | null {
  const tenants = getTenants();
  return tenants.find((t) => t.id === tenantId) || null;
}

export async function createTenant(data: {
  name: string;
  login: string;
  password: string;
  plan?: PlanType;
  contactPerson?: string;
  phone?: string;
  address?: string;
  spreadsheetId?: string;
  spreadsheetGid?: string;
  allowSelfWarehouseCreation?: boolean;
  cloneBaseCatalog?: boolean;
  initialDepartments?: string[];
}): Promise<Tenant> {
  const tenants = getTenants();
  const plan = data.plan || 'starter';
  const planConfig = BILLING_PLANS[plan];

  const newTenantId = `tenant-${Date.now()}`;
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9א-ת]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `tenant-${Date.now()}`;

  const rawPassword = (data.password || '').trim();
  if (!rawPassword) {
    throw new Error('נדרשת סיסמה ליצירת סניף חדש.');
  }
  const passwordHash = isHashedSecret(rawPassword)
    ? rawPassword
    : await hashSecret(rawPassword);

  const newTenant: Tenant = {
    id: newTenantId,
    name: data.name.trim(),
    slug,
    login: data.login.trim(),
    passwordHash,
    contactPerson: data.contactPerson?.trim(),
    phone: data.phone?.trim(),
    address: data.address?.trim(),
    status: 'active',
    plan,
    billing: {
      status: 'active',
      planId: plan,
      monthlyPriceNis: planConfig.priceMonthlyNis,
      paymentProvider: 'manual',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    limits: {
      maxWarehouses: planConfig.maxWarehouses,
      maxDepartments: planConfig.maxDepartments,
      maxOrdersPerMonth: planConfig.maxOrdersPerMonth,
      allowSelfWarehouseCreation: data.allowSelfWarehouseCreation ?? false,
    },
    spreadsheetId: data.spreadsheetId?.trim() || '',
    spreadsheetGid: data.spreadsheetGid?.trim() || '0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tenants.push(newTenant);
  setStoredJson(TENANTS_KEY, tenants);
  await syncTenantToFirestore(newTenant);

  const primaryWh = createWarehouse({
    tenantId: newTenantId,
    name: `מחסן ראשי - ${newTenant.name}`,
    code: 'WH-01',
    isPrimary: true,
    address: newTenant.address || 'בניין ראשי',
  });

  // 1. If custom initial departments are provided, save them right away
  const hasCustomDepts = Array.isArray(data.initialDepartments) && data.initialDepartments.length > 0;
  if (hasCustomDepts) {
    const customDepts: TenantDepartment[] = (data.initialDepartments || []).map((dName, idx) => ({
      id: `dept-${newTenantId}-${idx}-${Date.now()}`,
      tenantId: newTenantId,
      name: dName.trim(),
      pinCode: '1234',
    }));
    saveTenantDepartments(newTenantId, customDepts);
  }

  // 2. Automatically clone the base catalog template (186 items)
  if (data.cloneBaseCatalog !== false) {
    try {
      cloneBaseCatalogToNewTenant(newTenantId, primaryWh.id, 'tenant-main-01', !hasCustomDepts);
    } catch (e) {
      console.warn('Failed to clone base catalog to new tenant:', e);
    }
  }

  return newTenant;
}

export function stockMapToInventoryProducts(
  stockMap: Record<string, StockItem>,
  tenantId: string,
  warehouseId: string = 'wh-main-01'
): InventoryProduct[] {
  return Object.values(stockMap).map((s, idx) => ({
    id: s.id || `prod-${tenantId}-${idx}`,
    tenantId,
    warehouseId,
    name: s.name,
    colIndex: s.colIndex ?? idx + 1,
    currentStock: Number(s.currentStock) || 0,
    minThreshold: Number(s.minThreshold) || 10,
    unit: s.unit || "יח'",
    ...(s.packageSize !== undefined ? { packageSize: s.packageSize } : {}),
    ...(s.packagingMode !== undefined ? { packagingMode: s.packagingMode } : {}),
    isActive: s.isActive !== false,
    limitByPatients: Boolean(s.limitByPatients),
    updatedAt: s.lastUpdated || new Date().toISOString(),
  }));
}

export function inventoryProductsToStockMap(
  items: InventoryProduct[]
): Record<string, StockItem> {
  const stockMap: Record<string, StockItem> = {};
  items.forEach((item, idx) => {
    stockMap[item.name] = {
      id: item.id,
      name: item.name,
      unit: item.unit || "יח'",
      ...(item.packageSize !== undefined ? { packageSize: item.packageSize } : {}),
      ...(item.packagingMode !== undefined ? { packagingMode: item.packagingMode } : {}),
      currentStock: Number(item.currentStock) || 0,
      minThreshold: Number(item.minThreshold) || 10,
      colIndex: item.colIndex || idx + 1,
      isActive: item.isActive !== false,
      limitByPatients: Boolean(item.limitByPatients),
      lastUpdated: item.updatedAt,
    };
  });
  return stockMap;
}

/**
 * Clones the Base Master Catalog (all 186 items, order, packaging, and thresholds)
 * and optionally departments into a newly created branch/tenant.
 */
export function cloneBaseCatalogToNewTenant(
  targetTenantId: string,
  targetWarehouseId: string,
  sourceTenantId: string = 'tenant-main-01',
  cloneDepartments: boolean = true
): InventoryProduct[] {
  // 1. Get base inventory items from source tenant or fallback to local db stock
  let baseItems = getInventory(sourceTenantId);
  if (!baseItems || baseItems.length === 0) {
    const localStock = getDbStock();
    baseItems = stockMapToInventoryProducts(localStock, sourceTenantId, 'wh-main-01').map((item) => ({
      ...item,
      currentStock: 0,
    }));
  }

  // 2. Clone products for the new branch with currentStock starting at 0 (preserving packaging rules)
  const newTenantItems: InventoryProduct[] = baseItems.map((item, idx) => ({
    ...item,
    id: `prod-${targetTenantId}-${idx}-${Date.now()}`,
    tenantId: targetTenantId,
    warehouseId: targetWarehouseId,
    currentStock: 0,
    updatedAt: new Date().toISOString(),
  }));

  saveInventory(targetTenantId, newTenantItems);

  // 3. Clone departments for the new branch ONLY if requested and target has no departments yet
  const existingTargetDepts = getTenantDepartments(targetTenantId);
  if (cloneDepartments && existingTargetDepts.length === 0) {
    const sourceDepts = getTenantDepartments(sourceTenantId);
    const baseDepts: TenantDepartment[] =
      sourceDepts.length > 0
        ? sourceDepts
        : CANONICAL_DEPARTMENTS.map((d, i) => ({ id: `dept-${i}`, tenantId: sourceTenantId, name: d, pinCode: '1234' }));
    const newDepts: TenantDepartment[] = baseDepts.map((d, i) => ({
      id: `dept-${targetTenantId}-${i}`,
      tenantId: targetTenantId,
      name: d.name,
      pinCode: d.pinCode || '1234',
    }));
    saveTenantDepartments(targetTenantId, newDepts);
  }

  // 4. Also seed master_stock directly in Firestore for real-time syncing
  if (db) {
    const firestoreRef = db;
    ensureFirebaseAuth()
      .then(() => {
        const stockMap = inventoryProductsToStockMap(newTenantItems);
        const cleanStockMap = JSON.parse(JSON.stringify(stockMap));
        const docRef = doc(firestoreRef, 'tenants', targetTenantId, 'warehouse', 'master_stock');
        return setDoc(docRef, {
          stock: cleanStockMap,
          totalItems: Object.keys(cleanStockMap).length,
          updatedAt: new Date().toISOString(),
        });
      })
      .catch((e) => console.warn('Failed to seed master_stock in Firestore for new tenant:', e));
  }

  return newTenantItems;
}

export async function updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
  const tenants = getTenants();
  const index = tenants.findIndex((t) => t.id === tenantId);
  if (index === -1) return null;

  let resolvedPasswordHash = tenants[index].passwordHash;
  if (updates.passwordHash !== undefined) {
    const trimmed = updates.passwordHash.trim();
    if (trimmed) {
      resolvedPasswordHash = isHashedSecret(trimmed) ? trimmed : await hashSecret(trimmed);
    }
  }

  const updated: Tenant = {
    ...tenants[index],
    ...updates,
    passwordHash: resolvedPasswordHash,
    updatedAt: new Date().toISOString(),
  };

  tenants[index] = updated;
  setStoredJson(TENANTS_KEY, tenants);
  await syncTenantToFirestore(updated);
  return updated;
}

export function deleteTenant(tenantId: string): boolean {
  let tenants = getTenants();
  const initialLen = tenants.length;
  tenants = tenants.filter((t) => t.id !== tenantId);
  if (tenants.length === initialLen) return false;

  setStoredJson(TENANTS_KEY, tenants);
  if (db) {
    const firestoreRef = db;
    ensureFirebaseAuth()
      .then(() => deleteDoc(doc(firestoreRef, 'tenants', tenantId)))
      .catch(console.warn);
  }
  return true;
}

// ----------------------------------------------------------------------------
// WAREHOUSE OPERATIONS
// ----------------------------------------------------------------------------

export function getWarehouses(tenantId?: string): Warehouse[] {
  initMultiTenantDb();
  let all = getStoredJson<Warehouse[]>(WAREHOUSES_KEY, DEFAULT_INITIAL_WAREHOUSES);
  if (all.length < DEFAULT_INITIAL_WAREHOUSES.length) {
    const existingIds = new Set(all.map((w) => w.id));
    let added = false;
    DEFAULT_INITIAL_WAREHOUSES.forEach((dw) => {
      if (!existingIds.has(dw.id)) {
        all.push(dw);
        added = true;
      }
    });
    if (added) {
      setStoredJson(WAREHOUSES_KEY, all);
    }
  }
  if (!tenantId) return all;
  return all.filter((w) => w.tenantId === tenantId);
}

/**
 * Loads all system warehouses from Firestore
 */
export async function fetchWarehousesFromFirestore(): Promise<Warehouse[]> {
  try {
    if (!db) return getWarehouses();
    await ensureFirebaseAuth();
    const globalRef = doc(db, 'system', 'warehouses');
    const snap = await getDoc(globalRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.list) && data.list.length > 0) {
        setStoredJson(WAREHOUSES_KEY, data.list);
        return data.list;
      }
    }
  } catch (err) {
    console.warn('fetchWarehousesFromFirestore warning:', err);
  }
  return getWarehouses();
}

export function getWarehouseById(warehouseId: string): Warehouse | null {
  const all = getWarehouses();
  return all.find((w) => w.id === warehouseId) || null;
}

export function createWarehouse(data: {
  tenantId: string;
  name: string;
  code?: string;
  isPrimary?: boolean;
  address?: string;
  responsiblePerson?: string;
}): Warehouse {
  const all = getWarehouses();
  const newWarehouse: Warehouse = {
    id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tenantId: data.tenantId,
    name: data.name.trim(),
    code: data.code?.trim() || `WH-${all.length + 1}`,
    isPrimary: data.isPrimary ?? false,
    address: data.address?.trim(),
    responsiblePerson: data.responsiblePerson?.trim(),
    createdAt: new Date().toISOString(),
  };

  all.push(newWarehouse);
  setStoredJson(WAREHOUSES_KEY, all);
  syncWarehouseToFirestore(newWarehouse).catch(console.warn);
  return newWarehouse;
}

export function updateWarehouse(warehouseId: string, updates: Partial<Warehouse>): Warehouse | null {
  const all = getWarehouses();
  const index = all.findIndex((w) => w.id === warehouseId);
  if (index === -1) return null;

  all[index] = { ...all[index], ...updates };
  setStoredJson(WAREHOUSES_KEY, all);
  syncWarehouseToFirestore(all[index]).catch(console.warn);
  return all[index];
}

// ----------------------------------------------------------------------------
// INVENTORY OPERATIONS
// ----------------------------------------------------------------------------

export function getInventory(tenantId: string, warehouseId?: string): InventoryProduct[] {
  const key = `${INVENTORY_KEY}${tenantId}`;
  const all = getStoredJson<InventoryProduct[]>(key, []);
  if (!warehouseId) return all;
  return all.filter((item) => item.warehouseId === warehouseId);
}

export function saveInventory(tenantId: string, items: InventoryProduct[]): void {
  const key = `${INVENTORY_KEY}${tenantId}`;
  setStoredJson(key, items);
  syncInventoryToFirestore(tenantId, items).catch(console.warn);
}

async function syncInventoryToFirestore(tenantId: string, items: InventoryProduct[]): Promise<void> {
  try {
    if (!db) return;
    await ensureFirebaseAuth();
    const cleanItems = JSON.parse(JSON.stringify(items));
    const docRef = doc(db, 'tenants', tenantId, 'inventory_data', 'all_items');
    await setDoc(docRef, { items: cleanItems, updatedAt: new Date().toISOString() });
  } catch {
    // Offline resilience
  }
}

export async function fetchInventoryFromFirestore(tenantId: string): Promise<InventoryProduct[] | null> {
  try {
    if (!db) return null;
    await ensureFirebaseAuth();
    const docRef = doc(db, 'tenants', tenantId, 'inventory_data', 'all_items');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.items && Array.isArray(data.items)) {
        // Cache locally ONLY — never echo remote reads back to Firestore
        setStoredJson(`${INVENTORY_KEY}${tenantId}`, data.items);
        return data.items;
      }
    }
    return null;
  } catch (e) {
    console.warn('Could not fetch remote inventory from Firestore:', e);
    return null;
  }
}

export function updateInventoryStock(
  tenantId: string,
  warehouseId: string,
  productId: string,
  newStock: number,
  unit?: string,
  minThreshold?: number
): void {
  const items = getInventory(tenantId);
  const index = items.findIndex((i) => i.id === productId && i.warehouseId === warehouseId);
  if (index !== -1) {
    items[index] = {
      ...items[index],
      currentStock: Math.max(0, newStock),
      ...(unit ? { unit } : {}),
      ...(minThreshold !== undefined ? { minThreshold } : {}),
      updatedAt: new Date().toISOString(),
    };
    saveInventory(tenantId, items);
  }
}

/**
 * Returns a standardized Record<string, StockItem> for any tenant,
 * converting their isolated inventory into the application stock format.
 */
export function getTenantStockMap(tenantId: string): Record<string, StockItem> {
  if (tenantId === 'tenant-main-01') {
    return getDbStock();
  }
  const inv = getInventory(tenantId);
  return inventoryProductsToStockMap(inv);
}

// ----------------------------------------------------------------------------
// DEPARTMENTS OPERATIONS
// ----------------------------------------------------------------------------

export function getTenantDepartments(tenantId: string): TenantDepartment[] {
  const key = `${DEPARTMENTS_KEY}${tenantId}`;
  const stored = getStoredJson<TenantDepartment[]>(key, []);

  // For main hospital tenant, seed canonical departments ONLY when empty so admin edits/deletions persist
  if (tenantId === 'tenant-main-01') {
    if (stored.length > 0) {
      return stored;
    }
    const defaultList: TenantDepartment[] = CANONICAL_DEPARTMENTS.map((dName, idx) => ({
      id: `dept-${idx}`,
      tenantId,
      name: dName,
      pinCode: '1234',
    }));
    saveTenantDepartments(tenantId, defaultList);
    return defaultList;
  }

  // For Naot Moshava, ensure 2 default departments matching live setup
  if (tenantId === 'tenant-1790255044467') {
    if (stored.length > 0) {
      return stored;
    }
    const moshavaList: TenantDepartment[] = [
      { id: 'dept-moshava-1', tenantId, name: 'מחלקה א׳', pinCode: '1234' },
      { id: 'dept-moshava-2', tenantId, name: 'מחלקה ב׳', pinCode: '1234' },
    ];
    saveTenantDepartments(tenantId, moshavaList);
    return moshavaList;
  }

  // For other tenants, return their stored custom departments without canonical restriction
  return stored || [];
}

export function saveTenantDepartments(tenantId: string, departments: TenantDepartment[]): void {
  const key = `${DEPARTMENTS_KEY}${tenantId}`;
  const cleaned = (departments || []).filter((d) => d && d.name && d.name.trim().length > 0);
  setStoredJson(key, cleaned);
  if (tenantId === 'tenant-main-01') {
    saveDbDepartments(cleaned.map((d) => d.name));
  }
  if (db) {
    const firestoreRef = db;
    ensureFirebaseAuth()
      .then(() => {
        const docRef = doc(firestoreRef, 'tenants', tenantId, 'departments_data', 'all');
        return setDoc(docRef, { list: cleaned, updatedAt: new Date().toISOString() }, { merge: true });
      })
      .catch(console.warn);
  }
}

export async function fetchTenantDepartmentsFromFirestore(tenantId: string): Promise<TenantDepartment[]> {
  try {
    if (!db) return getTenantDepartments(tenantId);
    await ensureFirebaseAuth();
    const docRef = doc(db, 'tenants', tenantId, 'departments_data', 'all');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.list) && data.list.length > 0) {
        let list = data.list as TenantDepartment[];
        if (tenantId === 'tenant-main-01') {
          const listNames = new Set(list.map((d) => d.name));
          let changed = false;
          CANONICAL_DEPARTMENTS.forEach((cDept, idx) => {
            if (!listNames.has(cDept)) {
              list.push({
                id: `dept-canonical-${idx}`,
                tenantId,
                name: cDept,
                pinCode: '1234',
              });
              changed = true;
            }
          });
          if (changed) {
            saveTenantDepartments(tenantId, list);
          } else {
            setStoredJson(`${DEPARTMENTS_KEY}${tenantId}`, list);
            saveDbDepartments(list.map((d) => d.name));
          }
        } else {
          setStoredJson(`${DEPARTMENTS_KEY}${tenantId}`, list);
        }
        return list;
      }
    }
  } catch (err) {
    console.warn('fetchTenantDepartmentsFromFirestore warning:', err);
  }
  return getTenantDepartments(tenantId);
}

export function subscribeToTenantDepartments(
  tenantId: string,
  onDepartmentsUpdated: (departments: TenantDepartment[]) => void
): () => void {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  if (db) {
    const firestoreRef = db;
    ensureFirebaseAuth().finally(() => {
      if (cancelled) return;
      try {
        const docRef = doc(firestoreRef, 'tenants', tenantId, 'departments_data', 'all');
        unsub = onSnapshot(
          docRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              if (Array.isArray(data?.list) && data.list.length > 0) {
                let list = data.list as TenantDepartment[];
                if (tenantId === 'tenant-main-01') {
                  const listNames = new Set(list.map((d) => d.name));
                  let changed = false;
                  CANONICAL_DEPARTMENTS.forEach((cDept, idx) => {
                    if (!listNames.has(cDept)) {
                      list.push({
                        id: `dept-canonical-${idx}`,
                        tenantId,
                        name: cDept,
                        pinCode: '1234',
                      });
                      changed = true;
                    }
                  });
                  if (changed) {
                    saveTenantDepartments(tenantId, list);
                  } else {
                    setStoredJson(`${DEPARTMENTS_KEY}${tenantId}`, list);
                    saveDbDepartments(list.map((d) => d.name));
                  }
                } else {
                  setStoredJson(`${DEPARTMENTS_KEY}${tenantId}`, list);
                }
                onDepartmentsUpdated(list);
              }
            }
          },
          (err) => console.warn('subscribeToTenantDepartments error:', err)
        );
      } catch (e) {
        console.warn('subscribeToTenantDepartments init error:', e);
      }
    });
  }

  return () => {
    cancelled = true;
    if (unsub) {
      try {
        unsub();
      } catch {}
    }
  };
}

export function addTenantDepartment(tenantId: string, name: string, pinCode?: string): TenantDepartment {
  const depts = getTenantDepartments(tenantId);
  const newDept: TenantDepartment = {
    id: `dept-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tenantId,
    name: name.trim(),
    pinCode: pinCode?.trim() || '1234',
  };
  depts.push(newDept);
  saveTenantDepartments(tenantId, depts);
  return newDept;
}

// ----------------------------------------------------------------------------
// ORDERS OPERATIONS
// ----------------------------------------------------------------------------

const PURGED_TEST_ORDER_IDS = new Set([
  'order-1788682740035-140',
  'order-test-1788673384415',
  'order-test-check',
  'הזמנה #332',
  'הזמנה #333',
]);

export function getTenantOrders(tenantId: string, warehouseId?: string): MultiTenantOrder[] {
  const key = `${ORDERS_KEY}${tenantId}`;
  let orders = getStoredJson<MultiTenantOrder[]>(key, []);
  const initialLen = orders.length;

  // Strict tenant isolation: ensure orders strictly belong to this tenant
  if (tenantId === 'tenant-main-01') {
    // For main hospital, orders can be explicitly tenant-main-01 or legacy orders without tenantId
    orders = orders.filter((o) => o && o.id && !PURGED_TEST_ORDER_IDS.has(o.id) && (!o.tenantId || o.tenantId === 'tenant-main-01'));
  } else {
    // For any other tenant, orders MUST explicitly have this tenant's tenantId!
    orders = orders.filter((o) => o && o.id && !PURGED_TEST_ORDER_IDS.has(o.id) && o.tenantId === tenantId);
  }

  if (orders.length !== initialLen) {
    setStoredJson(key, orders);
  }
  if (!warehouseId) return orders;
  return orders.filter((o) => o.warehouseId === warehouseId);
}

export function saveTenantOrders(tenantId: string, orders: MultiTenantOrder[]): void {
  const key = `${ORDERS_KEY}${tenantId}`;
  // Ensure we only save orders that belong to this tenant
  const cleaned = (orders || []).filter((o) => {
    if (!o || !o.id) return false;
    if (tenantId === 'tenant-main-01') {
      return !o.tenantId || o.tenantId === 'tenant-main-01';
    }
    return o.tenantId === tenantId;
  });
  setStoredJson(key, cleaned);
}

export function createTenantOrder(tenantId: string, orderData: Omit<MultiTenantOrder, 'id' | 'createdAt' | 'orderNumber'>): MultiTenantOrder {
  const orders = getTenantOrders(tenantId);
  const now = new Date();
  const orderNum = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(orders.length + 1).padStart(4, '0')}`;

  const newOrder: MultiTenantOrder = {
    ...orderData,
    id: `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    orderNumber: orderNum,
    createdAt: now.toISOString(),
  };

  orders.unshift(newOrder);
  saveTenantOrders(tenantId, orders);
  syncOrderToFirestore(newOrder).catch(console.warn);
  return newOrder;
}

export function updateOrderStatus(
  tenantId: string,
  orderId: string,
  status: MultiTenantOrder['status'],
  printed?: boolean
): MultiTenantOrder | null {
  const orders = getTenantOrders(tenantId);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;

  orders[idx] = {
    ...orders[idx],
    status,
    ...(printed !== undefined ? { printed, printedAt: printed ? new Date().toISOString() : undefined } : {}),
  };

  saveTenantOrders(tenantId, orders);
  syncOrderToFirestore(orders[idx]).catch(console.warn);
  return orders[idx];
}

export function deleteTenantOrder(tenantId: string, orderId: string): boolean {
  const orders = getTenantOrders(tenantId);
  const initialLen = orders.length;
  const filtered = orders.filter(
    (o) => o.id !== orderId && !orderId.includes(o.orderNumber) && (o.id ? !orderId.includes(o.id) : true)
  );
  if (filtered.length !== initialLen) {
    saveTenantOrders(tenantId, filtered);
    return true;
  }
  return false;
}

export function clearAllTenantOrders(tenantId: string, departmentName?: string): void {
  const key = `${ORDERS_KEY}${tenantId}`;
  if (!departmentName) {
    setStoredJson(key, []);
    return;
  }
  const orders = getTenantOrders(tenantId);
  const remaining = orders.filter(
    (o) => o.departmentName !== departmentName && (o as any).department !== departmentName
  );
  setStoredJson(key, remaining);
}


// ----------------------------------------------------------------------------
// AUTHENTICATION & SESSION
// ----------------------------------------------------------------------------

interface AuthThrottleState {
  failures: number;
  lockedUntil?: number;
}

function getAuthThrottle(): AuthThrottleState {
  return getStoredJson<AuthThrottleState>(AUTH_THROTTLE_KEY, { failures: 0 });
}

function recordAuthFailure(): AuthThrottleState {
  const current = getAuthThrottle();
  const failures = (current.failures || 0) + 1;
  const next: AuthThrottleState =
    failures >= 5
      ? { failures, lockedUntil: Date.now() + 60 * 1000 }
      : { failures };
  setStoredJson(AUTH_THROTTLE_KEY, next);
  return next;
}

function resetAuthThrottle(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(AUTH_THROTTLE_KEY);
    } catch {}
  }
}

async function fetchSuperAdminPasswordHash(): Promise<string> {
  const localConfig = getStoredJson<{ passwordHash?: string } | null>(SUPERADMIN_AUTH_KEY, null);
  let resolvedHash = localConfig?.passwordHash || DEFAULT_SUPERADMIN_BOOTSTRAP_HASH;

  if (db) {
    try {
      await ensureFirebaseAuth();
      const snap = await getDoc(doc(db, 'system', 'auth_config'));
      if (snap.exists()) {
        const remoteHash = (snap.data() as { passwordHash?: string })?.passwordHash;
        if (remoteHash && typeof remoteHash === 'string') {
          resolvedHash = remoteHash;
          setStoredJson(SUPERADMIN_AUTH_KEY, { passwordHash: remoteHash });
        }
      }
    } catch (e) {
      console.warn('Could not fetch system auth config from Firestore:', e);
    }
  }
  return resolvedHash;
}

export async function updateSuperAdminPassword(currentPassword: string, newPassword: string): Promise<void> {
  const nextPlain = newPassword.trim();
  if (nextPlain.length < 8) {
    throw new Error('סיסמה חדשה חייבת להכיל לפחות 8 תווים.');
  }
  const currentHash = await fetchSuperAdminPasswordHash();
  const verification = await verifySecret(currentPassword, currentHash);
  if (!verification.matches) {
    throw new Error('הסיסמה הנוכחית שגויה.');
  }

  const nextHash = await hashSecret(nextPlain);
  const payload = { passwordHash: nextHash, updatedAt: new Date().toISOString() };
  setStoredJson(SUPERADMIN_AUTH_KEY, payload);

  if (db) {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'system', 'auth_config'), payload, { merge: true });
  }

  const currentSession = getActiveAuthSession();
  if (currentSession && currentSession.userRole === 'superadmin') {
    saveAuthSession({ ...currentSession, isWeakPassword: false });
  }
}

export async function authenticateUser(
  login: string,
  password: string,
  options?: { expectedRole?: 'superadmin' | 'tenant_admin' }
): Promise<AuthSession | null> {
  const throttle = getAuthThrottle();
  if (throttle.lockedUntil && throttle.lockedUntil > Date.now()) {
    const secs = Math.max(1, Math.ceil((throttle.lockedUntil - Date.now()) / 1000));
    throw new Error(`בוצעו יותר מדי ניסיונות כניסה כושלים. נא להמתין ${secs} שניות ולנסות שוב.`);
  }

  const trimmedLogin = login.trim().toLowerCase();
  const trimmedPass = password.trim();
  if (!trimmedLogin || !trimmedPass) {
    return null;
  }

  // 1. Check SuperAdmin (when allowed by active login tab)
  if (options?.expectedRole !== 'tenant_admin' && trimmedLogin === DEFAULT_SUPERADMIN_LOGIN) {
    const superHash = await fetchSuperAdminPasswordHash();
    const superVerify = await verifySecret(trimmedPass, superHash);
    if (superVerify.matches) {
      const wasBootstrap = BOOTSTRAP_HASHES.has(superHash) || !isHashedSecret(superHash) || trimmedPass.length < 8;
      if (superVerify.needsUpgrade) {
        try {
          const upgradedHash = await hashSecret(trimmedPass);
          const cfg = { passwordHash: upgradedHash, updatedAt: new Date().toISOString() };
          setStoredJson(SUPERADMIN_AUTH_KEY, cfg);
          if (db) {
            ensureFirebaseAuth()
              .then(() => setDoc(doc(db!, 'system', 'auth_config'), cfg, { merge: true }))
              .catch(console.warn);
          }
        } catch {}
      }

      resetAuthThrottle();
      const session: AuthSession = {
        userRole: 'superadmin',
        username: SUPERADMIN_DISPLAY_NAME,
        token: `sa_${generateSessionToken()}`,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        isWeakPassword: wasBootstrap,
      };
      saveAuthSession(session);
      return session;
    }
  }

  // 2. Check Tenant Admins (fetch latest from Firestore when online so remote password updates work)
  if (options?.expectedRole !== 'superadmin') {
    const tenants = await fetchTenantsFromFirestore().catch(() => getTenants());
    const matchingTenants = tenants.filter((t) => {
      const tLogin = (t.login || '').trim().toLowerCase();
      const tSlug = (t.slug || '').trim().toLowerCase();
      return (
        tLogin === trimmedLogin ||
        (tSlug.length > 0 && tSlug === trimmedLogin) ||
        (t.id === 'tenant-main-01' && trimmedLogin === 'andrey_p')
      );
    });

    for (const foundTenant of matchingTenants) {
      const passCheck = await verifySecret(trimmedPass, foundTenant.passwordHash);
      if (passCheck.matches) {
        if (foundTenant.status === 'suspended') {
          throw new Error('סניף זה מושעה זמנית. אנא פנה למנהל המערכת.');
        }

        const wasWeak =
          BOOTSTRAP_HASHES.has(foundTenant.passwordHash) ||
          !isHashedSecret(foundTenant.passwordHash) ||
          trimmedPass.length < 8;

        if (passCheck.needsUpgrade) {
          try {
            const upgradedHash = await hashSecret(trimmedPass);
            const updatedTenants = tenants.map((item) =>
              item.id === foundTenant.id
                ? { ...item, passwordHash: upgradedHash, updatedAt: new Date().toISOString() }
                : item
            );
            setStoredJson(TENANTS_KEY, sortTenants(updatedTenants));
            const upgradedTenant = updatedTenants.find((item) => item.id === foundTenant.id);
            if (upgradedTenant) syncTenantToFirestore(upgradedTenant).catch(console.warn);
          } catch {}
        }

        resetAuthThrottle();
        const session: AuthSession = {
          userRole: 'tenant_admin',
          tenantId: foundTenant.id,
          tenantName: foundTenant.name,
          username: foundTenant.name,
          token: `tn_${generateSessionToken()}`,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
          isWeakPassword: wasWeak,
        };
        saveAuthSession(session);
        return session;
      }
    }
  }

  const nextThrottle = recordAuthFailure();
  if (nextThrottle.lockedUntil && nextThrottle.lockedUntil > Date.now()) {
    throw new Error('בוצעו 5 ניסיונות כניסה שגויים. הגישה נחסמה זמנית למשך 60 שניות.');
  }
  return null;
}

export function getActiveAuthSession(): AuthSession | null {
  const session = getStoredJson<AuthSession | null>(AUTH_SESSION_KEY, null);
  if (!session || !session.userRole || !session.token) {
    return null;
  }
  if (session.expiresAt) {
    const expMs = new Date(session.expiresAt).getTime();
    if (Number.isNaN(expMs) || expMs <= Date.now()) {
      logout();
      return null;
    }
  } else {
    // Reject legacy unexpiring sessions and ask admin to log in cleanly with TTL
    logout();
    return null;
  }
  return session;
}

export function saveAuthSession(session: AuthSession | null): void {
  if (!session) {
    if (typeof window !== 'undefined') localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  setStoredJson(AUTH_SESSION_KEY, session);
}

export function logout(): void {
  saveAuthSession(null);
}
