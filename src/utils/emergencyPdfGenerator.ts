import { StockItem } from '../types';

/**
 * Escapes HTML characters
 */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an HTML document for Hospital Emergency Reorder / Procurement Sheet (X3 stock buffer)
 * and opens the native print dialog with 100% accurate Hebrew RTL rendering.
 */
export function printEmergencyReorderListHtml(
  items: StockItem[],
  globalRoutineThreshold: number = 10,
  emergencyMultiplier: number = 3,
  hospitalName: string = 'מרכז רפואי - אגף לוגיסטיקה ושעת חירום'
) {
  if (!items || items.length === 0) {
    alert('אין פריטים בחוסר לשעת חירום להדפסה.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1000,height=850');
  if (!printWindow) {
    alert('נא לאפשר חלונות קופצים (Pop-ups) בדפדפן כדי להדפיס את דוח החירום.');
    return;
  }

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Filter items in emergency deficit
  const emergencyDeficitItems = items
    .map((item) => {
      const routineTh = item.minThreshold || globalRoutineThreshold;
      const emergencyTh = routineTh * emergencyMultiplier;
      const neededQty = Math.max(0, emergencyTh - (item.currentStock || 0));
      return {
        ...item,
        routineTh,
        emergencyTh,
        neededQty,
      };
    })
    .filter((item) => item.neededQty > 0)
    .sort((a, b) => b.neededQty - a.neededQty);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דוח דרישות רכש והצטיידות שעת חירום (מלאי X3) - StorePrint</title>
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Assistant', Arial, Tahoma, sans-serif; }
        body {
          background: #ffffff;
          color: #0f172a;
          padding: 15px;
          font-size: 11.5pt;
          direction: rtl;
        }
        .emergency-header {
          border: 3px solid #dc2626;
          background: #fef2f2;
          border-radius: 16px;
          padding: 16px 20px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-main { text-align: right; }
        .emergency-badge {
          background: #dc2626;
          color: #ffffff;
          font-size: 13pt;
          font-weight: 900;
          padding: 6px 14px;
          border-radius: 10px;
          display: inline-block;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .title {
          font-size: 20pt;
          font-weight: 900;
          color: #991b1b;
          margin-top: 4px;
        }
        .subtitle {
          font-size: 11pt;
          color: #7f1d1d;
          font-weight: 700;
          margin-top: 3px;
        }
        .header-meta {
          text-align: left;
          font-size: 10pt;
          color: #991b1b;
          font-weight: 600;
        }
        .meta-box {
          background: #fee2e2;
          border: 1px solid #f87171;
          padding: 8px 12px;
          border-radius: 10px;
          text-align: center;
        }
        .meta-number {
          font-size: 18pt;
          font-weight: 900;
          color: #b91c1c;
        }

        .alert-instruction {
          background: #fffbeb;
          border: 1.5px solid #f59e0b;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 10pt;
          color: #92400e;
          font-weight: 700;
          margin-bottom: 16px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #1e293b;
          color: #ffffff;
          font-weight: 800;
          font-size: 10.5pt;
          padding: 10px 8px;
          text-align: right;
          border: 1px solid #334155;
        }
        td {
          padding: 8px;
          border: 1px solid #cbd5e1;
          font-size: 10pt;
          vertical-align: middle;
        }
        tr:nth-child(even) {
          background: #f8fafc;
        }
        .num-col { text-align: center; font-weight: bold; width: 35px; }
        .item-col { font-weight: 800; color: #0f172a; }
        .stock-col { text-align: center; font-weight: 700; background: #f1f5f9; width: 90px; }
        .routine-col { text-align: center; color: #64748b; font-size: 9.5pt; width: 85px; }
        .emergency-col { text-align: center; font-weight: 800; color: #b91c1c; background: #fef2f2; width: 95px; }
        .needed-col {
          text-align: center;
          font-weight: 900;
          font-size: 12pt;
          color: #ffffff;
          background: #dc2626 !important;
          width: 120px;
        }
        .notes-col { width: 110px; }
        .empty-line {
          display: block;
          width: 90%;
          border-bottom: 1px dotted #94a3b8;
          height: 14px;
        }

        .footer {
          margin-top: 25px;
          padding-top: 15px;
          border-top: 2px solid #dc2626;
          display: flex;
          justify-content: space-between;
          font-size: 10pt;
          color: #334155;
          page-break-inside: avoid;
        }
        .signature-box {
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          width: 31%;
        }
        .sig-title { font-weight: 800; color: #0f172a; font-size: 10.5pt; margin-bottom: 25px; }
        .sig-line { border-bottom: 1.5px solid #475569; display: block; width: 100%; margin-top: 5px; }

        @media print {
          body { padding: 0; }
          .emergency-header { border-width: 2px; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="emergency-header">
        <div class="header-main">
          <div class="emergency-badge">🚨 נוהל שעת חירום / חל"ק פעיל</div>
          <h1 class="title">דוח דרישות רכש והצטיידות שעת חירום (מלאי משולש X3)</h1>
          <div class="subtitle">${escapeHtml(hospitalName)} • מחסן אספקה וציוד רפואי</div>
        </div>
        <div class="header-meta">
          <div class="meta-box">
            <div style="font-size: 9pt; font-weight: bold; color: #7f1d1d;">פריטים בחוסר חירום:</div>
            <div class="meta-number">${emergencyDeficitItems.length}</div>
          </div>
          <div style="margin-top: 5px;">תאריך הפקה: <strong>${dateStr}</strong></div>
        </div>
      </div>

      <div class="alert-instruction">
        ⚠️ <strong>הנחיית שעת חירום:</strong> כל ספי המינימום חושבו במכפיל פי 3 (X3) מהשגרה. יש להעביר דוח זה מיידית לאגף הרכש וקצין הלוגיסטיקה לניפוק והזמנה בהולה!
      </div>

      <table>
        <thead>
          <tr>
            <th class="num-col">№</th>
            <th>שם הפריט / מק"ט (מתוך קטלוג המחסן)</th>
            <th class="stock-col">יתרת מלאי</th>
            <th class="routine-col">סף שגרה (1X)</th>
            <th class="emergency-col">תקן חירום (3X)</th>
            <th class="needed-col">כמות לרכש דחוף</th>
            <th class="notes-col">ספק / הערות</th>
          </tr>
        </thead>
        <tbody>
          ${emergencyDeficitItems
            .map((item, i) => {
              const unit = escapeHtml(item.unit || "יח'");
              return `
            <tr>
              <td class="num-col">${i + 1}</td>
              <td class="item-col">${escapeHtml(item.name)}</td>
              <td class="stock-col"><strong>${item.currentStock}</strong> ${unit}</td>
              <td class="routine-col">${item.routineTh} ${unit}</td>
              <td class="emergency-col"><strong>${item.emergencyTh}</strong> ${unit}</td>
              <td class="needed-col">${item.neededQty} ${unit}</td>
              <td class="notes-col"><span class="empty-line"></span></td>
            </tr>
          `;
            })
            .join('')}
        </tbody>
      </table>

      <div class="footer">
        <div class="signature-box">
          <div class="sig-title">קצין לוגיסטיקה ושעת חירום:</div>
          <div>שם: __________________</div>
          <div class="sig-line"></div>
        </div>
        <div class="signature-box">
          <div class="sig-title">מנהל מחסן ראשי / בית מרקחת:</div>
          <div>שם: __________________</div>
          <div class="sig-line"></div>
        </div>
        <div class="signature-box">
          <div class="sig-title">אישור הנהלת המרכז הרפואי / רכש:</div>
          <div>שם: __________________</div>
          <div class="sig-line"></div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
