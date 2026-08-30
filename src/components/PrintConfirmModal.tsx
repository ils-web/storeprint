import React, { useState } from 'react';
import { X, Printer, PackageMinus, Copy, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { Order, StockItem } from '../types';

interface PrintConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordersToPrint: Order[];
  stock: Record<string, StockItem>;
  onConfirmPrint: (orders: Order[], deductFromStock: boolean, isCopy: boolean) => void;
}

export const PrintConfirmModal: React.FC<PrintConfirmModalProps> = ({
  isOpen,
  onClose,
  ordersToPrint,
  stock,
  onConfirmPrint,
}) => {
  if (!isOpen || ordersToPrint.length === 0) return null;

  const isSingle = ordersToPrint.length === 1;
  const singleOrder = isSingle ? ordersToPrint[0] : null;

  // Count new vs already printed orders
  const alreadyPrintedCount = ordersToPrint.filter((o) => o.printed).length;
  const newOrdersCount = ordersToPrint.length - alreadyPrintedCount;

  // Selected mode defaults ALWAYS to 'deduct' so stock is properly deducted and no copy stamp appears
  const [selectedMode, setSelectedMode] = useState<'deduct' | 'copy' | 'smart'>('deduct');

  // Calculate total items to deduct
  const totalItemsCount = ordersToPrint.reduce((acc, o) => acc + o.items.length, 0);

  const handleConfirm = () => {
    if (selectedMode === 'copy') {
      onConfirmPrint(ordersToPrint, false, true);
    } else if (selectedMode === 'deduct') {
      onConfirmPrint(ordersToPrint, true, false);
    } else if (selectedMode === 'smart') {
      const newOrders = ordersToPrint.filter((o) => !o.printed);
      const printedOrders = ordersToPrint.filter((o) => o.printed);
      if (newOrders.length > 0) {
        onConfirmPrint(newOrders, true, false);
      }
      if (printedOrders.length > 0) {
        onConfirmPrint(printedOrders, false, true);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">
                אישור הדפסה ובקרת מלאי
              </h2>
              <p className="text-sm text-slate-300 font-medium mt-0.5">
                {isSingle
                  ? `הזמנה עבור מחלקת ${singleOrder?.department}`
                  : `הדפסה מרוכזת של ${ordersToPrint.length} הזמנות מחלקות`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-5 text-sm sm:text-base text-slate-800">
          
          {/* Status Info Banner if already printed */}
          {isSingle && singleOrder?.printed && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-3 text-amber-900 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs sm:text-sm font-bold text-amber-950">
                שים לב: הזמנה זו סומנה כהודפסה בעבר. תוכל לבחור לקזז שוב או להדפיס כהעתק.
              </div>
            </div>
          )}

          {!isSingle && alreadyPrintedCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-3 text-amber-900 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs sm:text-sm font-bold text-amber-950">
                מתוך {ordersToPrint.length} הזמנות, {alreadyPrintedCount} כבר הודפסו בעבר.
              </div>
            </div>
          )}

          {/* Mode Selection Options */}
          <div className="space-y-3">
            <label className="font-black text-slate-900 block text-sm sm:text-base">
              בחר פעולת הדפסה ומלאי:
            </label>

            {/* Option 1: Full Deduction (DEFAULT - Primary) */}
            <label
              className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                selectedMode === 'deduct'
                  ? 'border-emerald-600 bg-emerald-50/90 shadow-sm ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="printMode"
                checked={selectedMode === 'deduct'}
                onChange={() => setSelectedMode('deduct')}
                className="mt-1 w-5 h-5 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
              />
              <div className="space-y-1 flex-1">
                <div className="font-black text-slate-900 text-base flex items-center gap-2">
                  <PackageMinus className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>הדפס ובצע קיזוז מהמלאי (ניפוק רגיל — מקור)</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  המסמך יודפס נקי <strong>(ללא חותמת העתק)</strong>, והכמויות יקוזזו באופן מלא מהמחסן.
                </div>
              </div>
            </label>

            {/* Option 2: Smart Hybrid (if multi-order) */}
            {!isSingle && alreadyPrintedCount > 0 && newOrdersCount > 0 && (
              <label
                className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                  selectedMode === 'smart'
                    ? 'border-sky-600 bg-sky-50/90 shadow-sm ring-2 ring-sky-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="printMode"
                  checked={selectedMode === 'smart'}
                  onChange={() => setSelectedMode('smart')}
                  className="mt-1 w-5 h-5 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                />
                <div className="space-y-1 flex-1">
                  <div className="font-black text-slate-900 text-base flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-sky-600 shrink-0" />
                    <span>קיזוז חכם — קזז רק הזמנות חדשות ({newOrdersCount})</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    ההזמנות החדשות יקוזזו, וההזמנות שכבר הודפסו יודפסו כהעתק.
                  </div>
                </div>
              </label>
            )}

            {/* Option 3: Copy (NO Stock Deduction) */}
            <label
              className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                selectedMode === 'copy'
                  ? 'border-amber-600 bg-amber-50/90 shadow-sm ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="printMode"
                checked={selectedMode === 'copy'}
                onChange={() => setSelectedMode('copy')}
                className="mt-1 w-5 h-5 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
              />
              <div className="space-y-1 flex-1">
                <div className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Copy className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>הדפסת העתק בלבד (ללא קיזוז מהמלאי)</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  המסמך יודפס עם חותמת "העתק (ללא קיזוז מלאי)", והמלאי במחסן <strong>לא ישתנה</strong>.
                </div>
              </div>
            </label>

          </div>

          {/* Final Impact Summary Badge */}
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs sm:text-sm flex items-center justify-between font-bold">
            <div className="text-slate-700">השפעה על המחסן:</div>
            <div>
              {selectedMode === 'copy' ? (
                <span className="text-amber-800 bg-amber-100 border border-amber-200 px-3 py-1 rounded-lg">
                  ⚪ 0 פריטים יקוזזו (העתק בלבד)
                </span>
              ) : (
                <span className="text-emerald-900 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-lg">
                  📦 {totalItemsCount} פריטים יקוזזו מהמלאי
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-sm transition-colors cursor-pointer"
          >
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            className={`px-7 py-3 text-white font-black rounded-2xl text-sm sm:text-base shadow-lg flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
              selectedMode === 'copy'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            <Printer className="w-5 h-5" />
            <span>{selectedMode === 'copy' ? 'הדפס העתק (ללא קיזוז)' : 'אשר הדפסה וקזז מהמלאי ✓'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
