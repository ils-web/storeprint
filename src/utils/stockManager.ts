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
 * Synchronizes stock items with the product headers from the Google Sheet (E..FM).
 * Existing stock values are preserved.
 */
export function syncStockWithProductHeaders(
  productHeaders: string[],
  existingStock: Record<string, StockItem>
): Record<string, StockItem> {
  const result: Record<string, StockItem> = { ...existingStock };

  productHeaders.forEach((header, idx) => {
    const cleanName = header.trim();
    if (!cleanName) return;

    if (!result[cleanName]) {
      result[cleanName] = {
        id: `stock-${idx + 4}`,
        name: cleanName,
        colIndex: idx + 4,
        currentStock: 0,
        minThreshold: DEFAULT_MIN_THRESHOLD,
        unit: "יח'",
      };
    } else {
      // Update colIndex in case headers shifted, preserving unit and minThreshold
      result[cleanName] = {
        ...result[cleanName],
        colIndex: idx + 4,
        unit: result[cleanName].unit || "יח'",
        minThreshold: result[cleanName].minThreshold || DEFAULT_MIN_THRESHOLD,
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

          if (newStock < (stockEntry.minThreshold || DEFAULT_MIN_THRESHOLD) && oldStock >= (stockEntry.minThreshold || DEFAULT_MIN_THRESHOLD)) {
            newLowStockItems.push(stockEntry);
          }
        } else {
          // If item wasn't in stock map yet, add with 0
          updated[item.name] = {
            id: `stock-auto-${Date.now()}`,
            name: item.name,
            colIndex: item.colIndex || 0,
            currentStock: 0,
            minThreshold: DEFAULT_MIN_THRESHOLD,
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
    const threshold = customThreshold !== undefined ? customThreshold : (item.minThreshold || DEFAULT_MIN_THRESHOLD);
    return item.currentStock < threshold;
  }).sort((a, b) => a.currentStock - b.currentStock); // Lowest stock first
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
