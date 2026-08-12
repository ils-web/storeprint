export interface SheetColumn {
  index: number;
  letter: string;
  name: string;
}

export interface ColumnMapping {
  orderId: string;       // e.g. "№ Заказа" or "ID"
  date: string;          // e.g. "Дата"
  client: string;        // e.g. "Клиент" / "ФИО"
  items: string;         // e.g. "Состав заказа" / "Наименования"
  quantity: string;      // e.g. "Кол-во"
  address: string;       // e.g. "Адрес" / "Доставка"
  phone: string;         // e.g. "Телефон"
  status: string;        // e.g. "Статус"
  notes: string;         // e.g. "Примечание" / "Комментарий"
}

export interface OrderItem {
  id: string;
  name: string;
  qty: string | number;
  price?: string;
  sku?: string;
  checked?: boolean;
}

export interface Order {
  id: string;
  rowNumber: number;
  rawDate: string;
  parsedDate: Date | null;
  isValidWeek: boolean;
  clientName: string;
  phone: string;
  address: string;
  itemsText: string;
  parsedItems: OrderItem[];
  quantity: string;
  notes: string;
  status: string;
  printed: boolean;
  rawRow: Record<string, string>;
}

export interface SheetTab {
  sheetId: number;
  title: string;
  index: number;
}

export type PaperSize = 'A4' | 'A5' | 'LABEL_100x150' | 'ROLL_80MM';
export type PrintOrientation = 'portrait' | 'landscape';

export interface PrinterProfile {
  id: string;
  name: string;
  description: string;
  paperSize: PaperSize;
  orientation: PrintOrientation;
  fontSizePt: number;
  ordersPerPage: 1 | 2 | 4;
  showCheckbox: boolean;
  showBarcode: boolean;
  showNotes: boolean;
}

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
