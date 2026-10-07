export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  qty: string;
  numericQty?: number;
  unit?: string;
  colIndex?: number;
  checked?: boolean;
}

export interface Order {
  id: string;
  tenantId?: string;
  rowNumber: number;
  timestamp: string;       // Order creation timestamp (e.g. 20/07/2026 09:37:32)
  rawDate: string;         // Order date string (e.g. 20/07/2026)
  parsedDate: Date | null;
  department: string;      // Department or ward name
  patientsCount: string;   // Current patients count in department
  items: OrderItem[];      // Extracted ordered items with quantities
  totalItemsCount: number; // Count of items ordered
  printed: boolean;
  printedAt?: string;
  rawRow: Record<string, string>;
}

export interface StockItem {
  id: string;
  name: string;
  colIndex: number;
  currentStock: number;
  minThreshold: number;   // default 10
  unit?: string;
  isActive?: boolean;     // true = in active use (default), false = paused / not in use
  limitByPatients?: boolean; // true = order quantity is restricted to current department patient count
  lastDeducted?: string;
  lastUpdated?: string;
}

export interface CloudSyncConfig {
  enabled: boolean;
  syncType: 'webhook' | 'jsonbin' | 'kv';
  endpointUrl: string;
  apiKey?: string;
  autoSyncOnPrint: boolean;
  lastSyncedAt?: string;
}

export interface SheetTab {
  sheetId: number;
  title: string;
  index: number;
}

export type PaperSize = 'A4' | 'A5' | 'LABEL_100x150' | 'ROLL_80MM';
export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintSettings {
  selectedPrinterId: string;
  paperSize: PaperSize;
  orientation: PrintOrientation;
  ordersPerPage: 1 | 2 | 4;
  showCheckbox: boolean;
  showBarcode: boolean;
  showClientDetails: boolean;
  showNotes: boolean;
  customTitle: string;
  fontSizePt: number;
}

export interface WeekRange {
  startDate: Date;
  endDate: Date;
  weekNumber: number;
  year: number;
  formattedRange: string;
}
