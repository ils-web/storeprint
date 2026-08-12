import { SheetTab, Order, ColumnMapping, OrderItem } from '../types';
import { parseSheetDate, isDateInWeek, getCurrentWeekRange } from './dateUtils';

export const DEFAULT_SPREADSHEET_ID = '1NJq4sJV0HPvkKUXy6kot3FUA7dnKAHD-iWTVXIY4qms';
export const DEFAULT_GID = '1965220204';
export const DEFAULT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit?gid=${DEFAULT_GID}#gid=${DEFAULT_GID}`;

/**
 * Parses Google Spreadsheet ID from a URL or raw ID string.
 */
export function extractSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return DEFAULT_SPREADSHEET_ID;
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return urlOrId.trim();
}

/**
 * Extracts gid (Sheet ID) from URL if present.
 */
export function extractGidFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]gid=(\d+)/) || url.match(/#gid=(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetches sheet tabs metadata via Google Sheets API (requires OAuth Access Token)
 */
export async function fetchSheetTabs(
  spreadsheetId: string,
  accessToken: string
): Promise<SheetTab[]> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title,index)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Ошибка API Google Sheets (${response.status})`);
    }

    const data = await response.json();
    if (!data.sheets || !Array.isArray(data.sheets)) {
      return [];
    }

    return data.sheets.map((s: any) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      index: s.properties.index ?? 0,
    }));
  } catch (err: any) {
    console.warn('Google Sheets API tabs fetch error:', err);
    throw err;
  }
}

/**
 * Fetches raw cell values from a specific tab title via Google Sheets API (Read-only)
 */
export async function fetchSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<string[][]> {
  const encodedTitle = encodeURIComponent(sheetTitle);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodedTitle}'!A1:ZZ10000?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Ошибка чтения Google Таблицы (${response.status})`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Fallback CSV Fetcher for public Google Sheets (without requiring OAuth if publicly shared)
 */
