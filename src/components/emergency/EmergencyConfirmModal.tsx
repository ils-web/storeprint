import React from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, X, CheckCircle2, Siren } from 'lucide-react';

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
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Modal Header */}
        <div
          className={`p-6 border-b flex items-center justify-between ${
            isActivating
              ? 'bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 border-red-800/80 text-white'
              : 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border-emerald-800/80 text-white'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0 ${
                isActivating
                  ? 'bg-red-600 shadow-red-600/40 animate-pulse ring-2 ring-red-400'
                  : 'bg-emerald-600 shadow-emerald-600/40'
              }`}
            >
              {isActivating ? <Siren className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>
            <div>
              <h3 className="font-black text-xl sm:text-2xl tracking-tight text-white">
                {isActivating ? 'הפעלת מצב חירום רפואי (מלאי משולש X3)' : 'חזרה לשגרת פעילות מלאה'}
              </h3>
              <p className="text-sm sm:text-base text-slate-300 font-medium mt-0.5">
                {isActivating ? 'מעבר למוכנות שיא והגדלת מלאי ביטחון פי 3' : 'איפוס ספי מינימום לרמת שגרה'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-7 space-y-5 text-slate-200">
          {isActivating ? (
            <>
              <div className="bg-red-950/50 border-2 border-red-500/50 rounded-2xl p-5 text-red-100 space-y-3 shadow-inner">
                <div className="flex items-center gap-2.5 font-black text-red-300 text-base sm:text-lg">
                  <AlertTriangle className="w-6 h-6 shrink-0 text-red-400" />
                  <span>התראת נוהל שעת חירום / חל"ק</span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-slate-200 leading-relaxed">
                  מעבר למצב חירום יבצע באופן מיידי:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-slate-200 pr-1 leading-normal">
                  <li>
                    <strong className="text-white">שילוש כל ספי המינימום (פי 3)</strong> עבור כל פריטי הציוד והתרופות במחסן.
                  </li>
                  <li>
                    <strong className="text-white">הפקת גיליון דרישות רכש והצטיידות (X3)</strong> לחתימת ההנהלה וקצין הלוגיסטיקה.
                  </li>
                  <li>
                    <strong className="text-white">התאמת ממשק המשתמש במחשב ובנייד</strong> עם באנרים והתראות חוסרי חירום.
                  </li>
                </ul>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-sm text-slate-300 flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
                <p className="font-medium text-slate-200">
                  * ניתן לחזור לשגרה בכל עת בלחיצת כפתור אחת, וכל ספי המינימום יוחזרו מיד לרמתם המקורית.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-emerald-950/50 border-2 border-emerald-500/50 rounded-2xl p-5 text-emerald-100 space-y-3 shadow-inner">
                <div className="flex items-center gap-2.5 font-black text-emerald-300 text-base sm:text-lg">
                  <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-400" />
                  <span>אישור חזרה לשגרת פעילות</span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-slate-200 leading-relaxed">
                  סיום מצב חירום יבצע:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-slate-200 pr-1 leading-normal">
                  <li>
                    <strong className="text-white">החזרת כל ספי המינימום לרמת השגרה המקורית (1X)</strong>.
                  </li>
                  <li>הסרת באנרי החירום והחזרת הממשק לצבעי שגרה רגילים.</li>
                  <li>עדכון דוחות המלאי והחוסרים לרמת שגרה.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-xl transition-colors cursor-pointer"
          >
            ביטול
          </button>

          <button
            onClick={() => {
              onConfirm(isActivating);
              onClose();
            }}
            className={`px-7 py-3 text-white text-sm sm:text-base font-black rounded-xl shadow-xl flex items-center gap-2.5 transition-transform active:scale-95 cursor-pointer ${
              isActivating
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/40 ring-2 ring-red-400'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/40 ring-2 ring-emerald-400'
            }`}
          >
            {isActivating ? (
              <>
                <Siren className="w-5 h-5 animate-bounce" />
                <span>אישור והפעלת מצב חירום (X3) 🚨</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>אישור חזרה לשגרה 🟢</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
