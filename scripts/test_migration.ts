import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { DEFAULT_SPREADSHEET_ID, DEFAULT_GID, fetchPublicCsvValues } from '../src/utils/googleSheets';
import { ingestGoogleFormsOrders } from '../src/services/unifiedDb';
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

async function previewMigration() {
  console.log('Fetching Google Sheet CSV...');
  const rows = await fetchPublicCsvValues(DEFAULT_SPREADSHEET_ID, DEFAULT_GID);
  console.log(`Fetched ${rows.length} rows.`);

  const result = ingestGoogleFormsOrders(rows, new Set());
  console.log(`Parsed ${result.orders.length} orders from Google Sheet.`);

  // Sample order
  if (result.orders.length > 0) {
    const sample = result.orders[result.orders.length - 1];
    console.log('Sample order:', {
      id: sample.id,
      department: sample.department,
      date: sample.date,
      time: sample.time,
      itemsCount: sample.items.length,
      itemsSample: sample.items.slice(0, 3),
    });
  }
}

previewMigration().catch(console.error).finally(() => process.exit(0));
