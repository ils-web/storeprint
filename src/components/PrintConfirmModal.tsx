import React, { useState, useEffect } from 'react';
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
  const allAlreadyPrinted = alreadyPrintedCount === ordersToPrint.length;

  // Selected mode:
  // 'deduct' -> Print and deduct from stock
  // 'copy'   -> Print as copy (NO deduction from stock)
  // 'smart'  -> Deduct only new orders, print already printed as copy (for mass print)
  const [selectedMode, setSelectedMode] = useState<'deduct' | 'copy' | 'smart'>('deduct');

  useEffect(() => {
    if (allAlreadyPrinted) {
      setSelectedMode('copy'); // Default to COPY if already printed
    } else if (alreadyPrintedCount > 0) {
      setSelectedMode('smart'); // Default to smart hybrid if mixed
    } else {
      setSelectedMode('deduct'); // Default to deduct if all new
    }
  }, [allAlreadyPrinted, alreadyPrintedCount, isOpen]);

  // Calculate total items to deduct based on mode
  const totalItemsCount = ordersToPrint.reduce((acc, o) => acc + o.items.length, 0);

  const handleConfirm = () => {
    if (selectedMode === 'copy') {
      onConfirmPrint(ordersToPrint, false, true);
    } else if (selectedMode === 'deduct') {
      onConfirmPrint(ordersToPrint, true, false);
    } else if (selectedMode === 'smart') {
      // Split into new (deduct) and already printed (copy)
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
            <div className={`p-3 rounded-2xl border shrink-0 ${allAlreadyPrinted ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-sky-500/20 text-sky-400 border-sky-500/30'}`}>
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
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
          
          {/* Status Alert Banner */}
          {isSingle && singleOrder?.printed && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-black text-base text-amber-950">
                  הזמנה זו כבר הודפסה בעבר!
                </div>
                <div className="text-sm text-amber-900 leading-normal">
                  האם להדפיס עותק נוסף ללא קיזוז מהמלאי, או לקזז מהמחסן פעם נוספת?
                </div>
              </div>
            </div>
          )}

          {!isSingle && alreadyPrintedCount > 0 && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-black text-base text-amber-950">
                  שים לב: מתוך {ordersToPrint.length} הזמנות שנבחרו, {alreadyPrintedCount} כבר הודפסו בעבר.
                </div>
                <div className="text-sm text-amber-900 leading-normal">
                  {newOrdersCount} הזמנות חדשות יקוזזו, ו-{alreadyPrintedCount} הזמנות שהודפסו יודפסו כהעתק.
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection Options */}
          <div className="space-y-3">
            <label className="font-black text-slate-900 block text-base">
              בחר פעולת הדפסה וקיזוז מלאי:
            </label>

            {/* Option 1: Copy (NO Stock Deduction) */}
            <label
              className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                selectedMode === 'copy'
                  ? 'border-sky-600 bg-sky-50/90 shadow-sm ring-2 ring-sky-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="printMode"
                checked={selectedMode === 'copy'}
                onChange={() => setSelectedMode('copy')}
                className="mt-1 w-5 h-5 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
              />
              <div className="space-y-1 flex-1">
                <div className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Copy className="w-5 h-5 text-sky-600 shrink-0" />
                  <span>הדפסת העתק — ללא קיזוז מהמלאי</span>
                </div>
                <div className="text-sm text-slate-600 leading-relaxed">
                  המסמך יודפס (עם חותמת "העתק"), ו<strong>יתרות המלאי במחסן לא ישתנו כלל</strong>.
                </div>
              </div>
            </label>

            {/* Option 2: Smart Hybrid */}
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
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>קיזוז חכם — קזז רק הזמנות חדשות ({newOrdersCount})</span>
                  </div>
                  <div className="text-sm text-slate-600 leading-relaxed">
                    ההזמנות החדשות יקוזזו, וההזמנות שהודפסו יודפסו כהעתק ללא קיזוז כפול.
                  </div>
                </div>
              </label>
            )}

            {/* Option 3: Full Deduction */}
            <label
              className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                selectedMode === 'deduct'
                  ? 'border-sky-600 bg-sky-50/90 shadow-sm ring-2 ring-sky-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="printMode"
                checked={selectedMode === 'deduct'}
                onChange={() => setSelectedMode('deduct')}
                className="mt-1 w-5 h-5 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
              />
              <div className="space-y-1 flex-1">
                <div className="font-black text-slate-900 text-base flex items-center gap-2">
                  <PackageMinus className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    {isSingle && singleOrder?.printed
                      ? 'הדפס ובצע קיזוז נוסף מהמלאי (ניפוק חוזר)'
                      : 'הדפס ובצע קיזוז מהמלאי (ניפוק רגיל)'}
                  </span>
                </div>
                <div className="text-sm text-slate-600 leading-relaxed">
                  הכמויות שבהזמנה יקוזזו באופן מלא מהיתרות בטבלת המחסן.
                </div>
              </div>
            </label>

          </div>

          {/* Final Impact Summary Badge */}
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-sm flex items-center justify-between font-bold">
            <div className="text-slate-700">השפעה על המחסן:</div>
            <div>
              {selectedMode === 'copy' ? (
                <span className="text-sky-800 bg-sky-100 border border-sky-200 px-3 py-1 rounded-lg">
                  ⚪ 0 פריטים יקוזזו (העתק בלבד)
                </span>
              ) : (
                <span className="text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1 rounded-lg">
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
            className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl text-sm transition-colors cursor-pointer"
          >
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            className={`px-8 py-3 text-white font-black rounded-2xl text-base shadow-lg flex items-center gap-2.5 transition-all transform active:scale-95 cursor-pointer ${
              selectedMode === 'copy'
                ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            <Printer className="w-5 h-5" />
            <span>{selectedMode === 'copy' ? 'הדפס העתק (ללא קיזוז)' : 'אשר והדפס עכשיו'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
