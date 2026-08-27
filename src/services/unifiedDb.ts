import { Order, OrderItem, StockItem } from '../types';
import initialMasterStock from '../utils/initialMasterStock.json';
import { normalizeProductName, detectPackagingUnitFromProductName } from '../utils/stockManager';
import { loadCloudConfig, debouncedPushStockToCloud } from '../utils/cloudSync';
import { parseSheetDate } from '../utils/dateUtils';

// Database Storage Keys
const DB_STORAGE_KEYS = {
  PRODUCTS: 'storeprint_db_products_v2',
  STOCK: 'storeprint_db_stock_v2',
  DEPARTMENTS: 'storeprint_db_departments_v2',
  ORDERS: 'storeprint_db_orders_v2',
  PRINTED_ORDERS: 'storeprint_db_printed_orders_v2',
  DELETED_ORDERS: 'storeprint_db_deleted_orders_v2',
};

// Initial Master Stock Seed
const SEED_STOCK: Record<string, StockItem> = initialMasterStock as Record<string, StockItem>;

/**
 * Loads or initializes the master product catalog
 */
export function getDbProducts(): Record<string, StockItem> {
  if (typeof window === 'undefined') return SEED_STOCK;
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEYS.PRODUCTS);
    if (!raw) {
      saveDbProducts(SEED_STOCK);
      return SEED_STOCK;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || Object.keys(parsed).length === 0) {
      saveDbProducts(SEED_STOCK);
      return SEED_STOCK;
    }
    return { ...SEED_STOCK, ...parsed };
  } catch (err) {
    console.warn('Failed to load products from DB:', err);
    return SEED_STOCK;
  }
}

/**
 * Saves product catalog to DB
 */
export function saveDbProducts(products: Record<string, StockItem>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (err) {
    console.warn('Failed to save products to DB:', err);
  }
}

/**
 * Loads current warehouse stock
 */
export function getDbStock(): Record<string, StockItem> {
  if (typeof window === 'undefined') return SEED_STOCK;
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEYS.STOCK);
    if (!raw) {
      const initial = getDbProducts();
      saveDbStock(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || Object.keys(parsed).length === 0) {
      return getDbProducts();
    }
    return { ...SEED_STOCK, ...parsed };
  } catch (err) {
    console.warn('Failed to load stock from DB:', err);
    return SEED_STOCK;
  }
}

/**
 * Saves stock to DB and triggers background cloud sync
 */
export function saveDbStock(stock: Record<string, StockItem>, syncCloud: boolean = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_STORAGE_KEYS.STOCK, JSON.stringify(stock));
    if (syncCloud) {
      const config = loadCloudConfig();
      if (config.enabled && config.endpointUrl) {
        debouncedPushStockToCloud(stock, config, 1200).catch(console.warn);
      }
    }
  } catch (err) {
    console.warn('Failed to save stock to DB:', err);
  }
}

/**
 * Saves or updates a stock item with support for renaming and creating new items
 */
export function saveOrUpdateDbStockItem(
  savedItem: StockItem,
  oldNameOrId?: string
): Record<string, StockItem> {
  const current = getDbStock();
  const next: Record<string, StockItem> = { ...current };

  // If renaming an existing item, remove the old key
  if (oldNameOrId && oldNameOrId.trim() !== '' && oldNameOrId !== savedItem.name) {
    const oldKey = next[oldNameOrId]
      ? oldNameOrId
      : Object.keys(next).find((k) => next[k]?.name === oldNameOrId || next[k]?.id === oldNameOrId);
    if (oldKey) {
      delete next[oldKey];
    }
  }

  const targetKey = savedItem.name.trim();
  const existing = next[targetKey];
  const cleanStock = typeof savedItem.currentStock === 'number' && !isNaN(savedItem.currentStock) ? Math.max(0, savedItem.currentStock) : 0;
  const cleanMin = typeof savedItem.minThreshold === 'number' && !isNaN(savedItem.minThreshold) ? savedItem.minThreshold : 10;
  const cleanUnit = savedItem.unit || existing?.unit || detectPackagingUnitFromProductName(targetKey);
  const cleanIsActive = savedItem.isActive !== false;
  const cleanLimitByPatients = Boolean(savedItem.limitByPatients);
  const nowIso = new Date().toISOString();

  next[targetKey] = {
    id: savedItem.id || `stock-${Date.now()}`,
    name: targetKey,
    colIndex: savedItem.colIndex || Object.keys(next).length + 4,
    currentStock: cleanStock,
    minThreshold: cleanMin,
    unit: cleanUnit,
    isActive: cleanIsActive,
    limitByPatients: cleanLimitByPatients,
    lastUpdated: nowIso,
  };

  saveDbStock(next);
  saveDbProducts(next);
  return next;
}

