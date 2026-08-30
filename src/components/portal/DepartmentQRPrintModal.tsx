import React, { useState } from 'react';
import { QrCode, Printer, Building2, X, Download, Smartphone, CheckCircle2, Copy } from 'lucide-react';

interface DepartmentQRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: string[];
  tenantId?: string;
  tenantName?: string;
}

export function DepartmentQRPrintModal({
  isOpen,
  onClose,
  departments,
  tenantId,
  tenantName = 'מרכז רפואי (סניף ראשי)',
}: DepartmentQRPrintModalProps) {
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [copiedDept, setCopiedDept] = useState<string | null>(null);

  if (!isOpen) return null;

  // Base URL for mobile staff order portal
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';

  const getPortalUrlForDept = (dept: string) => {
    const tenantQuery = tenantId ? `&tenant=${encodeURIComponent(tenantId)}` : '';
    return `${origin}${pathname}/?view=portal_pwa${tenantQuery}&dept=${encodeURIComponent(dept)}`;
  };

  const getQrImageUrl = (dept: string) => {
    const targetUrl = getPortalUrlForDept(dept);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(targetUrl)}`;
  };

  const deptsToDisplay = selectedDept === 'all' ? departments : departments.filter((d) => d === selectedDept);

  const handlePrint = (singleDept?: string) => {
    const printDepts = singleDept ? [singleDept] : deptsToDisplay;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('נא לאפשר חלונות קופצים (Pop-ups) בדפדפן כדי להדפיס.');
      return;
    }

    const cardsHtml = printDepts
      .map((dept) => {
        const qrUrl = getQrImageUrl(dept);
        const directUrl = getPortalUrlForDept(dept);

        return `
        <div class="qr-card">
          <div class="header">
            <div class="logo">StorePrint 📦</div>
            <div class="title">טופס הזמנת אספקה וציוד רפואי</div>
            <div class="sub-tenant">${tenantName}</div>
          </div>

          <div class="dept-badge">
            <div class="dept-label">מחלקה / אגף:</div>
            <div class="dept-name">${dept}</div>
          </div>

          <div class="qr-frame">
            <img src="${qrUrl}" alt="QR Code for ${dept}" class="qr-img" />
            <div class="qr-subtext">סרקו במצלמת הטלפון להזמנה ישירה</div>
          </div>

          <div class="instructions-box">
            <div class="instructions-title">📋 כיצד להזמין ציוד למחלקה:</div>
            <ol class="instructions-list">
              <li><strong>סרקו את קוד ה-QR</strong> באמצעות מצלמת הסמארטפון.</li>
              <li><strong>בחרו את הפריטים והאריזות</strong> הנדרשות (יח', חבילה, קופסה, קרטון).</li>
              <li><strong>לחצו על "שלח הזמנה למחסן"</strong> — ההזמנה תעבור ישירות לליקוט!</li>
            </ol>
          </div>

          <div class="footer">
            <div>🚀 ללא צורך בניירת • מעקב סטטוס בזמן אמת במערכת המחסן</div>
            <div class="url-hint">${directUrl}</div>
          </div>
        </div>
      `;
      })
      .join('<div class="page-break"></div>');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <title>כרטיסיות QR למחלקות - StorePrint</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Assistant', Arial, sans-serif; }
          body { background: #fff; color: #0f172a; padding: 20px; }
          
          .qr-card {
            max-width: 550px;
            margin: 0 auto 30px auto;
            border: 3px solid #0284c7;
            border-radius: 24px;
            padding: 24px;
            text-align: center;
            background: #ffffff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            page-break-inside: avoid;
          }

          .header { margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
          .logo { font-size: 16pt; font-weight: 800; color: #0284c7; }
          .title { font-size: 14pt; font-weight: 800; color: #0f172a; margin-top: 4px; }
          .sub-tenant { font-size: 11pt; color: #64748b; font-weight: 600; }

          .dept-badge {
            background: #f0f9ff;
            border: 2px dashed #0284c7;
            border-radius: 16px;
            padding: 12px;
            margin: 14px 0;
          }
          .dept-label { font-size: 11pt; color: #0369a1; font-weight: 700; }
          .dept-name { font-size: 20pt; font-weight: 800; color: #0c4a6e; }

          .qr-frame {
            background: #f8fafc;
            border: 2px solid #cbd5e1;
            border-radius: 20px;
            padding: 16px;
            display: inline-block;
            margin: 10px 0;
          }
          .qr-img { width: 220px; height: 220px; display: block; margin: 0 auto; }
          .qr-subtext { font-size: 11pt; font-weight: 700; color: #334155; margin-top: 8px; }

          .instructions-box {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 16px;
            padding: 14px;
            text-align: right;
            margin-top: 16px;
          }
          .instructions-title { font-size: 12pt; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
          .instructions-list { font-size: 11pt; color: #334155; padding-right: 20px; line-height: 1.6; }

          .footer {
            margin-top: 18px;
            font-size: 9.5pt;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
          }
          .url-hint { font-family: monospace; font-size: 8.5pt; color: #94a3b8; margin-top: 4px; word-break: break-all; }

          .page-break { page-break-after: always; height: 0; margin: 0; }

          @media print {
            body { padding: 0; }
            .qr-card { border: 2px solid #000; box-shadow: none; margin-bottom: 0; }
          }
        </style>
      </head>
      <body>
        ${cardsHtml}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleCopyLink = (dept: string) => {
    const url = getPortalUrlForDept(dept);
    navigator.clipboard.writeText(url);
    setCopiedDept(dept);
    setTimeout(() => setCopiedDept(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-sky-500/25 shrink-0">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-xl sm:text-2xl text-white">הדפסת קודי QR להזמנות מחלקתיות</h3>
              <p className="text-sm sm:text-base text-slate-300 font-medium mt-0.5">כרטיסיות מעוצבות להדבקה במחלקות להזמנה ישירה מהטלפון</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePrint()}
              className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm sm:text-base rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-5 h-5" />
              <span>הדפס הכל ({deptsToDisplay.length})</span>
            </button>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 sm:p-5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-sky-400 shrink-0" />
            <span className="text-sm font-bold text-slate-200">בחר מחלקה להצגה:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-bold focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="all">כל המחלקות ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <span className="text-sm text-slate-300 font-medium">
            מוצגות <strong className="text-white">{deptsToDisplay.length}</strong> כרטיסיות
          </span>
        </div>

        {/* Cards Grid Container */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 bg-slate-950/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deptsToDisplay.map((dept) => {
              const qrUrl = getQrImageUrl(dept);
              const portalUrl = getPortalUrlForDept(dept);
              const isCopied = copiedDept === dept;

              return (
                <div
                  key={dept}
                  className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-xl flex flex-col justify-between relative group hover:border-indigo-400 transition-all"
                >
                  <div>
                    {/* Header */}
                    <div className="text-center pb-3 border-b border-slate-800">
                      <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">StorePrint • מחלקות בית החולים</span>
                      <h4 className="text-2xl font-black text-white mt-1">{dept}</h4>
                    </div>

                    {/* QR Frame */}
                    <div className="my-5 bg-white p-5 rounded-2xl flex flex-col items-center justify-center max-w-[220px] mx-auto shadow-md">
                      <img src={qrUrl} alt={`QR for ${dept}`} className="w-44 h-44 object-contain" />
                      <span className="text-xs font-black text-slate-900 mt-2.5 text-center">
                        סריקה להזמנה ישירה במחלקה
                      </span>
                    </div>

                    {/* Explanatory Instructions in Frame */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 space-y-2 text-right">
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>📋 הוראות להדבקה במחלקה:</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300">
                        1. סרקו את ה-QR באמצעות מצלמת הסמארטפון.
                      </p>
                      <p className="text-xs sm:text-sm text-slate-300">
                        2. בחרו פריטים וכמויות באריזות הנדרשות.
                      </p>
                      <p className="text-xs sm:text-sm text-slate-300">
                        3. לחצו "שלח" — ההזמנה תודפס ותנופק במחסן!
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-5 mt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                      onClick={() => handlePrint(dept)}
                      className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Printer className="w-4 h-4" />
                      <span>הדפס כרטיסייה זו</span>
                    </button>

                    <button
                      onClick={() => handleCopyLink(dept)}
                      className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                      title="העתק קישור ישיר"
                    >
                      {isCopied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
