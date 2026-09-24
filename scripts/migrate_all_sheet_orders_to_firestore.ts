import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { DEFAULT_SPREADSHEET_ID, DEFAULT_GID, fetchPublicCsvValues } from '../src/utils/googleSheets';
import { ingestGoogleFormsOrders, getOrderPrintKey } from '../src/services/unifiedDb';
import { MultiTenantOrder } from '../src/types/multiTenant';

const FIREBASE_CONFIG = {
  projectId: "storeprint-8fab1",
  appId: "1:796973894702:web:e20b822681117494f423bf",
  apiKey: "AIzaSyAvk9urcRChSpRge0az1Wx59EfzpKR6A3Q",
  authDomain: "storeprint-8fab1.firebaseapp.com",
  storageBucket: "storeprint-8fab1.firebasestorage.app",
  messagingSenderId: "796973894702",
  measurementId: "G-VQHD2GVQKR",
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

async function migrate() {
  console.log('--- 1. Fetching printed keys from Firestore ---');
  const printedDoc = await doc(db, 'tenants', 'tenant-main-01', 'warehouse', 'printed_orders');
  const printedSnap = await (await import('firebase/firestore')).getDoc(printedDoc);
  const printedKeys = new Set<string>();
  if (printedSnap.exists()) {
    const list = printedSnap.data().keys || [];
    list.forEach((k: string) => printedKeys.add(k));
  }
  console.log(`Found ${printedKeys.size} printed keys in Firestore.`);

  console.log('--- 2. Fetching Google Sheet CSV ---');
  const rows = await fetchPublicCsvValues(DEFAULT_SPREADSHEET_ID, DEFAULT_GID);
  console.log(`Fetched ${rows.length} rows.`);

  const result = ingestGoogleFormsOrders(rows, printedKeys);
  console.log(`Parsed ${result.orders.length} orders.`);

  console.log('--- 3. Converting to MultiTenantOrder and writing to Firestore ---');
  const tenantId = 'tenant-main-01';
  const warehouseId = 'wh-main-01';

  // Firestore allows up to 500 operations per batch
  let batch = writeBatch(db);
  let batchCount = 0;
  let totalSaved = 0;

  for (let i = 0; i < result.orders.length; i++) {
    const o = result.orders[i];
    const isPrinted = o.printed || printedKeys.has(o.id) || printedKeys.has(getOrderPrintKey(o));
    
    // Parse order date
    let isoDate = new Date().toISOString();
    if (o.parsedDate instanceof Date && !isNaN(o.parsedDate.getTime())) {
      isoDate = o.parsedDate.toISOString();
    }

    const orderDocId = `sheet-${o.rowNumber || i + 1}`;
    const orderData: MultiTenantOrder = {
      id: orderDocId,
      tenantId,
      warehouseId,
      departmentId: `dept-${encodeURIComponent(o.department || 'general')}`,
      departmentName: o.department || 'כללי',
      patientsCount: o.patientsCount || '',
      orderNumber: `ORD-${String(o.rowNumber || i + 1).padStart(4, '0')}`,
      items: (o.items || []).map((it, idx) => ({
        id: `item-${idx}`,
        productId: `stock-${it.colIndex || idx + 4}`,
        name: it.name,
        orderedQty: it.numericQty || parseFloat(String(it.qty).replace(/[^\d.]/g, '')) || 0,
        orderedUnit: "יח'",
        checked: Boolean(it.checked),
      })),
      totalItemsCount: (o.items || []).length,
      notes: o.patientsCount || '',
      status: isPrinted ? 'PRINTED' : 'NEW',
      source: 'GOOGLE_FORM',
      printed: isPrinted,
      printedAt: isPrinted ? isoDate : undefined,
      createdAt: isoDate,
      rawGoogleSheetRow: o.rowNumber,
    };

    const docRef = doc(db, 'tenants', tenantId, 'orders', orderDocId);
    batch.set(docRef, JSON.parse(JSON.stringify(orderData)));
    batchCount++;
    totalSaved++;

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`Committed batch of ${batchCount} orders (total ${totalSaved})...`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} orders (total ${totalSaved}).`);
  }

  console.log(`✅ Successfully migrated all ${totalSaved} orders into Firestore tenants/tenant-main-01/orders!`);
}

migrate().catch(console.error).finally(() => process.exit(0));
