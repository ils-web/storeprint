import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share2, PlusSquare, CheckCircle2, X, Globe, Sparkles, Monitor } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'auto' | 'android' | 'ios' | 'desktop'>('auto');

  useEffect(() => {
    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Detect device
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setActiveTab('ios');
    } else if (/android/.test(ua)) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

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
      alert('להתקנה: פתחו את תפריט הדפדפן (3 נקודות ⋮ או שיתוף ⎋) ולחצו "הוסף למסך הבית".');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">הורדת אפליקציית הזמנות למחלקה</h3>
              <p className="text-xs text-slate-400">התקנה מהירה במסך הבית ללא צורך בחנות אפליקציות</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device Switcher Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-1.5">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'android'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>אנדרואיד (Android)</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>אייפון (iPhone / iPad)</span>
          </button>

          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>מחשב (PC / Mac)</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 space-y-4 text-sm text-slate-300">
          {deferredPrompt && (
            <div className="bg-gradient-to-r from-sky-600 to-indigo-600 p-4 rounded-2xl text-white text-center shadow-lg mb-4">
              <h4 className="font-extrabold text-base mb-1">הדפדפן שלך תומך בהתקנה ישירה בלחיצה אחת!</h4>
              <p className="text-xs text-sky-100 mb-3">לחץ על הכפתור למטה כדי להוסיף את האפליקציה למכשיר</p>
              <button
                onClick={handleTriggerNativeInstall}
                className="w-full py-2.5 bg-white hover:bg-slate-100 text-indigo-700 font-black rounded-xl text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>התקן אפליקציה עכשיו 🚀</span>
              </button>
            </div>
          )}

          {/* Android Guide */}
          {activeTab === 'android' && (
            <div className="space-y-3">
              <h4 className="font-bold text-white flex items-center gap-2">
                <span>🤖 הוראות התקנה במכשירי אנדרואיד (Chrome / Samsung):</span>
              </h4>
              <div className="space-y-2.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">1</div>
                  <p>פתחו את הדפדפן (Chrome או Samsung Internet) בקישור המערכת.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">2</div>
                  <p>לחצו על <strong>3 הנקודות (⋮)</strong> בפינה העליונה של המסך.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">3</div>
                  <p>בחרו <strong>"התקנת אפליקציה"</strong> או <strong>"הוספה למסך הבית" (Add to Home Screen)</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">4</div>
                  <p>איקון <strong>StorePrint</strong> יתווסף למסך הראשי של הטלפון וייפתח כאפליקציה מלאה ללא שורת כתובת!</p>
                </div>
              </div>
            </div>
          )}

          {/* iOS Guide */}
          {activeTab === 'ios' && (
            <div className="space-y-3">
              <h4 className="font-bold text-white flex items-center gap-2">
                <span>🍏 הוראות התקנה באייפון / אייפד (Safari):</span>
              </h4>
              <div className="space-y-2.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">1</div>
                  <p>פתחו את האתר בדפדפן <strong>Safari</strong> של אפל.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">2</div>
                  <p>לחצו על כפתור ה-<strong>שיתוף (⎋ Share)</strong> בתחתית המסך (ריבוע עם חץ עולה).</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">3</div>
                  <p>גללו מעט למטה ולחצו על <strong>"הוסף למסך הבית" (Add to Home Screen) ➕</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">4</div>
                  <p>לחצו <strong>"הוסף" (Add)</strong> בפינה העליונה. האפליקציה תופיע במסך הבית של האייפון!</p>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Guide */}
          {activeTab === 'desktop' && (
            <div className="space-y-3">
              <h4 className="font-bold text-white flex items-center gap-2">
                <span>💻 התקנה במחשב (Windows / Mac / Chrome):</span>
              </h4>
              <div className="space-y-2.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0">1</div>
                  <p>בדפדפן Chrome או Edge, חפשו את סמל ההתקנה <strong>(⊕ או מחשב קטן עם חץ)</strong> בצד שורת הכתובת למעלה.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0">2</div>
                  <p>לחצו על <strong>"התקן" (Install)</strong> לאפליקציה שולחנית עצמאית ומהירה.</p>
                </div>
              </div>
            </div>
          )}

          {/* Advantages */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 text-xs text-emerald-300 flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong>יתרונות האפליקציה המותקנת:</strong> עובדת במסך מלא, טעינה מיידית, תמיכה בעבודה גם בחיבור איטי, ושמירת שם המחלקה שלכם לפעם הבאה!
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            הבנתי, תודה!
          </button>
        </div>
      </div>
    </div>
  );
}
