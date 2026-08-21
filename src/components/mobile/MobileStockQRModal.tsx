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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-sky-500/25 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl text-white">ספירת מלאי מהטלפון</h3>
              <p className="text-sm text-slate-300 font-medium mt-0.5">סריקה מהירה ועדכון כמויות בין מדפי המחסן</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Body */}
        <div className="p-6 sm:p-7 text-center space-y-5">
          <div className="bg-white p-5 rounded-3xl inline-block shadow-xl border-2 border-slate-200">
            <img src={qrImageUrl} alt="Mobile Stock QR" className="w-56 h-56 object-contain" />
          </div>

          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 text-right space-y-2">
            <strong className="text-white block font-black text-base">📱 איך זה עובד:</strong>
            <p className="text-sm text-slate-300">1. פותחים את מצלמת הטלפון וסורקים את הקוד.</p>
            <p className="text-sm text-slate-300">2. נפתח ממשק מותאם מובייל עם כפתורי מגע גדולים (+10, +1, -1, -10).</p>
            <p className="text-sm text-slate-300">3. כל שינוי נשמר מיידית ומסונכרן עם המחשב הראשי!</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handlePrint}
              className="flex-1 py-3.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-600/30"
            >
              <Printer className="w-5 h-5" />
              <span>הדפס שלט QR למחסן</span>
            </button>

            <button
              onClick={handleCopy}
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border border-slate-700"
            >
              {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              <span>{copied ? 'הועתק!' : 'העתק קישור'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