/**
 * Updates a single stock item quantity or fields
 */
export function updateDbStockItem(
  nameOrId: string,
  newQty: number,
  minThreshold?: number,
  unit?: string,
  isActive?: boolean,
  limitByPatients?: boolean
): Record<string, StockItem> {
  const current = getDbStock();
  const targetKey = current[nameOrId]
    ? nameOrId
    : Object.keys(current).find((k) => current[k]?.name === nameOrId || current[k]?.id === nameOrId) || nameOrId;

  const existing = current[targetKey];
  const cleanStock = typeof newQty === 'number' && !isNaN(newQty) ? Math.max(0, newQty) : 0;
  const cleanMin = typeof minThreshold === 'number' && !isNaN(minThreshold) ? minThreshold : (existing?.minThreshold || 10);
  const cleanUnit = unit || existing?.unit || detectPackagingUnitFromProductName(nameOrId);
  const cleanIsActive = isActive !== undefined ? isActive : (existing?.isActive !== undefined ? existing.isActive : true);
  const cleanLimitByPatients = limitByPatients !== undefined ? limitByPatients : Boolean(existing?.limitByPatients);
  const nowIso = new Date().toISOString();

  const updated: Record<string, StockItem> = {
    ...current,
    [targetKey]: {
      ...(existing || {
        id: `stock-${Date.now()}`,
        name: nameOrId,
        colIndex: Object.keys(current).length + 4,
      }),
      currentStock: cleanStock,
      minThreshold: cleanMin,
      unit: cleanUnit,
      isActive: cleanIsActive,
      limitByPatients: cleanLimitByPatients,
      lastUpdated: nowIso,
    },
  };

  saveDbStock(updated);
  return updated;
}

/**
 * Deducts orders from stock in DB upon print confirmation
 */
export function deductOrdersFromDbStock(orders: Order[]): {
  updatedStock: Record<string, StockItem>;
  totalDeducted: number;
} {
  const current = getDbStock();
  const updated: Record<string, StockItem> = { ...current };
  let totalDeducted = 0;

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const targetKey = updated[item.name]
        ? item.name
        : Object.keys(updated).find((k) => normalizeProductName(k) === normalizeProductName(item.name)) || item.name;

      if (updated[targetKey]) {
        const itemQty = item.numericQty || parseFloat(String(item.qty).replace(/[^\d.]/g, '')) || 0;
        const prevQty = updated[targetKey].currentStock || 0;
        updated[targetKey] = {
          ...updated[targetKey],
          currentStock: Math.max(0, prevQty - itemQty),
          lastDeducted: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        totalDeducted += itemQty;
      }
    });
  });

  saveDbStock(updated);
  return { updatedStock: updated, totalDeducted };
}

/**
 * Loads departments from DB
 */
export function getDbDepartments(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEYS.DEPARTMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves departments to DB
 */
export function saveDbDepartments(departments: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
  } catch {}
}

/**
 * Loads set of printed order composite keys
 */
