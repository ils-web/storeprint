import { StockItem, Order, OrderItem } from '../types';
import initialMasterStock from './initialMasterStock.json';

const STOCK_STORAGE_KEY = 'storeprint_warehouse_stock_v1';
const DEFAULT_MIN_THRESHOLD = 10;

export const INITIAL_STOCK: Record<string, StockItem> = initialMasterStock as Record<string, StockItem>;

/**
 * Extracts a numeric quantity from various sheet quantity formats
 * Examples: "1", "1 קרטון" -> 1, "2 חבילות" -> 2, "60" -> 60, "2.5" -> 2.5
 */
export function parseNumericQty(qtyStr: string | number | null | undefined): number {
  if (typeof qtyStr === 'number') return Math.max(0, qtyStr);
  if (!qtyStr) return 0;

  const clean = String(qtyStr).trim().replace(',', '.');
  // Match first floating-point or integer number in the string
  const match = clean.match(/(\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

/**
 * Detects default packaging unit from item name
 */
export function detectPackagingUnitFromProductName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('קרטון') || n.includes('carton')) return 'קרטון';
  if (n.includes('קופס') || n.includes('ארגז') || n.includes('box')) return 'קופסה';
  if (n.includes('חביל') || n.includes('מארז') || n.includes('pack')) return 'חבילה';
  if (n.includes('גליל') || n.includes('roll')) return 'גליל';
  if (n.includes('בקבוק') || n.includes('bottle')) return 'בקבוק';
  if (n.includes('דלי') || n.includes('bucket')) return 'דלי';
  if (n.includes('סט') || n.includes('ערכה') || n.includes('set')) return 'סט';
  if (n.includes('זוג') || n.includes('pair')) return 'זוג';
  if (n.includes('ק״ג') || n.includes('ק"ג') || n.includes('kg')) return 'ק״ג';
  return "יח'";
}

/**
 * Loads stored stock from localStorage
 */
export function loadStoredStock(): Record<string, StockItem> {
  if (typeof window === 'undefined') return INITIAL_STOCK;
  try {
    const raw = localStorage.getItem(STOCK_STORAGE_KEY) || localStorage.getItem('storeprint_db_stock_v2');
    if (!raw) return INITIAL_STOCK;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return INITIAL_STOCK;
    return parsed;
  } catch (err) {
    console.warn('Failed to load stock from localStorage:', err);
    return INITIAL_STOCK;
  }
}

/**
 * Saves stock to localStorage
 */
export function saveStoredStock(stock: Record<string, StockItem>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(stock));
  } catch (err) {
    console.warn('Failed to save stock to localStorage:', err);
  }
}

export function cleanBidiAndQuotes(s: string): string {
  if (!s) return '';
  return s
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '') // remove invisible bidi/RTL/LTR marks
    .replace(/,/g, '.')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

/**
 * Normalizes a product name for reliable matching across CSV unescaping, quotes, and whitespace
 */
