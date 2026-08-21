import React from 'react';
import { Siren, AlertTriangle, Printer, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';

interface EmergencyBannerProps {
  isEmergencyMode: boolean;
  emergencyDeficitCount: number;
  onOpenEmergencyPrint: () => void;
  onRequestDeactivate: () => void;
}

export function EmergencyBanner({
  isEmergencyMode,
  emergencyDeficitCount,
  onOpenEmergencyPrint,
  onRequestDeactivate,
}: EmergencyBannerProps) {
  if (!isEmergencyMode) return null;

  return (
    <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-2.5 shadow-xl border-b-2 border-red-800 animate-in slide-in-from-top duration-300 relative z-30" dir="rtl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Emergency Status & Explanation */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl animate-pulse flex items-center justify-center">
            <Siren className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wide">
                🚨 מצב חירום פעיל במרכז הרפואי (מלאי ביטחון X3 מוגבר)
              </span>
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/30 uppercase">
                כמות משולשת
              </span>
            </div>
            <p className="text-xs text-red-100 mt-0.5">
              כל ספי המינימום חושבו במכפיל פי 3. כרגע <strong>{emergencyDeficitCount} פריטים</strong> דורשים הצטיידות חירום מיידית.
            </p>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEmergencyPrint}
            className="bg-white hover:bg-red-50 text-red-700 text-xs font-black px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>הדפס דוח רכש חירום (X3)</span>
          </button>

          <button
            onClick={onRequestDeactivate}
            className="bg-red-950/70 hover:bg-red-950 text-red-100 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-400/40 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>חזרה לשגרה 🟢</span>
          </button>
        </div>
      </div>
    </div>
  );
}
