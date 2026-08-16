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
 * Fetches stock data from the configured cloud endpoint (Google Apps Script Web App or custom API)
 */
export async function fetchStockFromCloud(
  config: CloudSyncConfig
): Promise<Record<string, StockItem> | null> {
  if (!config.enabled || !config.endpointUrl) return null;

  try {
    const url = new URL(config.endpointUrl);
    url.searchParams.set('action', 'getStock');
    url.searchParams.set('t', Date.now().toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת ענן (${response.status})`);
    }

    const data = await response.json();
    if (data && typeof data === 'object') {
      return data.stock || data;
    }
    return null;
  } catch (err) {
    console.warn('Cloud stock fetch error:', err);
    throw err;
  }
}

/**
 * Pushes updated stock data to the cloud endpoint
 */
export async function pushStockToCloud(
  stock: Record<string, StockItem>,
  config: CloudSyncConfig
): Promise<boolean> {
  if (!config.enabled || !config.endpointUrl) return false;

  try {
    const response = await fetch(config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // CORS-friendly for Google Apps Script
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        action: 'saveStock',
        stock,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`שגיאת שמירה בענן (${response.status})`);
    }

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
    var data = sheet.getDataRange().getValues();
    var stock = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var name = row[0];
      var currentStock = Number(row[1]) || 0;
      var minThreshold = Number(row[2]) || 10;
      if (name) {
        stock[name] = {
          id: 'stock-' + (i + 3),
          name: name,
          colIndex: i + 3,
          currentStock: currentStock,
          minThreshold: minThreshold,
          lastUpdated: row[3] || ''
        };
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', stock: stock }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('מלאי') || createStockSheet(ss);
    var stock = body.stock;

    if (stock) {
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

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function createStockSheet(ss) {
  var sheet = ss.insertSheet('מלאי');
  sheet.appendRow(['שם הפריט', 'יתרת מלאי', 'סף מינימום', 'עדכון אחרון']);
  return sheet;
}
`;
}
