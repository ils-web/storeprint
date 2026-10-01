import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Share2,
  CheckCircle2,
  X,
  Sparkles,
  Monitor,
  Printer,
  QrCode,
  Copy,
  Package,
} from 'lucide-react';

interface InstallStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
  tenantName?: string;
}

export function InstallStockModal({
  isOpen,
  onClose,
  tenantId,
  tenantName = 'מחסן ראשי',
}: InstallStockModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'android' | 'ios' | 'desktop'>('qr');
  const [copiedLink, setCopiedLink] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ils-web.github.io';
  const cleanPath = typeof window !== 'undefined'
    ? window.location.pathname
        .replace(/\/index\.html$/i, '')
        .replace(/\/order(\.html)?$/i, '')
        .replace(/\/stock(\.html)?$/i, '')
        .replace(/\/$/, '')
    : '/storeprint';
  const tenantQuery = tenantId ? `?tenant=${encodeURIComponent(tenantId)}` : '';
  const stockUrl = `${origin}${cleanPath}/stock.html${tenantQuery}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(stockUrl)}`;

  useEffect(() => {
    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    setActiveTab('qr');

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTriggerNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        onClose();
      }
      setDeferredPrompt(null);
    } else {
      alert('להתקנה מהירה: פתחו את תפריט הדפדפן (3 נקודות ⋮ באנדרואיד / כרום, או כפתור שיתוף ⎋ באייפון) ולחצו "התקנת אפליקציה" או "הוסף למסך הבית".');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(stockUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrintPoster = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('נא לאפשר חלונות קופצים (Pop-ups) בדפדפן כדי להדפיס.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <title>שלט התקנת אפליקציית ספירת מלאי למחסן - StorePrint</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Assistant', Arial, sans-serif; }
          body { background: #fff; color: #0f172a; padding: 25px; text-align: center; }
          .card { max-width: 540px; margin: 0 auto; border: 4px solid #0284c7; border-radius: 28px; padding: 32px 28px; box-shadow: 0 10px 25px rgba(2, 132, 199, 0.12); }
          .badge { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 6px 18px; border-radius: 999px; font-weight: 800; font-size: 14px; margin-bottom: 12px; }
          .title { font-size: 30px; font-weight: 900; color: #0f172a; line-height: 1.2; margin-bottom: 8px; }
          .subtitle { font-size: 17px; color: #475569; font-weight: 600; margin-bottom: 22px; }
          .qr-wrapper { background: #f8fafc; border: 3px solid #cbd5e1; border-radius: 24px; padding: 18px; display: inline-block; margin-bottom: 20px; }
          .qr-img { width: 230px; height: 230px; display: block; border-radius: 12px; }
          .scan-badge { margin-top: 10px; font-weight: 800; font-size: 15px; color: #0284c7; }
          .steps { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 20px; padding: 18px 22px; text-align: right; margin-bottom: 22px; }
          .steps h4 { font-size: 16px; font-weight: 900; color: #166534; margin-bottom: 8px; }
          .steps ol { padding-right: 20px; font-size: 14px; color: #14532d; font-weight: 600; line-height: 1.6; }
          .url-box { font-family: monospace; font-size: 13px; color: #64748b; background: #f1f5f9; padding: 8px 12px; border-radius: 10px; word-break: break-all; margin-top: 10px; }
          .footer { font-size: 12px; color: #94a3b8; font-weight: 600; margin-top: 14px; }
          @media print {
            body { padding: 0; }
            .card { border-width: 3px; box-shadow: none; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">אפליקציה עצמאית למחסן 📦</div>
          <h1 class="title">ספירת מלאי ישירות מהנייד</h1>
          <p class="subtitle">${tenantName} — סריקה מהירה והוספה למסך הבית</p>
          
          <div class="qr-wrapper">
            <img src="${qrImageUrl}" class="qr-img" alt="QR ספירת מלאי" />
            <div class="scan-badge">סרקו במצלמת הטלפון לפתיחה והתקנה 📱</div>
          </div>

          <div class="steps">
            <h4>📋 איך מתקינים תוך 10 שניות:</h4>
            <ol>
              <li>סרקו את קוד ה-QR במצלמת הסמארטפון ופתחו את הקישור.</li>
              <li>באנדרואיד: לחצו על 3 הנקודות (⋮) &gt; <strong>"התקנת אפליקציה"</strong> או <strong>"הוסף למסך הבית"</strong>.</li>
              <li>באייפון: לחצו על כפתור השיתוף (⎋) &gt; <strong>"הוסף למסך הבית ➕"</strong>.</li>
              <li>האפליקציה מותקנת כאיקון עצמאי במסך הבית ומסונכרנת עם המחסן בזמן אמת!</li>
            </ol>
          </div>

          <div class="url-box">${stockUrl}</div>
          <div class="footer">StorePrint — מערכת ניהול מלאי מתקדמת</div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-950 via-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">
                התקנת אפליקציית ספירת מלאי 📦
              </h3>
              <p className="text-xs text-sky-300 font-medium">
                אפליקציה עצמאית למחסן — פתיחה והתקנה מהירה בנייד
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1 shrink-0 text-xs font-black">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>סריקה ו-QR</span>
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'android'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>אנדרואיד</span>
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>אייפון</span>
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>מחשב</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Status Badge */}
          {isInstalled ? (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>
                <strong>האפליקציה מותקנת במכשיר זה!</strong> ניתן להדפיס או לסרוק את ה-QR כדי להתקין בטלפונים נוספים של המחסנאים.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-sky-950/40 border border-sky-500/40 rounded-2xl flex items-center justify-between gap-3 text-sky-200 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                <span>ניתן להתקין ישירות כאפליקציה עצמאית במכשיר זה</span>
              </div>
              <button
                onClick={handleTriggerNativeInstall}
                className="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>התקן כעת</span>
              </button>
            </div>
          )}

          {/* TAB 1: QR & Fast Scan */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center">
              <div className="bg-white p-4 rounded-3xl inline-block shadow-xl border-2 border-slate-200">
                <img
                  src={qrImageUrl}
                  alt="QR ספירת מלאי במובייל"
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain mx-auto"
                />
                <p className="text-[11px] font-bold text-slate-600 mt-2">
                  סרקו במצלמת הטלפון להתקנה מיידית
                </p>
              </div>

              {/* Warehouse Details Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-right space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>אפליקציה עצמאית למחסן: {tenantName}</span>
                  </span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                    ספירת מלאי 📱
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  התקינו את האפליקציה על טלפון המחסנאי. האפליקציה פועלת במסך מלא, עובדת במהירות בין המדפים ומעדכנת את המלאי המרכזי בענן באופן מיידי!
                </p>
              </div>

              {/* Action Buttons: Print Poster & Copy Link */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={handlePrintPoster}
                  className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>הדפס שלט QR למחסן 🖨️</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'הקישור הועתק!' : 'העתק קישור'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Android Instructions */}
          {activeTab === 'android' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs">1</span>
                  <span>סרקו את ה-QR או פתחו את הקישור בדפדפן Chrome</span>
                </h4>
                <p className="text-slate-400 pr-8">
                  היכנסו לקישור האפליקציה בסמארטפון באמצעות דפדפן Google Chrome.
                </p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs">2</span>
                  <span>לחצו על 3 הנקודות (⋮) בפינה העליונה</span>
                </h4>
                <p className="text-slate-400 pr-8">
                  פתחו את תפריט הדפדפן ובחרו באפשרות <strong>"התקנת אפליקציה" (Install App)</strong> או <strong>"הוסף למסך הבית"</strong>.
                </p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">3</span>
                  <span>אישור והופעת האיקון הייעודי במסך הבית</span>
                </h4>
                <p className="text-slate-400 pr-8">
                  אשרו את ההתקנה. האפליקציה תופיע במסך הבית עם איקון ארגז המחסן 📦 ותיפתח כאפליקציה עצמאית ללא סרגלי דפדפן.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: iOS Instructions */}
          {activeTab === 'ios' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs">1</span>
                  <span>פתחו את הקישור בדפדפן Safari של אפל</span>
                </h4>
                <p className="text-slate-400 pr-8">
                  סרקו במצלמת האייפון ופתחו ב-Safari (דפדפן ברירת המחדל של iOS).
                </p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs">2</span>
                  <span>לחצו על כפתור השיתוף (Share ⎋)</span>
                </h4>
                <p className="text-slate-400 pr-8">
                  בתחתית המסך של Safari, לחצו על כפתור השיתוף (מרובע עם חץ הפונה מעלה).
                </p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">3</span>
                  <span>בחרו באפשרות "הוסף למסך הבית" (Add to Home Screen ➕)</span>
                </h4>
                <p className="text-slate-400 pr-8">
                  גללו ברשימה, לחצו על "הוסף למסך הבית" ואשרו. האפליקציה תותקן כאפליקציה עצמאית לחלוטין!
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Desktop Instructions */}
          {activeTab === 'desktop' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-sky-400" />
                  <span>התקנה ב-Google Chrome או Microsoft Edge במחשב</span>
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  אם אתם צופים בעמוד זה במחשב, ניתן להתקין את ממשק ספירת המלאי כחלון עצמאי בשולחן העבודה:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 font-semibold pr-2">
                  <li>חפשו את איקון ההתקנה (⊕ או מחשב עם חץ) בשורת הכתובת של הדפדפן.</li>
                  <li>או לחצו על כפתור "התקן כעת" בראש חלון זה.</li>
                  <li>התוכנה תותקן כאפליקציה עצמאית בשולחן העבודה של Windows או Mac.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>אפליקציית PWA עצמאית ללא תלות בחנויות אפליקציות</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
