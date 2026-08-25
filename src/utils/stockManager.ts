import { StockItem, Order, OrderItem } from '../types';

const STOCK_STORAGE_KEY = 'storeprint_warehouse_stock_v1';
const DEFAULT_MIN_THRESHOLD = 10;

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
  if (n.includes('מטר') || n.includes('meter')) return 'מטר';
  if (n.includes('סט') || n.includes('ערכה') || n.includes('set')) return 'סט';
  if (n.includes('זוג') || n.includes('pair')) return 'זוג';
  if (n.includes('ק״ג') || n.includes('ק"ג') || n.includes('kg')) return 'ק״ג';
  if (n.includes('ליטר') || n.includes('liter')) return 'ליטר';
  return "יח'";
}

/**
 * Loads stored stock from localStorage
 */
export function loadStoredStock(): Record<string, StockItem> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STOCK_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load stock from localStorage:', err);
    return {};
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

/**
 * Normalizes a product name for reliable matching across CSV unescaping, quotes, and whitespace
 */
export function normalizeProductName(s: string): string {
  if (!s) return '';
  return s.replace(/^["']+|["']+$/g, '').replace(/[\s"'\-_()״׳\\]+/g, '').toLowerCase();
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

  // Build index by name, id, and normalized name for 100% reliable matching
  const existingByName: Record<string, StockItem> = {};
  const existingByNorm: Record<string, StockItem> = {};

  Object.values(existingStock || {}).forEach((item) => {
    if (item && item.name) {
      existingByName[item.name.trim()] = item;
      existingByNorm[normalizeProductName(item.name)] = item;
    }
    if (item && item.id) {
      existingByName[item.id] = item;
    }
  });

  productHeaders.forEach((header, idx) => {
    const cleanName = header.replace(/^["']+|["']+$/g, '').replace(/""/g, '"').trim();
    if (!cleanName) return;

    const normKey = normalizeProductName(cleanName);
    const existing =
      existingStock[cleanName] ||
      existingStock[header] ||
      existingByName[cleanName] ||
      existingByName[header.trim()] ||
      existingByNorm[normKey] ||
      existingByName[`stock-${idx + 4}`];

    const detectedUnit = detectPackagingUnitFromProductName(cleanName);

    if (existing) {
      // PRESERVE user custom values without overwriting with default
      result[cleanName] = {
        id: existing.id || `stock-${idx + 4}`,
        name: cleanName,
        colIndex: idx + 4,
        currentStock: typeof existing.currentStock === 'number' && !isNaN(existing.currentStock) ? existing.currentStock : 0,
        minThreshold: typeof existing.minThreshold === 'number' && !isNaN(existing.minThreshold) ? existing.minThreshold : DEFAULT_MIN_THRESHOLD,
        unit: existing.unit || detectedUnit,
        isActive: existing.isActive !== undefined ? existing.isActive : true,
        limitByPatients: Boolean(existing.limitByPatients),
        lastDeducted: existing.lastDeducted,
        lastUpdated: existing.lastUpdated,
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
      const stockEntry = updated[item.name];
      const qtyToDeduct = parseNumericQty(item.qty);

      if (qtyToDeduct > 0) {
        if (stockEntry) {
          const oldStock = stockEntry.currentStock;
          const newStock = Math.max(0, oldStock - qtyToDeduct);
          stockEntry.currentStock = newStock;
          stockEntry.lastDeducted = new Date().toISOString();

          totalDeductedCount += qtyToDeduct;

          if (stockEntry.isActive !== false && newStock < (stockEntry.minThreshold || DEFAULT_MIN_THRESHOLD) && oldStock >= (stockEntry.minThreshold || DEFAULT_MIN_THRESHOLD)) {
            newLowStockItems.push(stockEntry);
          }
        } else {
          // If item wasn't in stock map yet, add with detected unit
          updated[item.name] = {
            id: `stock-auto-${Date.now()}`,
            name: item.name,
            colIndex: item.colIndex || 0,
            currentStock: 0,
            minThreshold: DEFAULT_MIN_THRESHOLD,
            unit: detectPackagingUnitFromProductName(item.name),
            isActive: true,
            lastDeducted: new Date().toISOString(),
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
