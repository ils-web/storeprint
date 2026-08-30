import React, { useState } from 'react';
import { X, Smartphone, Copy, Check, QrCode, ExternalLink, Sparkles, Cloud } from 'lucide-react';
import { CloudSyncConfig } from '../types';

interface PhoneQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudConfig: CloudSyncConfig;
  onOpenCloudConfig: () => void;
}

export const PhoneQRModal: React.FC<PhoneQRModalProps> = ({
  isOpen,
  onClose,
  cloudConfig,
  onOpenCloudConfig,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://storeprintgc.netlify.app';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
  const hasEndpoint = Boolean(cloudConfig.endpointUrl && cloudConfig.endpointUrl.trim());
  const shareUrl = hasEndpoint
    ? `${currentOrigin}${currentPath}/?view=mobile_stock&cloudUrl=${encodeURIComponent(cloudConfig.endpointUrl.trim())}`
    : `${currentOrigin}${currentPath}/?view=mobile_stock`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    shareUrl
  )}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-reverse space-x-3">
            <div className="p-2.5 bg-white/20 text-white rounded-2xl backdrop-blur-xs">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                חיבור הטלפון הנייד למחסן
              </h2>
              <p className="text-xs text-sky-100">
                סריקה אחת במצלמה — והכל מסונכרן מיד!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-center">
          
          {hasEndpoint ? (
            <>
              {/* QR Code Frame */}
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-3 bg-white rounded-3xl border-2 border-sky-300 shadow-lg inline-block">
                  <img
                    src={qrImageUrl}
                    alt="קוד QR לחיבור הטלפון"
                    className="w-52 h-52 sm:w-56 sm:h-56 rounded-2xl"
                  />
                </div>
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-sky-600" />
                  <span>פתחו את מצלמת הטלפון וכוונו למסך</span>
                </div>
              </div>

              {/* Instructions Steps */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-right space-y-2 text-xs text-slate-700">
                <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>איך זה עובד:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <li>פתחו את המצלמה בסמארטפון (אייפון או אנדרואיד).</li>
                  <li>סרקו את קוד ה-QR המופיע על המסך.</li>
                  <li>לחצו על הקישור שיקפוץ — <strong>וכל יתרות המלאי של המחסן יופיעו במלואן בטלפון!</strong></li>
                </ol>
              </div>

              {/* Copy Share Link Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-2xl border border-slate-300 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">הקישור המהיר הועתק ללוח!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-sky-600" />
                      <span>העתק קישור ישיר לטלפון (לשליחה בוואטסאפ)</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-2">
                <div className="font-black text-sm">טרם הוגדר קישור ענן במערכת</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  כדי שגם המחשב וגם הטלפון יראו את אותן יתרות מלאי, יש להזין תחילה את כתובת ה-Web App של הסקריפט.
                </p>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onOpenCloudConfig();
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white font-black px-6 py-2.5 rounded-2xl text-xs shadow-md transition-all cursor-pointer"
              >
                פתח הגדרות חיבור לענן
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            סגור
          </button>
        </div>

      </div>
    </div>
  );
};
