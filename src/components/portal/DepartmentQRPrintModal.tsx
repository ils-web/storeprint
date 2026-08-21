import React, { useState } from 'react';
import { QrCode, Printer, Building2, X, Download, Smartphone, CheckCircle2, Copy } from 'lucide-react';

interface DepartmentQRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: string[];
  tenantName?: string;
}

export function DepartmentQRPrintModal({
  isOpen,
  onClose,
  departments,
  tenantName = 'מרכז רפואי (סניף ראשי)',
}: DepartmentQRPrintModalProps) {
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [copiedDept, setCopiedDept] = useState<string | null>(null);

  if (!isOpen) return null;

  // Base URL for mobile staff order portal
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const getPortalUrlForDept = (dept: string) => {
    return `${origin}/?view=portal_pwa&dept=${encodeURIComponent(dept)}`;
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
            padding: 30px 25px;
            text-align: center;
            background: #ffffff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            page-break-inside: avoid;
          }
          .header { margin-bottom: 20px; }
          .logo { font-size: 20px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
          .title { font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          .sub-tenant { font-size: 13px; color: #64748b; margin-top: 2px; }
          
          .dept-badge {
            background: #f0fdf4;
            border: 2px dashed #16a34a;
            border-radius: 16px;
            padding: 12px 20px;
            margin: 15px 0 20px 0;
            display: inline-block;
            min-width: 80%;
          }
          .dept-label { font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; }
          .dept-name { font-size: 26px; font-weight: 900; color: #14532d; margin-top: 2px; }

          .qr-frame {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 20px;
            padding: 20px;
            display: inline-block;
            margin-bottom: 20px;
          }
          .qr-img { width: 220px; height: 220px; display: block; margin: 0 auto; }
          .qr-subtext { font-size: 13px; font-weight: 700; color: #475569; margin-top: 10px; }

          .instructions-box {
            background: #f1f5f9;
            border-radius: 16px;
            padding: 16px 20px;
            text-align: right;
            margin-bottom: 20px;
            border-right: 4px solid #0284c7;
          }
          .instructions-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
          .instructions-list { padding-right: 20px; font-size: 13px; color: #334155; line-height: 1.6; }
          .instructions-list li { margin-bottom: 4px; }

          .footer { font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          .url-hint { font-size: 9px; color: #94a3b8; font-family: monospace; margin-top: 4px; word-break: break-all; }

          @media print {
            body { padding: 0; }
            .page-break { page-break-after: always; height: 0; }
            .qr-card { border-width: 2px; box-shadow: none; margin: 0 auto; }
          }
        </style>
      </head>
      <body>
        ${cardsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyLink = (dept: string) => {
    const url = getPortalUrlForDept(dept);
    navigator.clipboard.writeText(url);
    setCopiedDept(dept);
    setTimeout(() => setCopiedDept(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">הפקת כרטיסיות QR להזמנות מחלקות</h3>
              <p className="text-xs text-slate-400">הדפסת כרטיסיות עם הוראות ברורות לתלייה בכל מחלקה</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>הדפס את כל הכרטיסיות (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">בחר מחלקה להצגה:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">כל המחלקות ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400">
            מוצגות <strong>{deptsToDisplay.length}</strong> כרטיסיות
          </span>
        </div>

        {/* Cards Grid Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-950/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deptsToDisplay.map((dept) => {
              const qrUrl = getQrImageUrl(dept);
              const portalUrl = getPortalUrlForDept(dept);
              const isCopied = copiedDept === dept;

              return (
                <div
                  key={dept}
                  className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between relative group hover:border-indigo-500 transition-all"
                >
                  <div>
                    {/* Header */}
                    <div className="text-center pb-3 border-b border-slate-800">
                      <span className="text-[11px] font-extrabold uppercase text-indigo-400 tracking-wider">StorePrint • מחלקות</span>
                      <h4 className="text-xl font-black text-white mt-0.5">{dept}</h4>
                    </div>

                    {/* QR Frame */}
                    <div className="my-4 bg-white p-4 rounded-2xl flex flex-col items-center justify-center max-w-[200px] mx-auto shadow-md">
                      <img src={qrUrl} alt={`QR for ${dept}`} className="w-40 h-40 object-contain" />
                      <span className="text-[11px] font-bold text-slate-800 mt-2 text-center">
                        סריקה להזמנה ישירה
                      </span>
                    </div>

                    {/* Explanatory Instructions in Frame */}
                    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-300 space-y-1.5 text-right">
                      <div className="font-bold text-white flex items-center gap-1">
                        <span>📋 הוראות להדבקה במחלקה:</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        1. סרקו את ה-QR באמצעות מצלמת הסמארטפון.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        2. בחרו פריטים וכמויות באריזות הנדרשות.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        3. לחצו "שלח" — ההזמנה תודפס ותנופק במחסן!
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handlePrint(dept)}
                      className="flex-1 py-2 px-3 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>הדפס כרטיסייה זו</span>
                    </button>

                    <button
                      onClick={() => handleCopyLink(dept)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                      title="העתק קישור ישיר"
                    >
                      {isCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
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
