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
      alert('להתקנה מהירה: פתחו את תפריט הדפדפן (3 נקודות ⋮ באנדרואיד או כפתור שיתוף ⎋ באייפון) ולחצו "הוסף למסך הבית".');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 shrink-0">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-xl sm:text-2xl text-white">הורדת אפליקציית הזמנות למחלקה</h3>
              <p className="text-sm text-slate-300 font-medium mt-0.5">התקנה ישירה במסך הבית ללא צורך בהורדה מחנות אפליקציות</p>
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
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'android'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>אנדרואיד (Android)</span>
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
            <span>אייפון (iPhone / iPad)</span>
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
            <span>מחשב (Desktop)</span>
          </button>
        </div>

        {/* Body Guide */}
        <div className="p-6 sm:p-7 space-y-5 text-sm sm:text-base text-slate-200">
          {isInstalled ? (
            <div className="bg-emerald-950/50 border-2 border-emerald-500/50 rounded-2xl p-5 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-black text-lg text-emerald-300">האפליקציה כבר מותקנת במכשיר זה!</h4>
              <p className="text-sm text-slate-300">ניתן לפתוח אותה ישירות ממסך הבית של הטלפון או המחשב.</p>
            </div>
          ) : (
            <>
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
            <span>פועל במהירות מלאה ללא תלות ברשת חיצונית</span>
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
