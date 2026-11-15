import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OrderApp from './OrderApp.tsx';
import './index.css';

// Register Service Worker for PWA support
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    const swPath = /\/(order|stock)\//i.test(window.location.pathname) ? '../sw.js' : './sw.js';
    navigator.serviceWorker.register(swPath).then((reg) => {
      reg.update().catch(() => {});
    }).catch((err) => {
      console.log('SW registration skipped:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrderApp />
  </StrictMode>,
);
