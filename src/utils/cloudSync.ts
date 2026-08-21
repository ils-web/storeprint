import { StockItem, CloudSyncConfig } from '../types';

const CLOUD_CONFIG_STORAGE_KEY = 'storeprint_cloud_config_v1';

export const DEFAULT_CLOUD_CONFIG: CloudSyncConfig = {
  enabled: true,
  syncType: 'webhook',
  endpointUrl: 'https://script.google.com/macros/s/AKfycbw9WnCTi0kc-lzRHVGZtNRW6KXgfEhGdBsKK1WW7PQKqPlhOFfAdz1xNSGKzsoSnjO2/exec',
  apiKey: '',
  autoSyncOnPrint: true,
  lastSyncedAt: undefined,
};

/**
 * Formats current date and time as DD/MM/YYYY HH:mm:ss (Israel local time)
 */
export function formatIsraelDateTime(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${min}:${sec}`;
}

/**
 * Loads cloud sync configuration from localStorage
 */
export function loadCloudConfig(): CloudSyncConfig {
  if (typeof window === 'undefined') return DEFAULT_CLOUD_CONFIG;
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CLOUD_CONFIG;
    return { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Failed to load cloud config:', err);
    return DEFAULT_CLOUD_CONFIG;
  }
}

/**
 * Saves cloud sync configuration to localStorage
 */
export function saveCloudConfig(config: CloudSyncConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLOUD_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save cloud config:', err);
  }
}

/**
 * Validates and normalizes Google Apps Script Web App URL
 */
export function normalizeCloudUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  url = url.replace(/^["']|["']$/g, '');
  return url;
}

/**
 * Tests connection to the Google Apps Script Web App endpoint
 */
export async function testCloudConnection(
  endpointUrl: string
): Promise<{ success: boolean; message?: string; stock?: Record<string, StockItem>; sheetUrl?: string }> {
  const cleanUrl = normalizeCloudUrl(endpointUrl);
  if (!cleanUrl) {
    return { success: false, message: 'נא להזין כתובת URL תקינה' };
  }

  if (!cleanUrl.includes('script.google.com') || !cleanUrl.includes('/exec')) {
    return {
      success: false,
      message: 'קישור Google Apps Script חייב להסתיים ב-/exec. ודאו שהעתקתם את ה-Web App URL המלא.',
    };
  }

  try {
    const url = new URL(cleanUrl);
    url.searchParams.set('action', 'getStock');
    url.searchParams.set('t', Date.now().toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          message: 'שגיאה 404: הפריסה טרם פורסמה! ודאו שלחצתם על הכפתור הכחול "לפריסה" (Deploy) ב-Apps Script.',
        };
      }
      return { success: false, message: `שגיאת שרת (${response.status})` };
    }

    const data = await response.json();
    if (data && (data.status === 'success' || data.stock !== undefined)) {
      return {
        success: true,
        stock: data.stock || {},
        sheetUrl: data.sheetUrl,
      };
    }

    return { success: false, message: data.message || 'תגובה לא מזוהה מהשרת' };
  } catch (err: any) {
    console.warn('Test connection error:', err);
    return {
      success: false,
      message: 'לא ניתן לגשת לקישור. ודאו שב-Apps Script לחצתם "לפריסה" (Deploy) ובחרתם ב-Who has access: Anyone (כולם).',
    };
  }
}

/**
 * Fetches stock data from the configured cloud endpoint
 */
export async function fetchStockFromCloud(
  config: CloudSyncConfig
): Promise<Record<string, StockItem> | null> {
  const cleanUrl = normalizeCloudUrl(config.endpointUrl);
  if (!cleanUrl) return null;

  try {
    const url = new URL(cleanUrl);
    url.searchParams.set('action', 'getStock');
    url.searchParams.set('t', Date.now().toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת ענן (${response.status})`);
    }

    const data = await response.json();
    if (data && (data.status === 'success' || data.stock !== undefined)) {
      return data.stock || {};
    }
    return null;
  } catch (err) {
    console.warn('Cloud stock fetch error:', err);
    throw err;
  }
}

/**
 * Pushes updated stock data to the Google Apps Script cloud endpoint
 */
export async function pushStockToCloud(
  stock: Record<string, StockItem>,
  config: CloudSyncConfig
): Promise<boolean> {
  const cleanUrl = normalizeCloudUrl(config.endpointUrl);
  if (!cleanUrl) return false;

  try {
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors', // Ensures zero CORS blocking in all browsers
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'saveStock',
        stock,
        timestamp: formatIsraelDateTime(),
      }),
    });
    return true;
  } catch (err) {
    console.warn('Cloud stock push error:', err);
    throw err;
  }
}

let pushDebounceTimer: any = null;

/**
 * Debounced push of stock data to prevent network flooding and UI jumping
 */
export function debouncedPushStockToCloud(
  stock: Record<string, StockItem>,
  config: CloudSyncConfig,
  delayMs: number = 1500
): Promise<boolean> {
  return new Promise((resolve) => {
    if (pushDebounceTimer) {
      clearTimeout(pushDebounceTimer);
    }
    pushDebounceTimer = setTimeout(async () => {
      try {
        const ok = await pushStockToCloud(stock, config);
        resolve(ok);
      } catch {
        resolve(false);
      }
    }, delayMs);
  });
}

