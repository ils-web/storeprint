import React from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, X, CheckCircle2, Siren, ArrowRight } from 'lucide-react';

interface EmergencyConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCurrentlyEmergency: boolean;
  onConfirm: (targetEmergencyState: boolean) => void;
}

export function EmergencyConfirmModal({
  isOpen,
  onClose,
  isCurrentlyEmergency,
  onConfirm,
}: EmergencyConfirmModalProps) {
  if (!isOpen) return null;

  const isActivating = !isCurrentlyEmergency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Modal Header */}
        <div
          className={`p-5 border-b flex items-center justify-between ${
            isActivating
              ? 'bg-gradient-to-r from-red-950/90 to-slate-950 border-red-800/80 text-white'
              : 'bg-gradient-to-r from-emerald-950/90 to-slate-950 border-emerald-800/80 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                isActivating
                  ? 'bg-red-600 shadow-red-600/30 animate-pulse'
                  : 'bg-emerald-600 shadow-emerald-600/30'
              }`}
            >
              {isActivating ? <Siren className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-extrabold text-lg">
                {isActivating ? 'הפעלת מצב חירום רפואי (מלאי משולש X3)' : 'חזרה לשגרת פעילות מלאה'}
              </h3>
              <p className="text-xs text-slate-300">
                {isActivating ? 'מעבר למוכנות שיא והגדלת מלאי ביטחון' : 'איפוס ספי מינימום לרמת שגרה'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 text-sm text-slate-200">
          {isActivating ? (
            <>
              <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-4 text-xs text-red-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>התראת שעת חירום במרכז הרפואי</span>
                </div>
                <p>
                  מעבר למצב חירום יבצע באופן מיידי:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pr-1">
                  <li><strong>שילוש כל ספי המינימום (פי 3)</strong> עבור כל פריטי הציוד והתרופות במחסן.</li>
                  <li><strong>הפקת גיליון דרישות רכש והצטיידות לשעת חירום (X3)</strong> לחתימת ההנהלה.</li>
                  <li><strong>התאמת כל ממשק המשתמש (במחשב ובנייד)</strong> עם באנרים והתראות חוסרי חירום.</li>
                </ul>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  * ניתן לחזור לשגרה בכל עת בלחיצת כפתור אחת, וכל ספי המינימום יוחזרו מיד לרמתם המקורית.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-xs text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>אישור חזרה לשגרת פעילות</span>
                </div>
                <p>
                  סיום מצב חירום יבצע:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pr-1">
                  <li><strong>החזרת כל ספי המינימום לרמת השגרה המקורית (1X)</strong>.</li>
                  <li>הסרת באנרי החירום והחזרת הממשק לצבעי שגרה רגילים.</li>
                  <li>עדכון דוחות המלאי והחוסרים לרמת שגרה.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            ביטול
          </button>

          <button
            onClick={() => {
              onConfirm(isActivating);
              onClose();
            }}
            className={`px-6 py-2.5 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95 cursor-pointer ${
              isActivating
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/30'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
            }`}
          >
            {isActivating ? (
              <>
                <Siren className="w-4 h-4 animate-bounce" />
                <span>אישור והפעלת מצב חירום (X3) 🚨</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>אישור חזרה לשגרה 🟢</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