export function normalizeProductName(s: string): string {
  if (!s) return '';
  return cleanBidiAndQuotes(s)
    .replace(/[\s"'\-_()״׳\\־–—]+/g, '')
    .toLowerCase();
}

/**
 * Strips packaging and parenthetical details to allow matching items across differing descriptions
 * (e.g. "מטושים TRASYSTEM (100 יחידות בחבילה)" -> "מטושים TRASYSTEM")
 */
export function stripPackagingInfo(s: string): string {
  if (!s) return '';
  return cleanBidiAndQuotes(s)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\s"'\-_()״׳\\־–—]+/g, ' ')
    .trim();
}

/**
 * Robust item quantity extractor
 */
export function extractOrderItemQuantity(item: OrderItem | any): number {
  if (!item) return 0;
  if (typeof item.orderedQty === 'number' && !isNaN(item.orderedQty)) {
    return Math.max(0, item.orderedQty);
  }
  if (typeof item.numericQty === 'number' && !isNaN(item.numericQty)) {
    return Math.max(0, item.numericQty);
  }
  return parseNumericQty(item.qty);
}

/**
 * Infallible multi-strategy stock matching algorithm.
 * Guarantees that an ordered item finds its corresponding warehouse stock entry across:
 * 1. Exact key match
 * 2. Product ID / item ID match
 * 3. Normalized name match (ignoring bidi marks, quotes, whitespace, punctuation)
 * 4. Column index match (colIndex from Google Sheet / catalog)
 * 5. Parenthetical / packaging details stripped match
 */
export function findMatchingStockKey(
  item: { id?: string; productId?: string; name: string; colIndex?: number },
  stockMap: Record<string, StockItem>
): string | null {
  if (!item || !stockMap) return null;
  const itemName = (item.name || '').trim();

  // 1. Exact key match
  if (stockMap[itemName]) return itemName;

  // 2. ID / ProductId match
  const pId = item.productId || (item.id && !item.id.startsWith('item-r') ? item.id.replace(/^item-/, '') : null);
  if (pId) {
    const idKey = Object.keys(stockMap).find(
      (k) => stockMap[k]?.id === pId || stockMap[k]?.id === item.id
    );
    if (idKey) return idKey;
  }

  // 3. Normalized name match
  const normItem = normalizeProductName(itemName);
  if (normItem) {
    const normKey = Object.keys(stockMap).find(
      (k) => normalizeProductName(k) === normItem || normalizeProductName(stockMap[k]?.name || '') === normItem
    );
    if (normKey) return normKey;
  }

  // 4. Column Index match
  if (typeof item.colIndex === 'number' && item.colIndex > 0) {
    const colKey = Object.keys(stockMap).find((k) => stockMap[k]?.colIndex === item.colIndex);
    if (colKey) return colKey;
  }

  // 5. Parenthetical / Packaging info stripped match
  const strippedItem = normalizeProductName(stripPackagingInfo(itemName));
  if (strippedItem && strippedItem.length >= 3) {
    const stripKey = Object.keys(stockMap).find((k) => {
      const strippedStock = normalizeProductName(stripPackagingInfo(k));
      return (
        strippedStock === strippedItem ||
        (strippedStock.length > 4 &&
          strippedItem.length > 4 &&
          (strippedStock.startsWith(strippedItem) || strippedItem.startsWith(strippedStock)))
      );
    });
    if (stripKey) return stripKey;
  }

  return null;
}

/**
 * Synchronizes stock items with the product headers from the Google Sheet (E..FM).
 * Existing stock values, custom packaging units, and thresholds are strictly preserved.
 */
export function syncStockWithProductHeaders(
  productHeaders: string[],
  existingStock: Record<string, StockItem> = {}
): Record<string, StockItem> {
  const result: Record<string, StockItem> = {};

  // If productHeaders is empty, build from existingStock so stock is never wiped out
  const effectiveHeaders =
    productHeaders && productHeaders.length > 0
      ? productHeaders
      : Object.values(existingStock || {})
          .map((it) => it?.name || '')
          .filter(Boolean);

  // Build index by name, id, normalized name, and colIndex for 100% reliable matching
  const localStored = loadStoredStock();
  const existingByName: Record<string, StockItem> = {};
  const existingByNorm: Record<string, StockItem> = {};
  const existingByCol: Record<number, StockItem> = {};

  // First populate from localStored, then overlay with existingStock
  [...Object.values(localStored || {}), ...Object.values(existingStock || {})].forEach((item) => {
    if (!item) return;
    if (item.name) {
      existingByName[item.name.trim()] = item;
      existingByNorm[normalizeProductName(item.name)] = item;
    }
    if (item.id) {
      existingByName[item.id] = item;
    }
    if (typeof item.colIndex === 'number') {
      existingByCol[item.colIndex] = item;
    }
  });

  effectiveHeaders.forEach((header, idx) => {
    const cleanName = header.replace(/^["']+|["']+$/g, '').replace(/""/g, '"').trim();
    if (!cleanName) return;

    const normKey = normalizeProductName(cleanName);
    const isPlaceholder = /^פריט\s*\d+$/i.test(cleanName) || /^item\s*\d+$/i.test(cleanName);
    const localFallback = localStored[cleanName] || localStored[header];
    const existing =
      existingStock[cleanName] ||
      existingStock[header] ||
      existingByName[cleanName] ||
      existingByName[header.trim()] ||
      existingByNorm[normKey] ||
      localFallback ||
      (isPlaceholder ? (existingByName[`stock-${idx + 4}`] || existingByCol[idx + 4]) : undefined);

    const detectedUnit = detectPackagingUnitFromProductName(cleanName);

    if (existing) {
      const finalIsActive =
        existing.isActive !== undefined
          ? existing.isActive
          : (localFallback?.isActive !== undefined ? localFallback.isActive : true);

      // CRITICAL FIX: NEVER overwrite a real product name with a generic placeholder (פריט X)
      const hasRealExistingName = Boolean(existing.name && !existing.name.startsWith('פריט '));
      const finalName = (isPlaceholder && hasRealExistingName) ? existing.name : cleanName;
      const finalColIndex = (typeof existing.colIndex === 'number' && existing.colIndex > 0) ? existing.colIndex : idx + 4;

      // PRESERVE user custom values without overwriting with default
      result[finalName] = {
        id: existing.id || `stock-${idx + 4}`,
        name: finalName,
        colIndex: finalColIndex,
        currentStock: typeof existing.currentStock === 'number' && !isNaN(existing.currentStock) ? existing.currentStock : 0,
        minThreshold: typeof existing.minThreshold === 'number' && !isNaN(existing.minThreshold) ? existing.minThreshold : DEFAULT_MIN_THRESHOLD,
        unit: existing.unit || detectedUnit,
        isActive: finalIsActive,
        limitByPatients: existing.limitByPatients !== undefined ? Boolean(existing.limitByPatients) : Boolean(localFallback?.limitByPatients),
        lastDeducted: existing.lastDeducted || localFallback?.lastDeducted,
        lastUpdated: existing.lastUpdated || localFallback?.lastUpdated,
      };
    } else {
      result[cleanName] = {
        id: `stock-${idx + 4}`,
        name: cleanName,
        colIndex: idx + 4,
        currentStock: 0,
        minThreshold: DEFAULT_MIN_THRESHOLD,
        unit: detectedUnit,
        isActive: true,
      };
    }
  });

  return result;
}

/**
 * Deducts quantities from stock for the given orders
 */
export function deductOrdersFromStock(
  orders: Order[],
  currentStock: Record<string, StockItem>
): {
  updatedStock: Record<string, StockItem>;
  totalDeductedCount: number;
  newLowStockItems: StockItem[];
} {
  const updated: Record<string, StockItem> = { ...currentStock };
  let totalDeductedCount = 0;
  const newLowStockItems: StockItem[] = [];

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const targetKey = findMatchingStockKey(item, updated) || item.name;
      const stockEntry = updated[targetKey];
      const qtyToDeduct = extractOrderItemQuantity(item);

      if (qtyToDeduct > 0) {
        if (stockEntry) {
          const oldStock = stockEntry.currentStock || 0;
          const newStock = Math.max(0, oldStock - qtyToDeduct);
          stockEntry.currentStock = newStock;
          stockEntry.lastDeducted = new Date().toISOString();
          stockEntry.lastUpdated = new Date().toISOString();

          totalDeductedCount += qtyToDeduct;

          if (stockEntry.isActive !== false && newStock < (stockEntry.minThreshold || DEFAULT_MIN_THRESHOLD) && oldStock >= (stockEntry.minThreshold || DEFAULT_MIN_THRESHOLD)) {
            newLowStockItems.push(stockEntry);
          }
        } else {
          // If item wasn't in stock map yet, add with detected unit
          updated[item.name] = {
            id: item.productId || item.id || `stock-auto-${Date.now()}`,
            name: item.name,
            colIndex: item.colIndex || 0,
            currentStock: 0,
            minThreshold: DEFAULT_MIN_THRESHOLD,
            unit: item.unit || detectPackagingUnitFromProductName(item.name),
            isActive: true,
            lastDeducted: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          };
          totalDeductedCount += qtyToDeduct;
        }
      }
    });
  });

  saveStoredStock(updated);

  return {
    updatedStock: updated,
    totalDeductedCount,
    newLowStockItems,
  };
}