export async function fetchPublicCsvValues(spreadsheetId: string, gid: string = '0'): Promise<string[][]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить публичный CSV Google Sheets (${response.status})`);
  }
  const csvText = await response.text();
  return parseCsvString(csvText);
}

/**
 * Helper to parse CSV text with quoted cells & comma/semicolon separators
 */
function parseCsvString(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    lines.push(currentRow);
  }

  return lines;
}

/**
 * Intelligent auto-mapping detector for table header columns
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const normalize = (s: string) => s.toLowerCase().trim();

  const mapping: ColumnMapping = {
    orderId: '',
    date: '',
    client: '',
    items: '',
    quantity: '',
    address: '',
    phone: '',
    status: '',
    notes: '',
  };

  headers.forEach((h) => {
    const norm = normalize(h);
    if (!norm) return;

    if (!mapping.orderId && (norm.includes('№') || norm.includes('номер') || norm.includes('заказ') || norm.includes('заявка') || norm.includes('id'))) {
      mapping.orderId = h;
    } else if (!mapping.date && (norm.includes('дата') || norm.includes('время') || norm.includes('date') || norm.includes('число'))) {
      mapping.date = h;
    } else if (!mapping.client && (norm.includes('клиент') || norm.includes('фио') || norm.includes('покупатель') || norm.includes('получатель') || norm.includes('имя'))) {
      mapping.client = h;
    } else if (!mapping.items && (norm.includes('состав') || norm.includes('товар') || norm.includes('наименование') || norm.includes('позиции') || norm.includes('номенклатура') || norm.includes('продукт'))) {
      mapping.items = h;
    } else if (!mapping.quantity && (norm.includes('кол-во') || norm.includes('количество') || norm.includes('шт') || norm.includes('объем') || norm.includes('qty'))) {
      mapping.quantity = h;
    } else if (!mapping.address && (norm.includes('адрес') || norm.includes('доставка') || norm.includes('город') || norm.includes('пункт'))) {
      mapping.address = h;
    } else if (!mapping.phone && (norm.includes('телефон') || norm.includes('тел') || norm.includes('контакт') || norm.includes('phone'))) {
      mapping.phone = h;
    } else if (!mapping.status && (norm.includes('статус') || norm.includes('состояние') || norm.includes('этап'))) {
      mapping.status = h;
    } else if (!mapping.notes && (norm.includes('примечание') || norm.includes('комментарий') || norm.includes('заметка') || norm.includes('инфо'))) {
      mapping.notes = h;
    }
  });

  // Fallbacks if not auto-detected
  if (!mapping.orderId && headers[0]) mapping.orderId = headers[0];
  if (!mapping.date && headers[1]) mapping.date = headers[1];
  if (!mapping.client && headers[2]) mapping.client = headers[2];
  if (!mapping.items && headers[3]) mapping.items = headers[3];

  return mapping;
}

/**
 * Parses raw text of order items into individual structured line items for checklist marking
 */
export function parseOrderItemsText(itemsText: string, defaultQty: string = '1'): OrderItem[] {
  if (!itemsText) return [];

  // Split by newlines, semicolons, commas, or bullet points
  const lines = itemsText.split(/\r?\n|;|\b(?=\d+[\.\)])/).map((l) => l.trim()).filter(Boolean);
  const result: OrderItem[] = [];

  lines.forEach((line, idx) => {
    // Regex for "1. Товар X - 2 шт" or "Товар X (3 шт)" or "5x Товар Y"
    const qtyMatch = line.match(/(?:(?:x|х|\*)\s*(\d+))|(?:(\d+)\s*(?:шт|х|x|\*))|(?:\((\d+)\s*шт\))/i) || line.match(/^(\d+)[\.\)\s-]+(.+)$/);
    let qty = defaultQty;
    let cleanName = line.replace(/^\d+[\.\)\s-]+/, '').trim();

    if (qtyMatch) {
      const extractedQty = qtyMatch[1] || qtyMatch[2] || qtyMatch[3];
      if (extractedQty && !isNaN(Number(extractedQty))) {
        qty = extractedQty;
      }
    }

    result.push({
      id: `item-${idx + 1}`,
      name: cleanName || line,
      qty: qty || '1',
      checked: false,
    });
  });

  return result.length > 0
    ? result
    : [
        {
          id: 'item-1',
          name: itemsText,
          qty: defaultQty || '1',
          checked: false,
        },
      ];
}

/**
 * Converts raw Google Sheets matrix rows into clean Order objects and applies CURRENT WEEK date filter!
 */
export function processRawRowsToOrders(
  rows: string[][],
  mapping: ColumnMapping
): { orders: Order[]; headers: string[]; totalRows: number; filteredOutCount: number } {
  if (!rows || rows.length === 0) {
    return { orders: [], headers: [], totalRows: 0, filteredOutCount: 0 };
  }

  const headers = rows[0].map((h) => h.trim());
  const headerIndexMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    headerIndexMap[h] = idx;
  });

  const getValue = (row: string[], colName: string): string => {
    const idx = headerIndexMap[colName];
    if (idx !== undefined && row[idx] !== undefined) {
      return String(row[idx]).trim();
    }
    return '';
  };

  const currentWeek = getCurrentWeekRange();
  const rawOrders: Order[] = [];
  let filteredOutCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((cell) => !cell || String(cell).trim() === '')) {
      continue; // skip completely empty rows
    }

    const rawDateStr = getValue(row, mapping.date);
    const parsedDate = parseSheetDate(rawDateStr);
    const validWeek = isDateInWeek(parsedDate, currentWeek);

    const orderIdVal = getValue(row, mapping.orderId) || `Заказ #${r}`;
    const clientVal = getValue(row, mapping.client) || 'Частное лицо';
    const itemsVal = getValue(row, mapping.items) || 'Товар по спецификации';
    const qtyVal = getValue(row, mapping.quantity) || '1';
    const addressVal = getValue(row, mapping.address);
    const phoneVal = getValue(row, mapping.phone);
    const statusVal = getValue(row, mapping.status) || 'Новый';
    const notesVal = getValue(row, mapping.notes);

    const rawRowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawRowObj[h] = row[idx] ? String(row[idx]).trim() : '';
    });

    const orderObj: Order = {
      id: orderIdVal,
      rowNumber: r + 1,
      rawDate: rawDateStr,
      parsedDate,
      isValidWeek: validWeek,
      clientName: clientVal,
      phone: phoneVal,
      address: addressVal,
      itemsText: itemsVal,
      parsedItems: parseOrderItemsText(itemsVal, qtyVal),
      quantity: qtyVal,
      notes: notesVal,
      status: statusVal,
      printed: false,
      rawRow: rawRowObj,
    };

    // STRICT MANDATE: Keep ONLY rows with dates from the CURRENT WEEK
    if (validWeek) {
      rawOrders.push(orderObj);
    } else {
      filteredOutCount++;
    }
  }

  return {
    orders: rawOrders,
    headers,
    totalRows: rows.length - 1,
    filteredOutCount,
  };
}

