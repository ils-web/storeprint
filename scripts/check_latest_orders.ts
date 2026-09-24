import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { DEFAULT_SPREADSHEET_ID, DEFAULT_GID, fetchPublicCsvValues } from '../src/utils/googleSheets';
import { ingestGoogleFormsOrders } from '../src/services/unifiedDb';

async function checkLatest() {
  const rows = await fetchPublicCsvValues(DEFAULT_SPREADSHEET_ID, DEFAULT_GID);
  const result = ingestGoogleFormsOrders(rows, new Set());
  console.log('Total orders:', result.orders.length);
  console.log('Latest 5 orders:');
  result.orders.slice(0, 5).forEach(o => {
    console.log(`[${o.id}] ${o.date} ${o.time} | Dept: ${o.department} | Items: ${o.items.length}`);
  });
}

checkLatest().catch(console.error).finally(() => process.exit(0));
