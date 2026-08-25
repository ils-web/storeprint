import React from 'react';
import { StockItem } from '../types';
import {
  AlertTriangle,
  X,
  Printer,
  Copy,
  Check,
  Package,
  TrendingDown,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { printReorderListHtml } from '../utils/pdfGenerator';

interface ShortageDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: Record<string, StockItem>;
  isEmergencyMode?: boolean;
  globalThreshold?: number;
  tenantName?: string;
}

export const ShortageDrawerModal: React.FC<ShortageDrawerModalProps> = ({
  isOpen,
  onClose,
  stock,
  isEmergencyMode = false,
  globalThreshold = 10,
  tenantName,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const stockList = Object.values(stock);

  // Filter items below threshold (excluding inactive items)
  const lowStockItems = stockList
    .filter((item) => {
      if (item.isActive === false) return false;
      const baseTh = item.minThreshold || globalThreshold;
      const effectiveTh = isEmergencyMode ? baseTh * 3 : baseTh;
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      return safeQty < effectiveTh;
    })
    .map((item) => {
      const baseTh = item.minThreshold || globalThreshold;
      const effectiveTh = isEmergencyMode ? baseTh * 3 : baseTh;
      const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
      const deficit = Math.max(0, effectiveTh - safeQty);
      return {
        ...item,
        effectiveTh,
        safeQty,
        deficit,
      };
    })
    .sort((a, b) => b.deficit - a.deficit);

  // Handle Print Reorder Sheet
  const handlePrint = () => {
    printReorderListHtml(stockList, globalThreshold, isEmergencyMode ? 3 : 1, tenantName);
  };

  // Copy WhatsApp format list
  const handleCopyWhatsApp = () => {
    let text = `🚨 *דוח חוסרי מלאי ורכש - ${tenantName || 'מחסן מרכזי'}*\n`;
    text += `📅 תאריך: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}\n`;
    if (isEmergencyMode) text += `⚠️ *נוהל שעת חירום (מלאי משולש X3)*\n`;
    text += `סה"כ פריטים בחוסר: ${lowStockItems.length}\n\n`;

    lowStockItems.forEach((item, idx) => {
      const unit = item.unit || "יח'";
      text += `${idx + 1}. *${item.name}*\n   יתרה: ${item.safeQty} ${unit} | סף נדרש: ${item.effectiveTh} | *להזמנה: ${item.deficit} ${unit}*\n`;
    });

    text += `\n_הופק אוטומטית ממערכת StorePrint_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden text-slate-900 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-reverse space-x-3">
            <div className="p-2.5 bg-white/20 text-white rounded-2xl backdrop-blur-xs animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  חלונית חוסרים ובקרת מלאי מינימום 🚨
                </h2>
                <span className="bg-white text-red-700 text-xs px-2 py-0.5 rounded-full font-black">
                  {lowStockItems.length} פריטים
                </span>
              </div>
              <p className="text-xs text-red-100 mt-0.5">
                פריטים שהיתרה שלהם ירדה מתחת לסף המינימום ודורשים רכש/מילוי
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-600 font-bold">
            {lowStockItems.length === 0 ? 'כל הפריטים במחסן תקינים!' : `רשימת ${lowStockItems.length} פריטים להזמנה:`}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              disabled={lowStockItems.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'הועתק ללוח!' : 'העתק ל-WhatsApp'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={lowStockItems.length === 0}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>הדפס דוח רכש 🖨️</span>
            </button>
          </div>
        </div>

        {/* Content Body: Deficit Items List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 divide-y divide-slate-100">
          {lowStockItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Package className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-black text-slate-800 text-base">אין חוסרים במלאי! 🎉</h4>
              <p className="text-xs text-slate-500">כל הפריטים הפעילים במחסן עומדים בסף המינימום הנדרש.</p>
            </div>
          ) : (
            lowStockItems.map((item, idx) => {
              const unit = item.unit || "יח'";
              const isZero = item.safeQty === 0;

              return (
                <div
                  key={item.id || item.name || idx}
                  className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-2xl transition-all ${
                    isZero ? 'bg-red-50/70 border border-red-200' : 'bg-amber-50/50 border border-amber-200/80'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-400 mt-0.5">#{idx + 1}</span>
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                        <span>{item.name}</span>
                        {isZero && (
                          <span className="px-1.5 py-0.2 text-[10px] font-black bg-red-600 text-white rounded">
                            אזל לחלוטין (0)
                          </span>
                        )}
                        {item.limitByPatients && (
                          <span className="px-1.5 py-0.2 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded">
                            👥 מוגבל
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1">
                        <span>
                          יתרה במחסן: <strong className={isZero ? 'text-red-600' : 'text-amber-700'}>{item.safeQty} {unit}</strong>
                        </span>
                        <span>•</span>
                        <span>סף מינימום: <strong>{item.effectiveTh} {unit}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0 bg-white p-2 px-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="block text-[10px] font-bold text-slate-400">כמות להזמנה</span>
                    <span className="font-mono font-black text-sm text-red-600">
                      +{item.deficit} {unit}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            * נתונים מסונכרנים ישירות מול טבלת ה-Google Sheets
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
          >
            סגור
          </button>
        </div>

      </div>
    </div>
  );
};
