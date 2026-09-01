import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, PlusSquare, Share2 } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);

  useEffect(() => {
    // Check if already in standalone / PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return; // Already installed
    }

    // Check if mobile (Android, iOS, etc.)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphoneOrIpad = /iphone|ipad|ipod/.test(userAgent);
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    setIsIOS(isIphoneOrIpad);

    // Chrome / Android PWA Install Event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If on mobile browser and not installed, show banner after 2 seconds
    if (isMobile && !isStandalone) {
      const dismissed = localStorage.getItem('storeprint_pwa_banner_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowBanner(true), 2000);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [showAndroidGuide, setShowAndroidGuide] = useState<boolean>(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowAndroidGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('storeprint_pwa_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  const isOrderApp = typeof window !== 'undefined' && window.location.pathname.includes('order');

  return (
    <>
      {/* Floating Bottom / Top Install Banner */}
      <div className="fixed bottom-3 sm:bottom-5 right-3 left-3 sm:right-auto sm:left-6 z-40 max-w-md bg-slate-900 text-white p-3.5 sm:p-4 rounded-3xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 animate-fadeIn" dir="rtl">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 bg-gradient-to-tr ${isOrderApp ? 'from-emerald-500 to-teal-600' : 'from-sky-500 to-blue-600'} text-white rounded-2xl shadow-md shrink-0`}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-white">
              {isOrderApp ? 'התקנת אפליקציית הזמנות מחלקה' : 'התקנת StorePrint בטלפון'}
            </h4>
            <p className="text-[11px] text-slate-400">
              לפתיחה מהירה כאיקון אפליקציה ייעודי במסך הבית
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>התקן</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-2xs z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-sky-600" />
                <span>התקנה ב-iPhone / iPad</span>
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-mono font-black text-sky-600 bg-sky-100 rounded-lg w-6 h-6 flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  לחץ על כפתור <strong>השיתוף (Share)</strong> בתחתית מסך הדפדפן Safari של אפל.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-mono font-black text-sky-600 bg-sky-100 rounded-lg w-6 h-6 flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  גלול מעט ובחר באפשרות <strong>"הוסף למסך הבית" (Add to Home Screen ➕)</strong>.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-mono font-black text-sky-600 bg-sky-100 rounded-lg w-6 h-6 flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  לחץ <strong>"הוסף" (Add)</strong> בצד ימין למעלה — והאפליקציה תופיע במסך הבית שלך!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-2.5 rounded-2xl text-xs transition-colors cursor-pointer"
            >
              הבנתי, תודה!
            </button>
          </div>
        </div>
      )}

      {/* Android / Chrome Guide Modal */}
      {showAndroidGuide && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-2xs z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>התקנה ב-Android / Chrome</span>
              </h3>
              <button
                onClick={() => setShowAndroidGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-mono font-black text-emerald-600 bg-emerald-100 rounded-lg w-6 h-6 flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  לחץ על תפריט <strong>3 הנקודות (⋮)</strong> בפינה העליונה של דפדפן Chrome.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-mono font-black text-emerald-600 bg-emerald-100 rounded-lg w-6 h-6 flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  בחר באפשרות <strong>"התקנת אפליקציה" (Install App)</strong> או <strong>"הוסף למסך הבית"</strong>.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-mono font-black text-emerald-600 bg-emerald-100 rounded-lg w-6 h-6 flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  אשר את ההתקנה — והאיקון של StorePrint יופיע במסך הבית של הטלפון שלך!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAndroidGuide(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-2xl text-xs transition-colors cursor-pointer"
            >
              הבנתי, תודה!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
