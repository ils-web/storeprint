import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

async function checkOrders() {
  console.log('--- Checking Firestore Orders ---');
  // Check tenants/tenant-main-01/orders
  const snap = await getDocs(collection(db, 'tenants', 'tenant-main-01', 'orders'));
  console.log(`Total orders in tenants/tenant-main-01/orders: ${snap.size}`);
  snap.docs.forEach((d) => {
    const data = d.data();
    console.log(`Order ID: ${d.id} | Order#: ${data.orderNumber} | Dept: "${data.department}" | Items: ${(data.items || []).length} | Date: ${data.createdAt} | Printed: ${data.printed}`);
  });
}

checkOrders().catch(console.error).finally(() => process.exit(0));
