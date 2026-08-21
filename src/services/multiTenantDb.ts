import {
  Tenant,
  Warehouse,
  InventoryProduct,
  TenantDepartment,
  MultiTenantOrder,
  AuthSession,
  PlanType,
  STANDARD_PACKAGING_UNITS,
} from '../types/multiTenant';
import { DEFAULT_SPREADSHEET_ID, DEFAULT_GID } from '../utils/googleSheets';
import { db } from './firebase';
import {
  doc,
  setDoc,
} from 'firebase/firestore';

const STORAGE_KEY_PREFIX = 'storeprint_mt_v1_';
const TENANTS_KEY = `${STORAGE_KEY_PREFIX}tenants`;
const WAREHOUSES_KEY = `${STORAGE_KEY_PREFIX}warehouses`;
const INVENTORY_KEY = `${STORAGE_KEY_PREFIX}inventory_`;
const DEPARTMENTS_KEY = `${STORAGE_KEY_PREFIX}departments_`;
const ORDERS_KEY = `${STORAGE_KEY_PREFIX}orders_`;
const AUTH_SESSION_KEY = `${STORAGE_KEY_PREFIX}auth_session`;

export const SUPERADMIN_CREDENTIALS = {
  login: 'admin',
  password: 'admin123',
  name: 'מנהל מערכת ראשי (SuperAdmin)',
};

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

