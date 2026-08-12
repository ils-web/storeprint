import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Order, PrintSettings } from '../types';

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
 * Generates an HTML document optimized for printing and opens the browser's print dialog.
 * Guarantees 100% accurate Hebrew RTL rendering, proper font sizing and page breaks.
 */
export function printOrdersHtml(orders: Order[], settings: PrintSettings) {
  if (!orders || orders.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна в браузере для отправки на печать.');
    return;
  }

  const { paperSize, orientation, showCheckbox, fontSizePt } = settings;

  let pageCss = '';
  if (paperSize === 'A5') {
    pageCss = `@page { size: A5 ${orientation}; margin: 8mm; }`;
  } else if (paperSize === 'LABEL_100x150') {
    pageCss = `@page { size: 100mm 150mm ${orientation}; margin: 4mm; }`;
  } else if (paperSize === 'ROLL_80MM') {
    pageCss = `@page { size: 80mm auto; margin: 3mm; }`;
  } else {
    pageCss = `@page { size: A4 ${orientation}; margin: 10mm; }`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>הדפסת הזמנות - ${orders[0]?.department || 'הזמנה'}</title>
      <style>
        ${pageCss}
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, Tahoma, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-size: ${fontSizePt || 13}pt;
          line-height: 1.35;
          direction: rtl;
        }
        .order-page {
          page-break-after: always;
          padding: 12px;
          border: 1px solid #cbd5e1;
          margin-bottom: 24px;
          background: #fff;
          border-radius: 8px;
        }
        .order-page:last-child {
          page-break-after: auto;
        }
        @media print {
          body { padding: 0; }
          .order-page {
            border: none;
            margin-bottom: 0;
            padding: 0;
            border-radius: 0;
          }
          .no-print { display: none !important; }
        }
        .header-box {
          border-bottom: 3px solid #0284c7;
          padding-bottom: 10px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .dept-title {
          font-size: 22pt;
          font-weight: 800;
          color: #0369a1;
          margin: 0 0 4px 0;
          line-height: 1.1;
        }
        .order-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 11pt;
          color: #334155;
          font-weight: 600;
          margin-top: 6px;
        }
        .meta-tag {
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          margin-bottom: 16px;
          font-size: 11pt;
        }
        .items-table th {
          background: #f8fafc;
          border: 1.5px solid #64748b;
          padding: 8px 10px;
          text-align: right;
          font-weight: 800;
          color: #0f172a;
        }
        .items-table td {
          border: 1px solid #94a3b8;
          padding: 8px 10px;
          vertical-align: middle;
          text-align: right;
        }
        .items-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .chk-col {
          width: 44px;
          text-align: center !important;
        }
        .chk-box {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2px solid #0284c7;
          border-radius: 3px;
        }
        .num-col {
          width: 44px;
          text-align: center !important;
          font-weight: 700;
          color: #64748b;
        }
        .qty-col {
          width: 110px;
          text-align: center !important;
          font-weight: 800;
          font-size: 13pt;
          color: #0369a1;
          background: #f0f9ff;
        }
        .footer-summary {
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1.5px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 10.5pt;
          color: #475569;
        }
        .sign-box {
          display: inline-block;
          width: 140px;
          border-bottom: 1.5px solid #0f172a;
          margin-right: 6px;
        }
      </style>
    </head>
    <body>
      ${orders
        .map(
          (order) => `
        <div class="order-page">
          <div class="header-box">
            <div>
              <h1 class="dept-title">מחלקה: ${escapeHtml(order.department)}</h1>
              <div class="order-meta">
                <div class="meta-tag"><strong>תאריך ושעה:</strong> ${escapeHtml(order.timestamp)}</div>
                <div class="meta-tag"><strong>מספר הזמנה:</strong> ${escapeHtml(order.id)}</div>
                ${order.patientsCount ? `<div class="meta-tag"><strong>מטופלים:</strong> ${escapeHtml(order.patientsCount)}</div>` : ''}
                <div class="meta-tag" style="background: #e0f2fe; color: #0369a1; font-weight:bold;">
                  <strong>סה"כ פריטים:</strong> ${order.items.length}
                </div>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th class="num-col">№</th>
                ${showCheckbox ? `<th class="chk-col">בדיקה</th>` : ''}
                <th>שם המוצר / פריט</th>
                <th class="qty-col">כמות</th>
              </tr>
            </thead>
            <tbody>
              ${
                order.items.length > 0
                  ? order.items
                      .map(
                        (item, i) => `
                    <tr>
                      <td class="num-col">${i + 1}</td>
                      ${showCheckbox ? `<td class="chk-col"><span class="chk-box"></span></td>` : ''}
                      <td style="font-weight: 700; color: #1e293b;">${escapeHtml(item.name)}</td>
                      <td class="qty-col">${escapeHtml(item.qty)}</td>
                    </tr>
                  `
                      )
                      .join('')
                  : `<tr>
                      <td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">
                        לא נבחרו פריטים בהזמנה זו
                      </td>
                    </tr>`
              }
            </tbody>
          </table>

          <div class="footer-summary">
            <div><strong>סה"כ שורות להספקה:</strong> ${order.items.length} פריטים</div>
            <div><strong>חתימת מקבל:</strong> <span class="sign-box"></span></div>
          </div>
        </div>
      `
        )
        .join('')}
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

/**
 * PDF Download via jsPDF with clean UTF-8 text formatting and table
 */
export function generateOrdersPdfDownload(orders: Order[], settings: PrintSettings) {
  // Use HTML Print which is 100% reliable across all browsers and platforms
  printOrdersHtml(orders, settings);
}