/**
 * Returns mock orders for current week if sheet is empty or for immediate instant preview
 */
export function getMockCurrentWeekOrders(): Order[] {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
  
  const monday = new Date(now);
  monday.setDate(diffToMonday);

  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1);

  const wednesday = new Date(monday);
  wednesday.setDate(monday.getDate() + 2);

  const format = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const mock1Date = format(monday);
  const mock2Date = format(tuesday);
  const mock3Date = format(wednesday);

  return [
    {
      id: 'ЗК-8041',
      rowNumber: 2,
      rawDate: mock1Date,
      parsedDate: monday,
      isValidWeek: true,
      clientName: 'ИП Иванов П.С. (Магазин СпецОдежда)',
      phone: '+7 (916) 555-01-92',
      address: 'г. Москва, ул. Складская, д. 14, стр. 2',
      itemsText: '1. Куртка рабочая "Мастер" M — 3 шт;\n2. Брюки защитные L — 3 шт;\n3. Перчатки нитриловые 10p — 10 пар',
      parsedItems: [
        { id: 'item-1', name: 'Куртка рабочая "Мастер" M', qty: '3 шт', checked: false },
        { id: 'item-2', name: 'Брюки защитные L', qty: '3 шт', checked: false },
        { id: 'item-3', name: 'Перчатки нитриловые 10p', qty: '10 пар', checked: false },
      ],
      quantity: '16',
      notes: 'Срочная отгрузка до 14:00. Вложить кассовый чек.',
      status: 'К сборке',
      printed: false,
      rawRow: {},
    },
    {
      id: 'ЗК-8042',
      rowNumber: 3,
      rawDate: mock2Date,
      parsedDate: tuesday,
      isValidWeek: true,
      clientName: 'ООО "ТехноСнаб"',
      phone: '+7 (495) 789-33-44',
      address: 'г. Химки, Ленинградское ш., д. 29Б, офис 12',
      itemsText: '1. Кабель силовый ВВГнг-LS 3х2.5 (100м) — 2 бухты;\n2. Автоматический выключатель 16А — 12 шт;\n3. Щит электрический 24 модуля — 1 шт',
      parsedItems: [
        { id: 'item-1', name: 'Кабель силовый ВВГнг-LS 3х2.5 (100м)', qty: '2 бухты', checked: false },
        { id: 'item-2', name: 'Автоматический выключатель 16А', qty: '12 шт', checked: false },
        { id: 'item-3', name: 'Щит электрический 24 модуля', qty: '1 шт', checked: false },
      ],
      quantity: '15',
      notes: 'Оплата по безналичному расчету. Доверенность №441.',
      status: 'Новый',
      printed: false,
      rawRow: {},
    },
    {
      id: 'ЗК-8043',
      rowNumber: 4,
      rawDate: mock3Date,
      parsedDate: wednesday,
      isValidWeek: true,
      clientName: 'Сидоров Алексей Сергеевич',
      phone: '+7 (903) 123-45-67',
      address: 'ПВЗ Яндекс Маркет, г. Одинцово, ул. Маршала Жукова 38',
      itemsText: '1. Набор инстрментов 108 предметов — 1 шт;\n2. Органайзер для деталей — 2 шт',
      parsedItems: [
        { id: 'item-1', name: 'Набор инструментов 108 предметов', qty: '1 шт', checked: false },
        { id: 'item-2', name: 'Органайзер для деталей', qty: '2 шт', checked: false },
      ],
      quantity: '3',
      notes: 'Маркировка коробки QR-кодом заказа.',
      status: 'К сборке',
      printed: false,
      rawRow: {},
    },
  ];
}