export function getDbPrintedOrderIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEYS.PRINTED_ORDERS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Saves set of printed order composite keys
 */
export function saveDbPrintedOrderIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_STORAGE_KEYS.PRINTED_ORDERS, JSON.stringify(Array.from(ids)));
  } catch {}
}

/**
 * Ingests incoming orders from Google Forms (Sheet rows) into the unified DB queue.
 * Extracts ONLY order rows (columns A..D + non-zero ordered items in E..FM) without modifying warehouse stock.
 */
export function ingestGoogleFormsOrders(
  rawRows: string[][],
  existingPrintedSet: Set<string>
): {
  orders: Order[];
  departments: string[];
  productHeaders: string[];
} {
  if (!rawRows || rawRows.length < 2) {
    return { orders: [], departments: [], productHeaders: [] };
  }

  // 1. Find Header Row (row 4 in sheet, 0-indexed ~3)
  let headerRowIndex = 3;
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const rowStr = rawRows[r].join(' ').toLowerCase();
    if (rowStr.includes('חותמת זמן') || rowStr.includes('מחלקה') || rowStr.includes('סקטור')) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = rawRows[headerRowIndex] || [];
  const cleanHeaderName = (h: string, fallbackIdx: number) => {
    if (!h) return `פריט ${fallbackIdx}`;
    return h.replace(/^["']+|["']+$/g, '').replace(/""/g, '"').trim() || `פריט ${fallbackIdx}`;
  };

  const productHeaders: string[] = [];
  for (let c = 4; c < rawHeaders.length; c++) {
    productHeaders.push(cleanHeaderName(rawHeaders[c], c - 3));
  }

  const orders: Order[] = [];
  const deptSet = new Set<string>();

  // 2. Iterate through data rows
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const timestamp = row[0] ? row[0].trim() : '';
    const rawDate = row[1] ? row[1].trim() : '';
    const department = row[2] ? row[2].trim() : '';
    const patientsCount = row[3] ? row[3].trim() : '';

    if (!timestamp && !department && !rawDate) {
      continue;
    }

    if (department) {
      deptSet.add(department);
    }

    // 3. Extract items ordered
    const orderItems: OrderItem[] = [];
    for (let c = 4; c < row.length; c++) {
      const cellQty = row[c] ? row[c].trim() : '';
      if (!cellQty || cellQty === '0' || cellQty === '-') {
        continue;
      }

      const itemName = cleanHeaderName(rawHeaders[c], c - 3);
      if (!itemName) continue;

      const numVal = parseFloat(cellQty.replace(/[^\d.]/g, ''));

      orderItems.push({
        id: `item-${r}-${c}`,
        name: itemName,
        qty: cellQty,
        numericQty: isNaN(numVal) ? 1 : numVal,
        colIndex: c,
        checked: false,
      });
    }

    if (orderItems.length > 0) {
      const orderId = `הזמנה #${r - headerRowIndex}`;
      const compositeKey = `${department}_${timestamp}`;
      const isPrinted =
        existingPrintedSet.has(orderId) ||
        existingPrintedSet.has(String(r)) ||
        existingPrintedSet.has(compositeKey) ||
        existingPrintedSet.has(timestamp);

      const parsedDate = parseSheetDate(timestamp || rawDate) || new Date();

      orders.push({
        id: orderId,
        rowNumber: r,
        timestamp: timestamp || rawDate || `שורה ${r}`,
        rawDate,
        parsedDate,
        department: department || 'ללא מחלקה',
        patientsCount,
        items: orderItems,
        totalItemsCount: orderItems.length,
        printed: isPrinted,
        rawRow: {},
      });
    }
  }

  // Sort newest orders at the top
  orders.sort((a, b) => b.rowNumber - a.rowNumber);

  const deptsList = Array.from(deptSet);
  saveDbDepartments(deptsList);

  return {
    orders,
    departments: deptsList,
    productHeaders,
  };
}
