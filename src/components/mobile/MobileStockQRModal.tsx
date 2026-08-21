import React, { useState } from 'react';
import { QrCode, Smartphone, X, Copy, CheckCircle2, ExternalLink, Printer } from 'lucide-react';

interface MobileStockQRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileStockQRModal({ isOpen, onClose }: MobileStockQRModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const mobileStockUrl = `${origin}/?view=mobile_stock`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(mobileStockUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileStockUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <title>QR ספירת מלאי במחסן - StorePrint</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Assistant', Arial, sans-serif; }
          body { padding: 40px; text-align: center; color: #0f172a; }
          .card { max-width: 500px; margin: 0 auto; border: 3px solid #0284c7; border-radius: 24px; padding: 30px; }
          .logo { font-size: 22px; font-weight: 800; color: #0284c7; }
          .title { font-size: 26px; font-weight: 800; margin-top: 5px; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 2px; margin-bottom: 20px; }
          .qr-img { width: 220px; height: 220px; margin: 0 auto 20px auto; display: block; border: 2px solid #e2e8f0; border-radius: 16px; padding: 10px; }
          .box { background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 16px; padding: 15px; text-align: right; margin-bottom: 20px; font-size: 13px; color: #166534; line-height: 1.6; }
          .footer { font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">StorePrint 📦</div>
          <div class="title">ספירת ובקרת מלאי במחסן</div>
          <div class="subtitle">גישה מהירה מהסמארטפון לצוות המחסן</div>
          <img src="${qrImageUrl}" class="qr-img" />
          <div class="box">
            <strong>📋 הנחיות שימוש למחסנאי:</strong><br>
            1. סרקו את ה-QR במצלמת הטלפון.<br>
            2. עברו בין המדפים והקישו כמויות במקשים מהירים (+10, +1, -1, -10).<br>
            3. המלאי מתעדכן בזמן אמת במערכת המרכזית ובענן.
          </div>
          <div class="footer">${mobileStockUrl}</div>
        </div>
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 400); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">ספירת מלאי מהטלפון</h3>
              <p className="text-xs text-slate-400">סריקה וספירה מהירה בין המדפים</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Body */}
        <div className="p-6 text-center space-y-4">
          <div className="bg-white p-4 rounded-2xl inline-block shadow-md">
            <img src={qrImageUrl} alt="Mobile Stock QR" className="w-48 h-48 object-contain" />
          </div>

          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-300 text-right space-y-1">
            <strong className="text-white block font-bold">📱 איך זה עובד:</strong>
            <p className="text-[11px] text-slate-400">1. סרקו את הקוד במצלמת הטלפון.</p>
            <p className="text-[11px] text-slate-400">2. עברו בין המדפים ועדכנו כמויות בקלות עם כפתורי מגע גדולים.</p>
            <p className="text-[11px] text-slate-400">3. המלאי מתעדכן אוטומטית במערכת הראשית.</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handlePrint}
              className="py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>הדפס שלט למחסן</span>
            </button>

            <button
              onClick={handleCopy}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'הועתק!' : 'העתק קישור'}</span>
            </button>
          </div>

          <a
            href={mobileStockUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1 mt-2"
          >
            <span>פתח מסך מובייל בדפדפן</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
