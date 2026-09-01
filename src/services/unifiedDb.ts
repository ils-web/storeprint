import { Order, OrderItem, StockItem } from '../types';
import initialMasterStock from '../utils/initialMasterStock.json';
import { normalizeProductName, detectPackagingUnitFromProductName } from '../utils/stockManager';
import { loadCloudConfig, debouncedPushStockToCloud } from '../utils/cloudSync';
import { parseSheetDate } from '../utils/dateUtils';
import { pushStockToFirestore } from './firestoreSync';

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
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      saveDbProducts(SEED_STOCK);
      return SEED_STOCK;
    }
    return parsed;
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
    localStorage.setItem('storeprint_products_cache_v1', JSON.stringify(Object.keys(products)));
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
    const raw = localStorage.getItem(DB_STORAGE_KEYS.STOCK) || localStorage.getItem('storeprint_warehouse_stock_v1');
    if (!raw) {
      saveDbStock(SEED_STOCK, false);
      return SEED_STOCK;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      saveDbStock(SEED_STOCK, false);
      return SEED_STOCK;
    }
    return parsed;
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
    localStorage.setItem('storeprint_warehouse_stock_v1', JSON.stringify(stock));
    localStorage.setItem('storeprint_products_cache_v1', JSON.stringify(Object.keys(stock)));
    if (syncCloud) {
      pushStockToFirestore(stock).catch(console.warn);
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

  // Collect all keys to remove (matching by ID, old name, normalized name)
  const keysToRemove = new Set<string>();
  let preservedColIndex = savedItem.colIndex;

  if (oldNameOrId && oldNameOrId.trim() !== '') {
    const normOld = normalizeProductName(oldNameOrId);
    Object.keys(next).forEach((k) => {
      const item = next[k];
      if (
        k === oldNameOrId ||
        item?.id === oldNameOrId ||
        item?.name === oldNameOrId ||
        normalizeProductName(k) === normOld ||
        (item?.name && normalizeProductName(item.name) === normOld)
      ) {
        keysToRemove.add(k);
        if (item?.colIndex) preservedColIndex = item.colIndex;
      }
    });
  }

  if (savedItem.id) {
    Object.keys(next).forEach((k) => {
      if (next[k]?.id === savedItem.id) {
        keysToRemove.add(k);
        if (next[k]?.colIndex) preservedColIndex = next[k].colIndex;
      }
    });
  }

  // Remove old matching keys
  keysToRemove.forEach((k) => delete next[k]);

  const targetKey = savedItem.name.trim();
  const cleanStock = typeof savedItem.currentStock === 'number' && !isNaN(savedItem.currentStock) ? Math.max(0, savedItem.currentStock) : 0;
  const cleanMin = typeof savedItem.minThreshold === 'number' && !isNaN(savedItem.minThreshold) ? savedItem.minThreshold : 10;
  const cleanUnit = savedItem.unit || detectPackagingUnitFromProductName(targetKey);
  const cleanIsActive = savedItem.isActive !== false;
  const cleanLimitByPatients = Boolean(savedItem.limitByPatients);
  const nowIso = new Date().toISOString();

  next[targetKey] = {
    id: savedItem.id || `stock-${Date.now()}`,
    name: targetKey,
    colIndex: preservedColIndex || savedItem.colIndex || Object.keys(next).length + 4,
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
 * Permanently deletes an item from the warehouse stock and product catalog
 */
export function deleteDbStockItem(idOrName: string): Record<string, StockItem> {
  const current = getDbStock();
  const next: Record<string, StockItem> = { ...current };
  const normTarget = normalizeProductName(idOrName);

  const keysToDelete = Object.keys(next).filter((k) => {
    const item = next[k];
    return (
      k === idOrName ||
      item?.id === idOrName ||
      item?.name === idOrName ||
      normalizeProductName(k) === normTarget ||
      (item?.name && normalizeProductName(item.name) === normTarget)
    );
  });

  keysToDelete.forEach((k) => delete next[k]);

  saveDbStock(next);
  saveDbProducts(next);
  return next;
}

/**
 * Moves an item up or down in the display ordering
 */
export function moveDbStockItem(idOrName: string, direction: 'up' | 'down'): Record<string, StockItem> {
  const current = getDbStock();
  const items = Object.values(current).sort((a, b) => (a.colIndex || 0) - (b.colIndex || 0));
  const normTarget = normalizeProductName(idOrName);

  const index = items.findIndex((item) =>
    item.id === idOrName ||
    item.name === idOrName ||
    normalizeProductName(item.name) === normTarget
  );

  if (index === -1) return current;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return current;

  // Swap elements
  const temp = items[index];
  items[index] = items[targetIndex];
  items[targetIndex] = temp;

  // Re-assign colIndex sequentially
  const next: Record<string, StockItem> = {};
  items.forEach((item, idx) => {
    const updatedItem = {
      ...item,
      colIndex: idx + 4,
    };
    next[updatedItem.name] = updatedItem;
  });

  saveDbStock(next);
  saveDbProducts(next);
  return next;
}

/**
 * Inserts or moves an item to a specific target position (1-indexed)
 */
export function insertDbStockItemAtPosition(
  savedItem: StockItem,
  targetPosition: number,
  oldNameOrId?: string
): Record<string, StockItem> {
  const current = getDbStock();
  let items = Object.values(current).sort((a, b) => (a.colIndex || 0) - (b.colIndex || 0));
  const normOld = oldNameOrId ? normalizeProductName(oldNameOrId) : '';
  const normNew = normalizeProductName(savedItem.name);

  // Remove existing occurrences of this item
  items = items.filter((item) => {
    if (savedItem.id && item.id === savedItem.id) return false;
    if (oldNameOrId && (item.name === oldNameOrId || normalizeProductName(item.name) === normOld)) return false;
    if (item.name === savedItem.name || normalizeProductName(item.name) === normNew) return false;
    return true;
  });

  // Calculate 0-based insert index clamped between 0 and items.length
  const insertIndex = Math.max(0, Math.min(items.length, targetPosition - 1));

  const cleanStock = typeof savedItem.currentStock === 'number' && !isNaN(savedItem.currentStock) ? Math.max(0, savedItem.currentStock) : 0;
  const cleanMin = typeof savedItem.minThreshold === 'number' && !isNaN(savedItem.minThreshold) ? savedItem.minThreshold : 10;
  const cleanUnit = savedItem.unit || detectPackagingUnitFromProductName(savedItem.name);
  const cleanIsActive = savedItem.isActive !== false;
  const cleanLimitByPatients = Boolean(savedItem.limitByPatients);
  const nowIso = new Date().toISOString();

  const itemToInsert: StockItem = {
    id: savedItem.id || `stock-${Date.now()}`,
    name: savedItem.name.trim(),
    colIndex: insertIndex + 4,
    currentStock: cleanStock,
    minThreshold: cleanMin,
    unit: cleanUnit,
    isActive: cleanIsActive,
    limitByPatients: cleanLimitByPatients,
    lastUpdated: nowIso,
  };

  items.splice(insertIndex, 0, itemToInsert);

  // Re-assign colIndex sequentially for all items
  const next: Record<string, StockItem> = {};
  items.forEach((item, idx) => {
    const updatedItem = {
      ...item,
      colIndex: idx + 4,
    };
    next[updatedItem.name] = updatedItem;
  });

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
 * Computes a deterministic, unique, and immutable key for an order's printed status.
 * NEVER uses relative row numbers (r, rowNumber, הזמנה #X) which shift and cause false positive matches.
 */
export function getOrderPrintKey(order: {
  id?: string;
  department?: string;
  timestamp?: string;
  rawDate?: string;
}): string {
  const id = (order.id || '').trim();
  // PWA or Tenant Order format (e.g. order-1724900000000, pwa-...)
  if (id.startsWith('order-') || id.startsWith('pwa-') || id.startsWith('tenant-')) {
    return id;
  }
  const dept = (order.department || '').trim().replace(/\s+/g, ' ');
  const rawTime = (order.timestamp || order.rawDate || '').trim();
  const cleanTime = rawTime.replace(/\s+/g, ' ');
  if (dept && cleanTime) {
    return `forms_order_${dept}:::${cleanTime}`;
  }
  if (cleanTime) {
    return `forms_order_time:::${cleanTime}`;
  }
  return id || `forms_order_${dept}_unknown`;
}

/**
 * Deterministically checks whether an order has been marked as printed across all composite key variants
 */
export function isOrderPrintedInSet(
  order: { id?: string; department?: string; timestamp?: string; rawDate?: string },
  printedSet: Set<string>
): boolean {
  if (!printedSet || printedSet.size === 0) return false;
  const primaryKey = getOrderPrintKey(order);
  if (printedSet.has(primaryKey)) return true;

  const id = (order.id || '').trim();
  if (id && printedSet.has(id)) return true;

  const dept = (order.department || '').trim().replace(/\s+/g, ' ');
  const ts = (order.timestamp || '').trim().replace(/\s+/g, ' ');
  const rawDate = (order.rawDate || '').trim().replace(/\s+/g, ' ');

  if (dept && ts && printedSet.has(`forms_order_${dept}:::${ts}`)) return true;
  if (dept && rawDate && printedSet.has(`forms_order_${dept}:::${rawDate}`)) return true;

  // Check timestamp with date/time position permutations ("DD/MM/YYYY HH:MM:SS" vs "HH:MM:SS DD/MM/YYYY")
  if (ts.includes(' ')) {
    const parts = ts.split(' ');
    if (parts.length === 2) {
      const reversedTs = `${parts[1]} ${parts[0]}`;
      if (dept && printedSet.has(`forms_order_${dept}:::${reversedTs}`)) return true;
    }
  }

  return false;
}

/**
 * Sanitizes printed order IDs by purging legacy row numbers and relative labels ("1", "5", "הזמנה #4")
 */
export function sanitizePrintedOrderIds(rawIds: Iterable<string>): Set<string> {
  const clean = new Set<string>();
  for (const id of rawIds) {
    if (!id || typeof id !== 'string') continue;
    const trimmed = id.trim();
    // Discard pure numbers (e.g. "5", "42", "1")
    if (/^\d+$/.test(trimmed)) continue;
    // Discard generic row labels (e.g. "הזמנה #5", "הזמנה 5", "שורה 5")
    if (/^הזמנה\s*#?\s*\d+$/i.test(trimmed)) continue;
    if (/^שורה\s*\d+$/i.test(trimmed)) continue;
    if (trimmed.length < 5) continue;
    clean.add(trimmed);
  }
  return clean;
}

/**
 * Loads set of printed order composite keys, automatically purged of corrupted legacy row numbers
 */
export function getDbPrintedOrderIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw =
      localStorage.getItem(DB_STORAGE_KEYS.PRINTED_ORDERS) ||
      localStorage.getItem('storeprint_printed_orders_v1');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const sanitized = sanitizePrintedOrderIds(parsed);
    // Write back cleaned set
    saveDbPrintedOrderIds(sanitized);
    return sanitized;
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
    const cleanArr = Array.from(sanitizePrintedOrderIds(ids));
    const serialized = JSON.stringify(cleanArr);
    localStorage.setItem(DB_STORAGE_KEYS.PRINTED_ORDERS, serialized);
    localStorage.setItem('storeprint_printed_orders_v1', serialized);
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

  // 1. Build Master Column map from DB stock and SEED_STOCK
  const colMap: Record<number, string> = {};
  const currentStock = getDbStock();
  Object.values(currentStock || {}).forEach((item) => {
    if (item && typeof item.colIndex === 'number' && item.name && !item.name.startsWith('פריט ')) {
      colMap[item.colIndex] = item.name;
    }
  });
  Object.values(SEED_STOCK || {}).forEach((item) => {
    if (item && typeof item.colIndex === 'number' && item.name && !item.name.startsWith('פריט ')) {
      if (!colMap[item.colIndex]) {
        colMap[item.colIndex] = item.name;
      }
    }
  });

  // Find Header Row (row with מחלקה or חותמת זמן)
  let headerRowIndex = 1;
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const rowStr = rawRows[r].join(' ').toLowerCase();
    if (rowStr.includes('חותמת זמן') || rowStr.includes('מחלקה') || rowStr.includes('סקטור')) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = rawRows[headerRowIndex] || [];
  const cleanHeaderName = (h: string, colIdx: number) => {
    const raw = (h || '').replace(/^["']+|["']+$/g, '').replace(/""/g, '"').trim();
    if (raw && !raw.startsWith('פריט ')) {
      return raw;
    }
    if (colMap[colIdx]) {
      return colMap[colIdx];
    }
    return raw || `פריט ${colIdx - 3}`;
  };

  const productHeaders: string[] = [];
  const maxCols = Math.max(rawHeaders.length, 192);
  for (let c = 4; c < maxCols; c++) {
    const h = rawHeaders[c] || '';
    const name = cleanHeaderName(h, c);
    if (name) {
      productHeaders.push(name);
    }
  }

  const orders: Order[] = [];
  const deptSet = new Set<string>();
  const cleanPrintedSet = sanitizePrintedOrderIds(existingPrintedSet);

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

      const itemName = cleanHeaderName(rawHeaders[c] || '', c);
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
      const isPrinted = isOrderPrintedInSet(
        { id: orderId, department, timestamp, rawDate },
        cleanPrintedSet
      );

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
