import { SheetTab, Order, OrderItem } from '../types';
import { parseSheetDate } from './dateUtils';

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
 * Robust CSV Fetcher for public Google Sheets with CORS-enabled gviz endpoint and proxies
 */
export async function fetchPublicCsvValues(spreadsheetId: string, gid: string = DEFAULT_GID): Promise<string[][]> {
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const directCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

  // 1. Primary: Google Visualization CSV endpoint (CORS-friendly, no auth required for public sheets)
  try {
    const response = await fetch(gvizUrl);
    if (response.ok) {
      const csvText = await response.text();
      if (csvText && csvText.length > 50) {
        return parseCsvString(csvText);
      }
    }
  } catch (err) {
    console.warn('GVIZ CSV fetch failed, trying direct export...', err);
  }

  // 2. Secondary: Direct CSV export endpoint
  try {
    const response = await fetch(directCsvUrl);
    if (response.ok) {
      const csvText = await response.text();
      if (csvText && csvText.length > 50) {
        return parseCsvString(csvText);
      }
    }
  } catch (err) {
    console.warn('Direct CSV fetch failed, attempting proxy fallback...', err);
  }

  // 3. Tertiary: AllOrigins proxy fallback
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(gvizUrl)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const csvText = await response.text();
      if (csvText && csvText.length > 50) {
        return parseCsvString(csvText);
      }
    }
  } catch (err) {
    console.warn('Proxy fallback failed:', err);
  }

  throw new Error('Не удалось загрузить данные из Google Таблицы');
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
 * Converts raw Google Sheets matrix rows into clean Order objects according to the exact structure:
 * Row index 3 (Row 4 in Excel) = Header with items in columns E..FM (indices 4..N)
 * Column A (index 0) = Timestamp (חותמת זמן)
 * Column B (index 1) = Date (תאריך)
 * Column C (index 2) = Department (מחלקה או סקטור)
 * Column D (index 3) = Patients (מספר טופלים במחלקה)
 * Columns E..FM (indices 4..) = Item names & ordered quantities
 */
export function processRawRowsToOrders(
  rows: string[][]
): { orders: Order[]; productHeaders: string[]; totalRows: number; departments: string[] } {
  if (!rows || rows.length === 0) {
    return { orders: [], productHeaders: [], totalRows: 0, departments: [] };
  }

  // 1. Locate the header row by searching for 'חותמת זמן' or 'מחלקה' or default to index 3
  let headerRowIndex = 3;
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const rowStr = rows[r].join(' ').toLowerCase();
    if (rowStr.includes('חותמת זמן') || rowStr.includes('מחלקה') || rowStr.includes('סקטור')) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = rows[headerRowIndex] || [];

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

  // 2. Iterate through all rows starting from headerRowIndex + 1
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const timestamp = row[0] ? row[0].trim() : '';
    const rawDate = row[1] ? row[1].trim() : '';
    const department = row[2] ? row[2].trim() : '';
    const patientsCount = row[3] ? row[3].trim() : '';

    // If completely empty row without timestamp or department, skip
    if (!timestamp && !department && !rawDate) {
      continue;
    }

    if (department) {
      deptSet.add(department);
    }

    // 3. Extract items from Column E (index 4) onwards where quantity is entered
    const orderItems: OrderItem[] = [];
    for (let c = 4; c < row.length; c++) {
      const cellQty = row[c] ? row[c].trim() : '';
      if (!cellQty || cellQty === '0' || cellQty === '-') {
        continue;
      }

      const itemName = cleanHeaderName(rawHeaders[c], c - 3);
      if (!itemName) continue;

      orderItems.push({
        id: `item-${r}-${c}`,
        name: itemName,
        qty: cellQty,
        colIndex: c,
        checked: false,
      });
    }

    const parsedDate = parseSheetDate(timestamp || rawDate);

    const rawRowObj: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      if (h) rawRowObj[h] = row[idx] ? String(row[idx]).trim() : '';
    });

    const orderObj: Order = {
      id: `הזמנה #${r + 1}`,
      rowNumber: r + 1,
      timestamp: timestamp || rawDate || `שורה ${r + 1}`,
      rawDate,
      parsedDate,
      department: department || 'ללא מחלקה',
      patientsCount,
      items: orderItems,
      totalItemsCount: orderItems.length,
      printed: false,
      rawRow: rawRowObj,
    };

    orders.push(orderObj);
  }

  // Sort orders descending by row number (newest orders at the top)
  orders.sort((a, b) => b.rowNumber - a.rowNumber);

  return {
    orders,
    productHeaders,
    totalRows: orders.length,
    departments: Array.from(deptSet).sort(),
  };
}

/**
 * Returns mock orders for preview
 */
export function getMockCurrentWeekOrders(): Order[] {
  return [
    {
      id: 'הזמנה #302',
      rowNumber: 302,
      timestamp: '12/08/2026 08:18:13',
      rawDate: '12/08/2026',
      parsedDate: new Date(),
      department: "ג' 2 סיעוד מורכב",
      patientsCount: '15',
      items: [
        { id: 'item-1', name: 'profix 10', qty: '3' },
        { id: 'item-2', name: 'אפליקטור 100 יחידות', qty: '1' },
        { id: 'item-3', name: 'דוקרנים לסוכר', qty: '3' },
        { id: 'item-4', name: '1 דליים של מגבונים לחים', qty: '1' },
        { id: 'item-5', name: 'כפפות ניטרל M', qty: '2' },
        { id: 'item-6', name: 'כפפות ניטרל L', qty: '2' },
        { id: 'item-7', name: 'מזרק 2.5 סמ"ק 100 יחידות', qty: '1' },
        { id: 'item-8', name: 'מסכות כירורגיות 50 יחידות', qty: '3' },
        { id: 'item-9', name: 'סט הזנה בגרוויטציה 30 יחידות', qty: '1' },
        { id: 'item-10', name: 'פד גאזה 10X10 שמונה שכבות 100 יחידות', qty: '12' },
        { id: 'item-11', name: 'תחבושת אגד אלסטי 10X2.5 ס"מ', qty: '200' },
      ],
      totalItemsCount: 11,
      printed: false,
      rawRow: {},
    },
    {
      id: 'הזמנה #301',
      rowNumber: 301,
      timestamp: '09/08/2026 07:38:30',
      rawDate: '09/08/2026',
      parsedDate: new Date(Date.now() - 86400000 * 3),
      department: "סיעודית א'",
      patientsCount: '20',
      items: [
        { id: 'item-1', name: 'אגד אלסטי רוחב 10 ס"מ דגם C-80', qty: '1' },
        { id: 'item-2', name: 'מטושים TRASYSTEM (100 יח\')', qty: '1' },
        { id: 'item-3', name: 'profix 15', qty: '3' },
        { id: 'item-4', name: 'דוקרנים לסוכר', qty: '1' },
        { id: 'item-5', name: 'כוסיות לחלוקת תרופות', qty: '20' },
        { id: 'item-6', name: 'כפפות ניטרל M', qty: '36' },
      ],
      totalItemsCount: 6,
      printed: false,
      rawRow: {},
    },
  ];
}