/**
 * Department order payload structure
 */
export interface DepartmentOrderPayload {
  department: string;
  orderedBy?: string;
  patientsCount?: string;
  notes?: string;
  items: Record<string, { qty: number; unit?: string }>;
}

/**
 * Submits a new department order directly to Google Sheets via Google Apps Script
 */
export async function submitDepartmentOrderToCloud(
  payload: DepartmentOrderPayload,
  config: CloudSyncConfig
): Promise<{ success: boolean; message?: string; orderId?: string; timestamp?: string }> {
  const cleanUrl = normalizeCloudUrl(config.endpointUrl);
  if (!cleanUrl) {
    return { success: false, message: 'קישור הענן (Web App) אינו מוגדר בהגדרות המערכת' };
  }

  const cleanItems: Record<string, string | number> = {};
  Object.keys(payload.items).forEach((name) => {
    const item = payload.items[name];
    if (item.qty > 0) {
      cleanItems[name] = item.unit && item.unit !== "יח'" ? `${item.qty} ${item.unit}` : item.qty;
    }
  });

  const bodyData = {
    action: 'submitDepartmentOrder',
    department: payload.department,
    orderedBy: payload.orderedBy || '',
    patientsCount: payload.patientsCount || '',
    notes: payload.notes || '',
    items: cleanItems,
    timestamp: formatIsraelDateTime(),
  };

  try {
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors', // Avoid CORS errors across browsers
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(bodyData),
    });

    return {
      success: true,
      orderId: `ORD-${Date.now().toString().slice(-6)}`,
      timestamp: formatIsraelDateTime(),
      message: 'ההזמנה נשלחה בהצלחה ונרשמה בטבלת Google Sheets!',
    };
  } catch (err: any) {
    console.warn('Submit department order failed:', err);
    return {
      success: false,
      message: err.message || 'שגיאת רשת בשליחת ההזמנה',
    };
  }
}

/**
 * Generates the Universal Google Apps Script code (works both standalone and inside sheets)
 */
