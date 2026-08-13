import { Order, PrintSettings, StockItem } from '../types';

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
 * Generates an HTML document for department orders and opens the print dialog.
 * 100% accurate Hebrew RTL rendering and styling.
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
 * Generates an HTML document for the Reorder List / Low Stock Items (< 10 units) and opens print dialog
 */
export function printReorderListHtml(
  lowStockItems: StockItem[],
  threshold: number = 10
) {
  if (!lowStockItems || lowStockItems.length === 0) {
    alert('Нет позиций с остатком меньше указанного порога!');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна в браузере для отправки на печать.');
    return;
  }

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דוח חוסרים והזמנת רכש למחסן - ${dateFormatted}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, Tahoma, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-size: 11pt;
          line-height: 1.35;
          direction: rtl;
        }
        .page-container {
          padding: 10px;
        }
        .header-box {
          border-bottom: 3px solid #dc2626;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .title {
          font-size: 20pt;
          font-weight: 800;
          color: #b91c1c;
          margin: 0 0 6px 0;
        }
        .subtitle {
          font-size: 11pt;
          color: #475569;
          font-weight: 600;
        }
        .meta-tags {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }
        .meta-tag {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 10.5pt;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          margin-bottom: 20px;
        }
        .items-table th {
          background: #f1f5f9;
          border: 1.5px solid #475569;
          padding: 8px 10px;
          text-align: right;
          font-weight: 800;
          color: #0f172a;
          font-size: 10.5pt;
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
        .num-col {
          width: 40px;
          text-align: center !important;
          font-weight: 700;
          color: #64748b;
        }
        .stock-col {
          width: 95px;
          text-align: center !important;
          font-weight: 800;
          font-size: 12pt;
          color: #dc2626;
          background: #fef2f2;
        }
        .threshold-col {
          width: 75px;
          text-align: center !important;
          color: #475569;
          font-weight: 600;
        }
        .order-qty-col {
          width: 110px;
          text-align: center !important;
          border-bottom: 2px dashed #0284c7;
        }
        .notes-col {
          width: 130px;
        }
        .footer-box {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1.5px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 10.5pt;
          color: #334155;
        }
        .sign-line {
          display: inline-block;
          width: 160px;
          border-bottom: 1.5px solid #0f172a;
          margin-right: 6px;
        }
      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="header-box">
          <div>
            <h1 class="title">📋 דוח חוסרים והזמנת רכש למחסן</h1>
            <div class="subtitle">רשימת פריטים שיתרת המלאי שלהם נמוכה מסף המינימום (&lt; ${threshold} יחידות)</div>
            <div class="meta-tags">
              <div class="meta-tag">תאריך הפקה: ${dateFormatted}</div>
              <div class="meta-tag">סה"כ פריטים להזמנה: ${lowStockItems.length}</div>
            </div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="num-col">№</th>
              <th>שם המוצר / פריט (עמודה בטבלה)</th>
              <th class="stock-col">מלאי נוכחי</th>
              <th class="threshold-col">סף מינימום</th>
              <th class="order-qty-col">כמות להזמנה</th>
              <th class="notes-col">הערות / ספק</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockItems
              .map(
                (item, idx) => `
              <tr>
                <td class="num-col">${idx + 1}</td>
                <td style="font-weight: 700; color: #0f172a;">${escapeHtml(item.name)}</td>
                <td class="stock-col">${item.currentStock}</td>
                <td class="threshold-col">${item.minThreshold || threshold}</td>
                <td class="order-qty-col"></td>
                <td class="notes-col"></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer-box">
          <div><strong>סה"כ שורות בדוח:</strong> ${lowStockItems.length} פריטים דורשים אספקה</div>
          <div><strong>חתימת מנהל מחסן / אחראי רכש:</strong> <span class="sign-line"></span></div>
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
