import { StockItem, CloudSyncConfig } from '../types';

const CLOUD_CONFIG_STORAGE_KEY = 'storeprint_cloud_config_v1';

export const DEFAULT_CLOUD_CONFIG: CloudSyncConfig = {
  enabled: false,
  syncType: 'webhook',
  endpointUrl: '',
  apiKey: '',
  autoSyncOnPrint: true,
  lastSyncedAt: undefined,
};

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
  // Fix missing /exec if user copied without it
  if (url.includes('script.google.com') && !url.endsWith('/exec') && !url.includes('/exec?')) {
    if (!url.endsWith('/')) url += '/';
    if (!url.endsWith('exec/')) url += 'exec';
  }
  return url;
}

/**
 * Tests connection to the Google Apps Script Web App endpoint
 */
export async function testCloudConnection(
  endpointUrl: string
): Promise<{ success: boolean; message?: string; stock?: Record<string, StockItem> }> {
  const cleanUrl = normalizeCloudUrl(endpointUrl);
  if (!cleanUrl) {
    return { success: false, message: 'נא להזין כתובת URL תקינה' };
  }

  if (cleanUrl.includes('script.google.com') && !cleanUrl.includes('/exec')) {
    return {
      success: false,
      message: 'הקישור אינו שלם! קישור Google Apps Script חייב להסתיים ב-/exec (לחצו על כפתור "העתקה" ב-Apps Script)',
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
          message: 'שגיאה 404: הקישור נחתך או שאינו קיים. אנא לחצו על כפתור "העתקה" (Copy) ב-Apps Script והדביקו מחדש.',
        };
      }
      return { success: false, message: `שגיאת שרת (${response.status})` };
    }

    const data = await response.json();
    if (data && (data.status === 'success' || data.stock !== undefined)) {
      return {
        success: true,
        stock: data.stock || {},
      };
    }

    return { success: false, message: data.message || 'תגובה לא מזוהה מהשרת' };
  } catch (err: any) {
    console.warn('Test connection error:', err);
    return {
      success: false,
      message: 'שגיאת גישה: ודאו שהקישור הועתק במלואו (כולל סיומת /exec) ושב-Who has access נבחר Anyone (כולם)',
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
    // Try POST with text/plain (CORS-friendly for Google Apps Script)
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors', // Ensures zero CORS blocking from any browser
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'saveStock',
        stock,
        timestamp: new Date().toISOString(),
      }),
    });

    return true;
  } catch (err) {
    console.warn('Cloud stock push error:', err);
    throw err;
  }
}

/**
 * Generates the Google Apps Script code for 1-click Google Sheet backend deployment
 */
export function generateGoogleAppsScriptCode(): string {
  return `/**
 * StorePrint Cloud Warehouse Sync Backend
 * הדבק קוד זה בתוך Google Sheets -> Extensions (הרחבות) -> Apps Script
 * ולאחר מכן לחץ על Deploy (פריסה) -> New Deployment -> Web App -> Anyone (כולם)
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('מלאי') || createStockSheet(ss);

    // If saving via GET parameter
    if (e && e.parameter && e.parameter.action === 'saveStock' && e.parameter.data) {
      var stock = JSON.parse(e.parameter.data);
      saveStockToSheet(sheet, stock);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', saved: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Default: get stock
    var data = sheet.getDataRange().getValues();
    var stock = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var name = String(row[0] || '').trim();
      var currentStock = Number(row[1]) || 0;
      var minThreshold = Number(row[2]) || 10;
      if (name) {
        stock[name] = {
          id: 'stock-' + (i + 3),
          name: name,
          colIndex: i + 3,
          currentStock: currentStock,
          minThreshold: minThreshold,
          lastUpdated: String(row[3] || '')
        };
      }
    }

    var output = ContentService.createTextOutput(JSON.stringify({ status: 'success', count: Object.keys(stock).length, stock: stock }));
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
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('מלאי') || createStockSheet(ss);
    var stock = body.stock;

    if (stock && typeof stock === 'object') {
      saveStockToSheet(sheet, stock);
    }

    var output = ContentService.createTextOutput(JSON.stringify({ status: 'success', saved: true }));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  } catch (err) {
    var errOutput = ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }));
    errOutput.setMimeType(ContentService.MimeType.JSON);
    return errOutput;
  }
}

function saveStockToSheet(sheet, stock) {
  sheet.clearContents();
  sheet.appendRow(['שם הפריט', 'יתרת מלאי', 'סף מינימום', 'עדכון אחרון']);
  
  var rows = [];
  for (var name in stock) {
    var item = stock[name];
    rows.push([name, item.currentStock, item.minThreshold || 10, new Date().toISOString()]);
  }
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }
}

function createStockSheet(ss) {
  var sheet = ss.getSheetByName('מלאי');
  if (!sheet) {
    sheet = ss.insertSheet('מלאי');
  }
  sheet.clearContents();
  sheet.appendRow(['שם הפריט', 'יתרת מלאי', 'סף מינימום', 'עדכון אחרון']);
  return sheet;
}
`;
}