export function generateGoogleAppsScriptCode(): string {
  return `/**
 * StorePrint Cloud Warehouse & Department Orders Backend (v3.0)
 * תומך ב: 
 * 1. סנכרון מלאי מחסן
 * 2. רישום וכתיבה ישירה של הזמנות מחלקות (במקביל ל-Google Forms)
 */

function doGet(e) {
  try {
    // If submitting order via GET
    if (e && e.parameter && e.parameter.action === 'submitDepartmentOrder' && e.parameter.data) {
      var orderData = JSON.parse(e.parameter.data);
      var res = submitDepartmentOrderToSheet(orderData);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = getOrCreateSpreadsheet();
    var sheet = ss.getSheetByName('מלאי') || createStockSheet(ss);

    // If saving stock via GET parameter
    if (e && e.parameter && e.parameter.action === 'saveStock' && e.parameter.data) {
      var stock = JSON.parse(e.parameter.data);
      saveStockToSheet(sheet, stock);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', saved: true, sheetUrl: ss.getUrl() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Default: return stock
    var data = sheet.getDataRange().getValues();
    var stock = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var name = String(row[0] || '').trim();
      var currentStock = Number(row[1]) || 0;
      var unit = "יח'";
      var minThreshold = 10;
      var lastUpdated = '';

      var col2 = row[2];
      var col3 = row[3];
      var col4 = row[4];

      // Smart column detection
      if (typeof col2 === 'string' && isNaN(Number(col2)) && col2.trim().length > 0 && !col2.includes('/') && !col2.includes(':')) {
        unit = String(col2).trim();
        minThreshold = Number(col3) || 10;
        lastUpdated = String(col4 || '');
      } else if (!isNaN(Number(col2)) && col2 !== '' && col2 !== null) {
        minThreshold = Number(col2) || 10;
        lastUpdated = String(col3 || '');
        unit = "יח'";
      } else if (row.length >= 5) {
        unit = String(col2 || "יח'").trim();
        minThreshold = Number(col3) || 10;
        lastUpdated = String(col4 || '');
      } else {
        minThreshold = Number(col2) || 10;
        lastUpdated = String(col3 || '');
      }

      if (name) {
        stock[name] = {
          id: 'stock-' + (i + 3),
          name: name,
          colIndex: i + 3,
          currentStock: currentStock,
          minThreshold: minThreshold,
          unit: unit,
          lastUpdated: lastUpdated
        };
      }
    }

    var output = ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      count: Object.keys(stock).length,
      sheetUrl: ss.getUrl(),
      stock: stock
    }));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  } catch (err) {
    var errOutput = ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }));
    errOutput.setMimeType(ContentService.MimeType.JSON);
    return errOutput;
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.data) {
      body = JSON.parse(e.parameter.data);
    }
    
    // Action 1: Submit Department Order (Direct Write to Google Sheet)
    if (body.action === 'submitDepartmentOrder') {
      var orderResult = submitDepartmentOrderToSheet(body);
      var outputOrder = ContentService.createTextOutput(JSON.stringify(orderResult));
      outputOrder.setMimeType(ContentService.MimeType.JSON);
      return outputOrder;
    }
    
    // Action 2: Save Stock
    var ss = getOrCreateSpreadsheet();
    var sheet = ss.getSheetByName('מלאי') || createStockSheet(ss);
    var stock = body.stock;

    if (stock && typeof stock === 'object') {
      saveStockToSheet(sheet, stock);
    }

    var output = ContentService.createTextOutput(JSON.stringify({ status: 'success', saved: true, sheetUrl: ss.getUrl() }));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  } catch (err) {
    var errOutput = ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }));
    errOutput.setMimeType(ContentService.MimeType.JSON);
    return errOutput;
  }
}

function submitDepartmentOrderToSheet(body) {
  var ordersSpreadsheetId = '1NJq4sJV0HPvkKUXy6kot3FUA7dnKAHD-iWTVXIY4qms';
  var ss;
  try {
    ss = SpreadsheetApp.openById(ordersSpreadsheetId);
  } catch(e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) throw new Error('לא ניתן לגשת לטבלת ההזמנות');
  
  var sheet = ss.getSheetByName('תגובות לטופס 1') || ss.getSheets()[0];
  var lastCol = sheet.getLastColumn();
  
  // Read top 6 rows to locate exact header row
  var headerMatrix = sheet.getRange(1, 1, Math.min(6, sheet.getLastRow()), lastCol).getValues();
  var headerRowIdx = 3; // Default Row 4 (0-indexed 3)
  for (var r = 0; r < headerMatrix.length; r++) {
    var rowText = headerMatrix[r].join(' ');
    if (rowText.indexOf('חותמת זמן') !== -1 || rowText.indexOf('מחלקה') !== -1) {
      headerRowIdx = r;
      break;
    }
  }
  
  var headers = headerMatrix[headerRowIdx];
  var nowFormatted = Utilities.formatDate(new Date(), "Asia/Jerusalem", "dd/MM/yyyy HH:mm:ss");
  var dateOnly = Utilities.formatDate(new Date(), "Asia/Jerusalem", "dd/MM/yyyy");
  
  var newRow = new Array(headers.length);
  for (var k = 0; k < newRow.length; k++) newRow[k] = "";
  
  newRow[0] = nowFormatted; // Col A: Timestamp
  newRow[1] = dateOnly;     // Col B: Date
  newRow[2] = body.department || ""; // Col C: Department
  newRow[3] = body.patientsCount || body.notes || body.orderedBy || ""; // Col D: Patients / Notes
  
  // Fill ordered items matching column headers E..FM
  var items = body.items || {};
  for (var j = 4; j < headers.length; j++) {
    var colHeader = String(headers[j] || "").trim();
    if (colHeader && items[colHeader] !== undefined && items[colHeader] !== null && items[colHeader] !== "" && items[colHeader] !== 0) {
      newRow[j] = items[colHeader];
    }
  }
  
  sheet.appendRow(newRow);
  
  return {
    status: 'success',
    orderId: 'ORD-' + sheet.getLastRow(),
    rowNumber: sheet.getLastRow(),
    timestamp: nowFormatted,
    message: 'ההזמנה נקלטה בהצלחה בטבלה!'
  };
}

function getOrCreateSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('STOREPRINT_STOCK_SHEET_ID');
  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch(e) {}
  }

  // Auto-create spreadsheet in Google Drive if standalone project
  var newSs = SpreadsheetApp.create('StorePrint - ניהול מלאי ומחסן');
  props.setProperty('STOREPRINT_STOCK_SHEET_ID', newSs.getId());
  return newSs;
}

function saveStockToSheet(sheet, stock) {
  sheet.clearContents();
  sheet.appendRow(['שם הפריט', 'יתרת מלאי', 'יחידת מידה / אריזה', 'סף מינימום', 'עדכון אחרון']);
  
  var nowFormatted = Utilities.formatDate(new Date(), "Asia/Jerusalem", "dd/MM/yyyy HH:mm:ss");
  var rows = [];
  
  for (var name in stock) {
    var item = stock[name];
    var qty = (item.currentStock !== undefined && item.currentStock !== null) ? Number(item.currentStock) : 0;
    var unit = item.unit || "יח'";
    var threshold = (item.minThreshold !== undefined && item.minThreshold !== null) ? Number(item.minThreshold) : 10;
    rows.push([name, qty, unit, threshold, nowFormatted]);
  }
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    sheet.getRange(1, 1, rows.length + 1, 5).setHorizontalAlignment("right");
  }
}

function createStockSheet(ss) {
  var sheet = ss.getSheetByName('מלאי');
  if (!sheet) {
    sheet = ss.insertSheet('מלאי');
  }
  sheet.clearContents();
  sheet.appendRow(['שם הפריט', 'יתרת מלאי', 'יחידת מידה / אריזה', 'סף מינימום', 'עדכון אחרון']);
  return sheet;
}
`;
}
