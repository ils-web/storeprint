import React, { useState, useEffect } from 'react';
import { X, Printer, PackageMinus, Copy, AlertTriangle, CheckCircle, Package, ArrowLeft } from 'lucide-react';
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
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-reverse space-x-3">
            <div className={`p-2.5 rounded-xl border ${allAlreadyPrinted ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-sky-500/20 text-sky-400 border-sky-500/30'}`}>
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                אישור הדפסה ובקרת מלאי
              </h2>
              <p className="text-xs text-slate-400">
                {isSingle
                  ? `הזמנה עבור מחלקת ${singleOrder?.department}`
                  : `הדפסה מרוכזת של ${ordersToPrint.length} הזמנות`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          
          {/* Status Alert Banner */}
          {isSingle && singleOrder?.printed && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-extrabold text-xs text-amber-950">
                  הזמנה זו כבר הודפסה בעבר!
                </div>
                <div className="text-[11px] text-amber-800">
                  האם להדפיס עותק נוסף ללא קיזוז מהמלאי, או לקזז מהמחסן פעם נוספת?
                </div>
              </div>
            </div>
          )}

          {!isSingle && alreadyPrintedCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-extrabold text-xs text-amber-950">
                  שים לב: מתוך {ordersToPrint.length} הזמנות שנבחרו, {alreadyPrintedCount} כבר הודפסו בעבר.
                </div>
                <div className="text-[11px] text-amber-800">
                  {newOrdersCount} הזמנות חדשות, {alreadyPrintedCount} כבר הודפסו בעבר.
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection Options */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-900 block text-xs">
              בחר פעולת הדפסה ומלאי:
            </label>

            {/* Option 1: Copy (NO Stock Deduction) */}
            <label
              className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                selectedMode === 'copy'
                  ? 'border-sky-600 bg-sky-50/70 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="printMode"
                checked={selectedMode === 'copy'}
                onChange={() => setSelectedMode('copy')}
                className="mt-1 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <div className="space-y-0.5 flex-1">
                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Copy className="w-4 h-4 text-sky-600" />
                  <span>הדפסת העתק — ללא קיזוז מהמלאי (מומלץ אם כבר נופק)</span>
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  המסמך יודפס (עם סימון "העתק"), ו<strong>יתרות המלאי במחסן לא ישתנו כלל</strong>.
                </div>
              </div>
            </label>

            {/* Option 2: Smart Hybrid (only for mass print with mixed status) */}
            {!isSingle && alreadyPrintedCount > 0 && newOrdersCount > 0 && (
              <label
                className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                  selectedMode === 'smart'
                    ? 'border-sky-600 bg-sky-50/70 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="printMode"
                  checked={selectedMode === 'smart'}
                  onChange={() => setSelectedMode('smart')}
                  className="mt-1 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <div className="space-y-0.5 flex-1">
                  <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>קיזוז חכם — קזז רק הזמנות חדשות ({newOrdersCount})</span>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    ההזמנות החדשות יקוזזו מהמלאי, ואילו {alreadyPrintedCount} שכבר הודפסו יודפסו כהעתק ללא קיזוז כפול.
                  </div>
                </div>
              </label>
            )}

            {/* Option 3: Full Deduction */}
            <label
              className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                selectedMode === 'deduct'
                  ? 'border-sky-600 bg-sky-50/70 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="printMode"
                checked={selectedMode === 'deduct'}
                onChange={() => setSelectedMode('deduct')}
                className="mt-1 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <div className="space-y-0.5 flex-1">
                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <PackageMinus className="w-4 h-4 text-amber-600" />
                  <span>
                    {isSingle && singleOrder?.printed
                      ? 'הדפס ובצע קיזוז נוסף מהמלאי (ניפוק חוזר)'
                      : 'הדפס ובצע קיזוז מהמלאי (ניפוק רגיל)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  הכמויות שבהזמנה יקוזזו באופן מלא מהיתרות בטבלת המחסן.
                </div>
              </div>
            </label>

          </div>

          {/* Final Impact Summary Badge */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] flex items-center justify-between">
            <div className="text-slate-600 font-medium">השפעה על המחסן:</div>
            <div className="font-black">
              {selectedMode === 'copy' ? (
                <span className="text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-md">
                  ⚪ 0 פריטים יקוזזו (העתק בלבד)
                </span>
              ) : (
                <span className="text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md">
                  📦 {totalItemsCount} פריטים יקוזזו מהמלאי
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
          >
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            className={`px-7 py-2.5 text-white font-black rounded-2xl text-xs shadow-md flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
              selectedMode === 'copy'
                ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>{selectedMode === 'copy' ? 'הדפס העתק (ללא קיזוז)' : 'אשר והדפס'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
