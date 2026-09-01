import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OrderApp from './OrderApp.tsx';
import './index.css';

// Register Service Worker for PWA support
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('SW registration skipped:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrderApp />
  </StrictMode>,
);