// Initial Default Tenant (Preserves current Israeli working setup)
const DEFAULT_INITIAL_TENANT: Tenant = {
  id: 'tenant-main-01',
  name: 'מרכז רפואי (סניף ראשי מרכזי)',
  slug: 'main-center',
  login: 'center1',
  passwordHash: 'pass123',
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DEFAULT_INITIAL_WAREHOUSE: Warehouse = {
  id: 'wh-main-01',
  tenantId: 'tenant-main-01',
  name: 'מחסן מתכלים מרכזי',
  code: 'WH-01',
  isPrimary: true,
  address: 'קומת קרקע - אגף לוגיסטיקה',
  responsiblePerson: 'מנהל מחסן ראשי',
  createdAt: new Date().toISOString(),
};

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
 * Initializes database with default tenant and warehouse if empty
 */
export function initMultiTenantDb(): void {
  const tenants = getStoredJson<Tenant[]>(TENANTS_KEY, []);
  if (tenants.length === 0) {
    setStoredJson(TENANTS_KEY, [DEFAULT_INITIAL_TENANT]);
    syncTenantToFirestore(DEFAULT_INITIAL_TENANT).catch(console.warn);
  }

  const warehouses = getStoredJson<Warehouse[]>(WAREHOUSES_KEY, []);
  if (warehouses.length === 0) {
    setStoredJson(WAREHOUSES_KEY, [DEFAULT_INITIAL_WAREHOUSE]);
  }
}

async function syncTenantToFirestore(tenant: Tenant): Promise<void> {
  try {
    if (!db) return;
    const docRef = doc(db, 'tenants', tenant.id);
    await setDoc(docRef, tenant, { merge: true });
  } catch (e) {}
}

async function syncWarehouseToFirestore(warehouse: Warehouse): Promise<void> {
  try {
    if (!db) return;
    const docRef = doc(db, 'tenants', warehouse.tenantId, 'warehouses', warehouse.id);
    await setDoc(docRef, warehouse, { merge: true });
  } catch (e) {}
}

async function syncOrderToFirestore(order: MultiTenantOrder): Promise<void> {
  try {
    if (!db) return;
    const docRef = doc(db, 'tenants', order.tenantId, 'orders', order.id);
    await setDoc(docRef, order, { merge: true });
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// TENANT OPERATIONS
// ----------------------------------------------------------------------------

export function getTenants(): Tenant[] {
  initMultiTenantDb();
  return getStoredJson<Tenant[]>(TENANTS_KEY, [DEFAULT_INITIAL_TENANT]);
}

export function getTenantById(tenantId: string): Tenant | null {
  const tenants = getTenants();
  return tenants.find((t) => t.id === tenantId) || null;
}

export function createTenant(data: {
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
}): Tenant {
  const tenants = getTenants();
  const plan = data.plan || 'starter';
  const planConfig = BILLING_PLANS[plan];

  const newTenantId = `tenant-${Date.now()}`;
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9א-ת]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `tenant-${Date.now()}`;

  const newTenant: Tenant = {
    id: newTenantId,
    name: data.name.trim(),
    slug,
    login: data.login.trim(),
    passwordHash: data.password.trim(),
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
  syncTenantToFirestore(newTenant).catch(console.warn);

  createWarehouse({
    tenantId: newTenantId,
    name: `מחסן ראשי - ${newTenant.name}`,
    code: 'WH-01',
    isPrimary: true,
    address: newTenant.address || 'בניין ראשי',
  });

  return newTenant;
}

export function updateTenant(tenantId: string, updates: Partial<Tenant>): Tenant | null {
  const tenants = getTenants();
  const index = tenants.findIndex((t) => t.id === tenantId);
  if (index === -1) return null;

  const updated: Tenant = {
    ...tenants[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  tenants[index] = updated;
  setStoredJson(TENANTS_KEY, tenants);
  syncTenantToFirestore(updated).catch(console.warn);
  return updated;
}

export function deleteTenant(tenantId: string): boolean {
  let tenants = getTenants();
  const initialLen = tenants.length;
  tenants = tenants.filter((t) => t.id !== tenantId);
  if (tenants.length === initialLen) return false;

  setStoredJson(TENANTS_KEY, tenants);
  return true;
}

// ----------------------------------------------------------------------------
// WAREHOUSE OPERATIONS
// ----------------------------------------------------------------------------

export function getWarehouses(tenantId?: string): Warehouse[] {
  initMultiTenantDb();
  const all = getStoredJson<Warehouse[]>(WAREHOUSES_KEY, [DEFAULT_INITIAL_WAREHOUSE]);
  if (!tenantId) return all;
  return all.filter((w) => w.tenantId === tenantId);
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
    const docRef = doc(db, 'tenants', tenantId, 'inventory_data', 'all_items');
    await setDoc(docRef, { items, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    // Offline resilience
  }
}

export async function fetchInventoryFromFirestore(tenantId: string): Promise<InventoryProduct[] | null> {
  try {
    if (!db) return null;
    const { getDoc } = await import('firebase/firestore');
    const docRef = doc(db, 'tenants', tenantId, 'inventory_data', 'all_items');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.items && Array.isArray(data.items)) {
        saveInventory(tenantId, data.items);
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

// ----------------------------------------------------------------------------
// DEPARTMENTS OPERATIONS
// ----------------------------------------------------------------------------

export function getTenantDepartments(tenantId: string): TenantDepartment[] {
  const key = `${DEPARTMENTS_KEY}${tenantId}`;
  return getStoredJson<TenantDepartment[]>(key, []);
}

export function saveTenantDepartments(tenantId: string, departments: TenantDepartment[]): void {
  const key = `${DEPARTMENTS_KEY}${tenantId}`;
  setStoredJson(key, departments);
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

export function getTenantOrders(tenantId: string, warehouseId?: string): MultiTenantOrder[] {
  const key = `${ORDERS_KEY}${tenantId}`;
  const orders = getStoredJson<MultiTenantOrder[]>(key, []);
  if (!warehouseId) return orders;
  return orders.filter((o) => o.warehouseId === warehouseId);
}

export function saveTenantOrders(tenantId: string, orders: MultiTenantOrder[]): void {
  const key = `${ORDERS_KEY}${tenantId}`;
  setStoredJson(key, orders);
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

// ----------------------------------------------------------------------------
// AUTHENTICATION & SESSION
// ----------------------------------------------------------------------------

export function authenticate(login: string, password: string): AuthSession | null {
  const trimmedLogin = login.trim().toLowerCase();
  const trimmedPass = password.trim();

  // 1. Check Superadmin
  if (trimmedLogin === SUPERADMIN_CREDENTIALS.login && trimmedPass === SUPERADMIN_CREDENTIALS.password) {
    const session: AuthSession = {
      userRole: 'superadmin',
      username: SUPERADMIN_CREDENTIALS.name,
      token: `token-super-${Date.now()}`,
    };
    saveAuthSession(session);
    return session;
  }

  // 2. Check Tenant Admins
  const tenants = getTenants();
  const foundTenant = tenants.find(
    (t) => (t.login.toLowerCase() === trimmedLogin || t.slug === trimmedLogin) && t.passwordHash === trimmedPass
  );

  if (foundTenant) {
    if (foundTenant.status === 'suspended') {
      throw new Error('סניף זה מושעה זמנית. אנא פנה למנהל המערכת.');
    }

    const session: AuthSession = {
      userRole: 'tenant_admin',
      tenantId: foundTenant.id,
      tenantName: foundTenant.name,
      username: foundTenant.name,
      token: `token-tenant-${foundTenant.id}-${Date.now()}`,
    };
    saveAuthSession(session);
    return session;
  }

  return null;
}

export function getActiveAuthSession(): AuthSession | null {
  return getStoredJson<AuthSession | null>(AUTH_SESSION_KEY, null);
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