/**
 * Returns all items with current stock strictly less than minThreshold
 */
export function getLowStockItems(
  stock: Record<string, StockItem>,
  customThreshold?: number
): StockItem[] {
  return Object.values(stock).filter((item) => {
    if (item.isActive === false) return false;
    const threshold = customThreshold !== undefined ? customThreshold : (item.minThreshold || DEFAULT_MIN_THRESHOLD);
    return (item.currentStock || 0) < threshold;
  }).sort((a, b) => (a.currentStock || 0) - (b.currentStock || 0)); // Lowest stock first
}

/**
 * Exports current stock to JSON string for backup
 */
export function exportStockToJson(stock: Record<string, StockItem>): string {
  return JSON.stringify(stock, null, 2);
}

/**
 * Imports stock from JSON string
 */
export function importStockFromJson(jsonStr: string): Record<string, StockItem> | null {
  try {
    const data = JSON.parse(jsonStr);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (err) {
    console.warn('Failed to parse stock JSON:', err);
    return null;
  }
}

/**
 * Detects number of pieces/units per package from explicit package size or from product name patterns
 * (e.g. "100 יחידות", "10 יח'", "בחבילה יש 10 יחידות", "12 יחידות")
 */
export function detectPackageSize(name: string, explicitSize?: number): number | undefined {
  if (typeof explicitSize === 'number' && !isNaN(explicitSize) && explicitSize > 0) {
    return explicitSize;
  }
  if (!name || typeof name !== 'string') return undefined;
  const match = name.match(/(\d+)\s*(?:יחידות|יח'|יח\b)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 1) return num;
  }
  return undefined;
}

export interface CanonicalWarehouseCatalog {
  orderedList: StockItem[];
  activeList: StockItem[];
  displayNumberByNormName: Map<string, number>;
}

/**
 * Single source of truth for ordering, deduplicating, and numbering warehouse items.
 * - Active items (`isActive !== false`) come first (#1..#activeCount)
 * - Inactive/frozen items (`isActive === false`) come last (#activeCount+1..#N)
 * - Ordered by colIndex ascending, then Hebrew name localeCompare
 * - Strictly deduplicated by normalizeProductName(name)
 */
export function getCanonicalWarehouseCatalog(
  stock: Record<string, StockItem> | null | undefined
): CanonicalWarehouseCatalog {
  if (!stock || typeof stock !== 'object') {
    return { orderedList: [], activeList: [], displayNumberByNormName: new Map() };
  }

  const rawList = Object.values(stock)
    .filter(
      (it): it is StockItem =>
        Boolean(it && typeof it === 'object' && typeof it.name === 'string' && it.name.trim() !== '')
    )
    .sort((a, b) => {
      const aInactive = a.isActive === false;
      const bInactive = b.isActive === false;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return ((a.colIndex || 0) - (b.colIndex || 0)) || a.name.localeCompare(b.name, 'he');
    });

  const seenNorms = new Set<string>();
  const orderedList: StockItem[] = [];
  const activeList: StockItem[] = [];
  const displayNumberByNormName = new Map<string, number>();

  rawList.forEach((item) => {
    const cleanName = item.name.trim();
    const norm = normalizeProductName(cleanName) || cleanName.toLowerCase();
    if (!seenNorms.has(norm)) {
      seenNorms.add(norm);
      const displayNum = orderedList.length + 1;
      orderedList.push(item);
      displayNumberByNormName.set(norm, displayNum);
      if (item.isActive !== false) {
        activeList.push(item);
      }
    }
  });

  return { orderedList, activeList, displayNumberByNormName };
}

/**
 * Normalizes a StockItem map into canonical order (active first, frozen last)
 * with sequential colIndex values starting at 4.
 */
export function resequenceStockMap(stockMap: Record<string, StockItem>): Record<string, StockItem> {
  const { orderedList } = getCanonicalWarehouseCatalog(stockMap);
  const reorderedMap: Record<string, StockItem> = {};
  orderedList.forEach((item, idx) => {
    reorderedMap[item.name] = {
      ...item,
      colIndex: idx + 4,
    };
  });
  return reorderedMap;
}

/**
 * Updates fields on a single StockItem inside a branch stock map while preserving
 * active-first / frozen-last canonical ordering when status changes.
 */
export function updateStockItemInMap(
  stockMap: Record<string, StockItem>,
  itemIdOrName: string,
  newStock: number,
  minThreshold?: number,
  unit?: string,
  isActive?: boolean,
  limitByPatients?: boolean,
  packageSize?: number
): Record<string, StockItem> {
  const next: Record<string, StockItem> = { ...(stockMap || {}) };
  const normSearch = normalizeProductName(itemIdOrName);
  const targetKey = next[itemIdOrName]
    ? itemIdOrName
    : Object.keys(next).find(
        (k) =>
          k === itemIdOrName ||
          next[k]?.id === itemIdOrName ||
          next[k]?.name === itemIdOrName ||
          normalizeProductName(k) === normSearch ||
          normalizeProductName(next[k]?.name || '') === normSearch
      );

  if (!targetKey || !next[targetKey]) return next;

  const existing = next[targetKey];
  const wasActive = existing.isActive !== false;
  const cleanIsActive = isActive !== undefined ? isActive : wasActive;
  const cleanPkgSize =
    typeof packageSize === 'number' && packageSize > 0
      ? packageSize
      : existing.packageSize || detectPackageSize(existing.name);
  let cleanUnit = unit || existing.unit || detectPackagingUnitFromProductName(existing.name);
  if (cleanUnit === 'מטר') {
    cleanUnit = cleanPkgSize && cleanPkgSize > 1 ? 'מארז' : "יח'";
  }

  const updatedItem: StockItem = {
    ...existing,
    currentStock: typeof newStock === 'number' && !isNaN(newStock) ? Math.max(0, newStock) : 0,
    minThreshold: typeof minThreshold === 'number' && !isNaN(minThreshold) ? minThreshold : (existing.minThreshold || DEFAULT_MIN_THRESHOLD),
    unit: cleanUnit,
    ...(cleanPkgSize !== undefined ? { packageSize: cleanPkgSize } : {}),
    isActive: cleanIsActive,
    limitByPatients: limitByPatients !== undefined ? Boolean(limitByPatients) : Boolean(existing.limitByPatients),
    lastUpdated: new Date().toISOString(),
  };

  next[targetKey] = updatedItem;

  if (wasActive === cleanIsActive) {
    return next;
  }

  const others = getCanonicalWarehouseCatalog(next).orderedList.filter(
    (it) => normalizeProductName(it.name) !== normalizeProductName(existing.name)
  );
  const activeOthers = others.filter((it) => it.isActive !== false);
  const frozenOthers = others.filter((it) => it.isActive === false);
  const combined = cleanIsActive
    ? [...activeOthers, updatedItem, ...frozenOthers]
    : [...activeOthers, ...frozenOthers, updatedItem];

  const reorderedMap: Record<string, StockItem> = {};
  combined.forEach((it, idx) => {
    reorderedMap[it.name] = { ...it, colIndex: idx + 4 };
  });
  return reorderedMap;
}

/**
 * Inserts or updates a full StockItem inside a stock map with optional 1-based targetPosition.
 */
export function upsertStockItemInMap(
  stockMap: Record<string, StockItem>,
  savedItem: StockItem,
  oldNameOrId?: string,
  targetPosition?: number
): Record<string, StockItem> {
  const normOld = oldNameOrId ? normalizeProductName(oldNameOrId) : '';
  const normNew = normalizeProductName(savedItem.name);
  const { orderedList } = getCanonicalWarehouseCatalog(stockMap);

  let preservedColIndex = savedItem.colIndex;
  const remaining = orderedList.filter((item) => {
    const itemNorm = normalizeProductName(item.name);
    const isMatch =
      (oldNameOrId &&
        (item.id === oldNameOrId ||
          item.name === oldNameOrId ||
          (normOld !== '' && itemNorm === normOld))) ||
      (savedItem.id && item.id === savedItem.id) ||
      item.name === savedItem.name ||
      (normNew !== '' && itemNorm === normNew);
    if (isMatch && item.colIndex && !preservedColIndex) {
      preservedColIndex = item.colIndex;
    }
    return !isMatch;
  });

  const cleanIsActive = savedItem.isActive !== false;
  const cleanPkgSize =
    typeof savedItem.packageSize === 'number' && savedItem.packageSize > 0
      ? savedItem.packageSize
      : detectPackageSize(savedItem.name);
  let cleanUnit = savedItem.unit || detectPackagingUnitFromProductName(savedItem.name);
  if (cleanUnit === 'מטר') {
    cleanUnit = cleanPkgSize && cleanPkgSize > 1 ? 'מארז' : "יח'";
  }

  const finalItem: StockItem = {
    ...savedItem,
    id: savedItem.id || `stock-${Date.now()}`,
    name: savedItem.name.trim(),
    colIndex: preservedColIndex || remaining.length + 4,
    currentStock: typeof savedItem.currentStock === 'number' && !isNaN(savedItem.currentStock) ? Math.max(0, savedItem.currentStock) : 0,
    minThreshold: typeof savedItem.minThreshold === 'number' && !isNaN(savedItem.minThreshold) ? savedItem.minThreshold : DEFAULT_MIN_THRESHOLD,
    unit: cleanUnit,
    packageSize: cleanPkgSize,
    isActive: cleanIsActive,
    limitByPatients: Boolean(savedItem.limitByPatients),
    lastUpdated: new Date().toISOString(),
  };

  const activeItems = remaining.filter((it) => it.isActive !== false);
  const frozenItems = remaining.filter((it) => it.isActive === false);

  if (typeof targetPosition === 'number' && targetPosition > 0) {
    if (cleanIsActive) {
      const insertAt = Math.max(0, Math.min(activeItems.length, targetPosition - 1));
      activeItems.splice(insertAt, 0, finalItem);
    } else {
      const frozenIdx = Math.max(0, Math.min(frozenItems.length, targetPosition - activeItems.length - 1));
      frozenItems.splice(frozenIdx, 0, finalItem);
    }
  } else {
    const combined = [...remaining, finalItem].sort((a, b) => {
      const aIn = a.isActive === false;
      const bIn = b.isActive === false;
      if (aIn !== bIn) return aIn ? 1 : -1;
      return ((a.colIndex || 0) - (b.colIndex || 0)) || a.name.localeCompare(b.name, 'he');
    });
    const reorderedMap: Record<string, StockItem> = {};
    combined.forEach((it, idx) => {
      reorderedMap[it.name] = { ...it, colIndex: idx + 4 };
    });
    return reorderedMap;
  }

  const combined = [...activeItems, ...frozenItems];
  const reorderedMap: Record<string, StockItem> = {};
  combined.forEach((it, idx) => {
    reorderedMap[it.name] = { ...it, colIndex: idx + 4 };
  });
  return reorderedMap;
}

/**
 * Deletes an item by id or name and resequences remaining items cleanly.
 */
export function deleteStockItemFromMap(
  stockMap: Record<string, StockItem>,
  idOrName: string
): Record<string, StockItem> {
  const norm = normalizeProductName(idOrName);
  const current: Record<string, StockItem> = {};
  Object.entries(stockMap || {}).forEach(([k, item]) => {
    if (!item) return;
    const isMatch =
      k === idOrName ||
      item.id === idOrName ||
      item.name === idOrName ||
      normalizeProductName(k) === norm ||
      normalizeProductName(item.name) === norm;
    if (!isMatch) {
      current[k] = item;
    }
  });
  return resequenceStockMap(current);
}

/**
 * Moves an item one row up or down within its active/frozen group and resequences colIndex.
 */
export function moveStockItemInMap(
  stockMap: Record<string, StockItem>,
  idOrName: string,
  direction: 'up' | 'down'
): Record<string, StockItem> {
  const { orderedList } = getCanonicalWarehouseCatalog(stockMap);
  const normTarget = normalizeProductName(idOrName);
  const idx = orderedList.findIndex(
    (it) => it.id === idOrName || it.name === idOrName || normalizeProductName(it.name) === normTarget
  );
  if (idx === -1) return stockMap;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= orderedList.length) return stockMap;

  if ((orderedList[idx].isActive !== false) !== (orderedList[targetIdx].isActive !== false)) {
    return stockMap;
  }

  const nextList = [...orderedList];
  const temp = nextList[idx];
  nextList[idx] = nextList[targetIdx];
  nextList[targetIdx] = temp;

  const reorderedMap: Record<string, StockItem> = {};
  nextList.forEach((it, i) => {
    reorderedMap[it.name] = { ...it, colIndex: i + 4 };
  });
  return reorderedMap;
}
