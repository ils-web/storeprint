export interface OrderItem {
  id: string;
  name: string;
  qty: string;
  numericQty?: number;
  colIndex?: number;
  checked?: boolean;
}

export interface Order {
  id: string;
  rowNumber: number;
  timestamp: string;       // Column A (חותמת זמן, e.g. 20/07/2026 09:37:32)
  rawDate: string;         // Column B (תאריך, e.g. 20/07/2026)
  parsedDate: Date | null;
  department: string;      // Column C (מחלקה או סקטור, e.g. ג' 2 סיעוד מורכב)
  patientsCount: string;   // Column D (מספר טופלים במחלקה)
  items: OrderItem[];      // Extracted items from columns E..FM
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
