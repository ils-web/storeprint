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
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName?: string;
}

export function InstallAppModal({
  isOpen,
  onClose,
  tenantName = 'מרכז רפואי (סניף ראשי)',
}: InstallAppModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'android' | 'ios' | 'desktop'>('qr');
  const [copiedLink, setCopiedLink] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const portalUrl = `${origin}/?view=portal_pwa`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(portalUrl)}`;

  useEffect(() => {
    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Default to QR tab so the user can immediately scan or print
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
      alert('להתקנה מהירה: פתחו את תפריט הדפדפן (3 נקודות ⋮ באנדרואיד או כפתור שיתוף ⎋ באייפון) ולחצו "הוסף למסך הבית".');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
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
        <title>שלט התקנת אפליקציית הזמנות למחלקה - StorePrint</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Assistant', Arial, sans-serif; }
          body { background: #fff; color: #0f172a; padding: 25px; text-align: center; }
          
          .poster {
            max-width: 620px;
            margin: 0 auto;
            border: 4px solid #0284c7;
            border-radius: 28px;
            padding: 28px;
            background: #ffffff;
            box-shadow: 0 8px 30px rgba(0,0,0,0.06);
          }

          .header {
            margin-bottom: 20px;
            border-bottom: 3px solid #e2e8f0;
            padding-bottom: 14px;
          }
          .logo { font-size: 20pt; font-weight: 900; color: #0284c7; }
          .title { font-size: 19pt; font-weight: 900; color: #0f172a; margin-top: 6px; }
          .subtitle { font-size: 13pt; color: #475569; font-weight: 700; margin-top: 3px; }
          .tenant { font-size: 11pt; color: #64748b; font-weight: 600; margin-top: 2px; }

          .qr-frame {
            background: #f8fafc;
            border: 3px solid #cbd5e1;
            border-radius: 24px;
            padding: 20px;
            display: inline-block;
            margin: 16px auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.04);
          }
          .qr-img { width: 250px; height: 250px; display: block; margin: 0 auto; }
          .qr-caption { font-size: 13pt; font-weight: 800; color: #0369a1; margin-top: 10px; }

          .instructions-box {
            background: #f0fdf4;
            border: 2px dashed #16a34a;
            border-radius: 20px;
            padding: 18px 24px;
            text-align: right;
            margin-top: 16px;
          }
          .instructions-title { font-size: 14pt; font-weight: 900; color: #166534; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
          .instructions-list { font-size: 12pt; color: #1e293b; padding-right: 22px; line-height: 1.7; }
          .instructions-list li { margin-bottom: 6px; }

          .devices-hint {
            display: flex;
            justify-content: space-around;
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
            font-size: 11pt;
            font-weight: 700;
            color: #334155;
          }

          .footer {
            margin-top: 20px;
            font-size: 10pt;
            color: #64748b;
            border-top: 2px solid #e2e8f0;
            padding-top: 12px;
          }
          .url-hint { font-family: monospace; font-size: 9pt; color: #94a3b8; margin-top: 4px; word-break: break-all; }

          @media print {
            body { padding: 0; }
            .poster { border: 3px solid #000; box-shadow: none; max-width: 100%; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="poster">
          <div class="header">
            <div class="logo">StorePrint 📦</div>
            <div class="title">התקנת אפליקציית הזמנות למחלקה</div>
            <div class="subtitle">עבור צוות רפואי, אחיות ומזכירות מחלקה</div>
            <div class="tenant">${tenantName}</div>
          </div>

          <div class="qr-frame">
            <img src="${qrImageUrl}" alt="QR Installation Code" class="qr-img" />
            <div class="qr-caption">📲 סרקו במצלמת הטלפון להתקנה מיידית</div>
          </div>

          <div class="instructions-box">
            <div class="instructions-title">📋 כיצד להתקין ולהזמין מהסמארטפון:</div>
            <ol class="instructions-list">
              <li><strong>סרקו את קוד ה-QR</strong> באמצעות מצלמת הסמארטפון (או פתחו את הקישור).</li>
              <li><strong>הוסיפו למסך הבית:</strong>
                <br>• באנדרואיד: 3 נקודות (⋮) &gt; "הוספה למסך הבית".
                <br>• באייפון (Safari): כפתור שיתוף (⎋) &gt; "הוסף למסך הבית".
              </li>
              <li><strong>בוחרים מחלקה ומזמינים ציוד</strong> בכל שעה ישירות מהנייד!</li>
            </ol>
          </div>

          <div class="devices-hint">
            <span>📱 מתאים לאנדרואיד (Samsung / Xiaomi ועוד)</span>
            <span>🍏 מתאים לאייפון (iPhone / iPad)</span>
          </div>

          <div class="footer">
            <div>💡 שלט זה מיועד להדבקה בעמדת האחיות, בחדר הרופאים ובמזכירות המחלקה</div>
            <div class="url-hint">${portalUrl}</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 shrink-0">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-xl sm:text-2xl text-white">הורדת אפליקציית הזמנות למחלקה</h3>
              <p className="text-sm text-slate-300 font-medium mt-0.5">סריקה מהירה והדפסת שלט QR לצוות הרפואי</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Switcher Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-2.5 gap-2">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>סריקה והדפסת QR</span>
          </button>

          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'android'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>אנדרואיד</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>אייפון</span>
          </button>

          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>מחשב</span>
          </button>
        </div>

        {/* Body Guide */}
        <div className="p-6 sm:p-7 space-y-5 text-sm sm:text-base text-slate-200 overflow-y-auto flex-1">
          {isInstalled ? (
            <div className="bg-emerald-950/50 border-2 border-emerald-500/50 rounded-2xl p-5 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-black text-lg text-emerald-300">האפליקציה כבר מותקנת במכשיר זה!</h4>
              <p className="text-sm text-slate-300">ניתן לפתוח אותה ישירות ממסך הבית של הטלפון או המחשב.</p>
            </div>
          ) : (
            <>
              {/* QR Code Tab (Default) */}
              {activeTab === 'qr' && (
                <div className="space-y-4 text-center">
                  <div className="bg-white p-4 rounded-3xl inline-block shadow-xl border-2 border-slate-200">
                    <img src={qrImageUrl} alt="App Install QR" className="w-48 h-48 sm:w-52 sm:h-52 object-contain" />
                    <p className="text-xs font-black text-slate-800 mt-2">סרקו במצלמת הטלפון להתקנה</p>
                  </div>

                  <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 text-right space-y-2">
                    <div className="font-bold text-white text-base flex items-center gap-2">
                      <span>💡 שלט לתלייה בעמדות האחיות והרופאים:</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      ניתן להדפיס שלט מהודר לתלייה במחלקה. הצוות הרפואי יוכל לסרוק ולהזמין ציוד ישירות ממסך הבית.
                    </p>
                  </div>

                  {/* Print & Copy Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      onClick={handlePrintPoster}
                      className="flex-1 py-3.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm sm:text-base rounded-xl shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Printer className="w-5 h-5" />
                      <span>הדפס שלט QR לתלייה במחלקה 🖨️</span>
                    </button>

                    <button
                      onClick={handleCopyLink}
                      className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer border border-slate-700"
                    >
                      {copiedLink ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                      <span>{copiedLink ? 'הועתק!' : 'העתק קישור'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Android Tab */}
              {activeTab === 'android' && (
                <div className="space-y-4">
                  {deferredPrompt ? (
                    <div className="bg-sky-950/50 border-2 border-sky-500/50 rounded-2xl p-5 text-center space-y-3">
                      <p className="font-bold text-base text-sky-200">המכשיר שלך תומך בהתקנה מיידית בלחיצה אחת:</p>
                      <button
                        onClick={handleTriggerNativeInstall}
                        className="w-full py-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-base rounded-xl shadow-xl shadow-sky-500/30 flex items-center justify-center gap-2.5 transition-transform active:scale-95 cursor-pointer"
                      >
                        <Download className="w-5 h-5 animate-bounce" />
                        <span>התקן אפליקציה עכשיו 📲</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 font-black text-base flex items-center justify-center shrink-0">1</div>
                        <div>
                          <p className="font-bold text-white text-base">פתחו את תפריט הדפדפן (Chrome / Samsung)</p>
                          <p className="text-sm text-slate-300 mt-1">לחצו על שלוש הנקודות <strong>(⋮)</strong> בפינה העליונה של המסך.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 font-black text-base flex items-center justify-center shrink-0">2</div>
                        <div>
                          <p className="font-bold text-white text-base">בחרו "הוספה למסך הבית" או "התקן אפליקציה"</p>
                          <p className="text-sm text-slate-300 mt-1">סמל האפליקציה יתווסף ישירות למסך הבית לצד שאר האפליקציות.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* iOS Tab */}
              {activeTab === 'ios' && (
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-black text-base flex items-center justify-center shrink-0">1</div>
                    <div>
                      <p className="font-bold text-white text-base">פתחו בדפדפן Safari ולחצו "שיתוף"</p>
                      <p className="text-sm text-slate-300 mt-1">לחצו על כפתור השיתוף בתחתית המסך <strong>(⎋ עם חץ למעלה)</strong>.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-black text-base flex items-center justify-center shrink-0">2</div>
                    <div>
                      <p className="font-bold text-white text-base">גללו ובחרו "הוסף למסך הבית" ➕</p>
                      <p className="text-sm text-slate-300 mt-1">לחצו על "הוסף" בפינה השמאלית העליונה, והאפליקציה תותקן מיד!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Desktop Tab */}
              {activeTab === 'desktop' && (
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-black text-base flex items-center justify-center shrink-0">1</div>
                    <div>
                      <p className="font-bold text-white text-base">התקנה בדפדפן Chrome / Edge במחשב</p>
                      <p className="text-sm text-slate-300 mt-1">לחצו על סמל ההתקנה <strong>(⊕)</strong> בשורת הכתובת של הדפדפן מימין.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs sm:text-sm text-slate-400 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>פועל במהירות מלאה ללא תלות בחנות אפליקציות</span>
          </span>

          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
