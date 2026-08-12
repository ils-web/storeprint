import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Order, PrintSettings } from '../types';
import { formatRuDate } from './dateUtils';

/**
 * Generates an HTML document optimized for printing and opens the browser's 1-click print dialog.
 * This guarantees proper Cyrillic rendering, perfect layout formatting for any printer (A4, A5, 100x150 label, 80mm roll).
 */
export function printOrdersHtml(orders: Order[], settings: PrintSettings) {
  if (!orders || orders.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна в браузере для отправки на печать.');
    return;
  }

  const { paperSize, orientation, showCheckbox, showClientDetails, showNotes } = settings;

  // CSS page dimensions based on printer paper preset
  let pageCss = '';
  if (paperSize === 'LABEL_100x150') {
    pageCss = `@page { size: 100mm 150mm ${orientation}; margin: 4mm; }`;
  } else if (paperSize === 'ROLL_80MM') {
    pageCss = `@page { size: 80mm auto; margin: 3mm; }`;
  } else if (paperSize === 'A5') {
    pageCss = `@page { size: A5 ${orientation}; margin: 8mm; }`;
  } else {
    pageCss = `@page { size: A4 ${orientation}; margin: 10mm; }`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Печать заказов - StorePrint</title>
      <style>
        ${pageCss}
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-size: ${paperSize === 'ROLL_80MM' || paperSize === 'LABEL_100x150' ? '11px' : '13px'};
          line-height: 1.35;
        }
        .order-page {
          page-break-after: always;
          padding: 8px;
          border: 1px solid #e2e8f0;
          margin-bottom: 20px;
          background: #fff;
          border-radius: 6px;
        }
        @media print {
          .order-page {
            border: none;
            margin-bottom: 0;
            padding: 0;
            border-radius: 0;
          }
        }
        .header-box {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .order-title {
          font-size: ${paperSize === 'ROLL_80MM' ? '16px' : '20px'};
          font-weight: 800;
          margin: 0;
          color: #0284c7;
          letter-spacing: -0.5px;
        }
        .order-date {
          font-size: 12px;
          color: #475569;
          margin-top: 2px;
          font-weight: 600;
        }
        .barcode-box {
          text-align: right;
          border: 1px dashed #64748b;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          font-weight: bold;
          font-size: 11px;
          background: #f8fafc;
        }
        .client-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }
        .client-row {
          display: flex;
          margin-bottom: 4px;
        }
        .client-row:last-child { margin-bottom: 0; }
        .label {
          font-weight: 700;
          width: 90px;
          color: #475569;
          flex-shrink: 0;
        }
        .value {
          font-weight: 600;
          color: #0f172a;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        .items-table th {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #334155;
        }
        .items-table td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          vertical-align: middle;
        }
        .chk-col {
          width: 38px;
          text-align: center;
        }
        .chk-box {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2px solid #0284c7;
          border-radius: 3px;
        }
        .qty-col {
          width: 70px;
          text-align: center;
          font-weight: bold;
        }
        .notes-box {
          border: 1px solid #fde047;
          background: #fefce8;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 11px;
        }
        .footer-sign {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          color: #64748b;
        }
        .sign-line {
          width: 150px;
          border-bottom: 1px solid #0f172a;
          display: inline-block;
          margin-left: 6px;
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
              <h1 class="order-title">ЗАКАЗ ДЛЯ СБОРКИ ${order.id}</h1>
              <div class="order-date">Дата заказа: ${formatRuDate(order.parsedDate) || order.rawDate || 'Текущая неделя'}</div>
            </div>
            ${
              settings.showBarcode
                ? `<div class="barcode-box">
                     <div>||||| |||| ||||| ||</div>
                     <div>${order.id}</div>
                   </div>`
                : ''
            }
          </div>

          ${
            showClientDetails
              ? `<div class="client-section">
                   <div class="client-row"><span class="label">Получатель:</span><span class="value">${escapeHtml(order.clientName)}</span></div>
                   ${order.phone ? `<div class="client-row"><span class="label">Телефон:</span><span class="value">${escapeHtml(order.phone)}</span></div>` : ''}
                   ${order.address ? `<div class="client-row"><span class="label">Адрес:</span><span class="value">${escapeHtml(order.address)}</span></div>` : ''}
                   ${order.status ? `<div class="client-row"><span class="label">Статус:</span><span class="value">${escapeHtml(order.status)}</span></div>` : ''}
                 </div>`
              : ''
          }

          <table class="items-table">
            <thead>
              <tr>
                ${showCheckbox ? `<th class="chk-col">Сборка</th>` : ''}
                <th style="width:30px">№</th>
                <th>Наименование позиций для сборки</th>
                <th class="qty-col">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              ${
                order.parsedItems && order.parsedItems.length > 0
                  ? order.parsedItems
                      .map(
                        (item, i) => `
                    <tr>
                      ${showCheckbox ? `<td class="chk-col"><span class="chk-box"></span></td>` : ''}
                      <td style="text-align:center">${i + 1}</td>
                      <td style="font-weight:600">${escapeHtml(item.name)}</td>
                      <td class="qty-col">${escapeHtml(String(item.qty))}</td>
                    </tr>
                  `
                      )
                      .join('')
                  : `<tr>
                      ${showCheckbox ? `<td class="chk-col"><span class="chk-box"></span></td>` : ''}
                      <td style="text-align:center">1</td>
                      <td style="font-weight:600">${escapeHtml(order.itemsText)}</td>
                      <td class="qty-col">${escapeHtml(order.quantity)}</td>
                    </tr>`
              }
            </tbody>
          </table>

          ${
            showNotes && order.notes
              ? `<div class="notes-box">
                   <strong>Примечание к заказу:</strong> ${escapeHtml(order.notes)}
                 </div>`
              : ''
          }

          <div class="footer-sign">
            <div>Сборщик: <span class="sign-line"></span></div>
            <div>Штамп/Подпись: <span class="sign-line"></span></div>
            <div>StorePrint — Печать в 1 клик</div>
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

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Downloads a standalone PDF document using jsPDF
 */
export function generateOrdersPdfDownload(orders: Order[], settings: PrintSettings) {
  const doc = new jsPDF({
    orientation: settings.orientation,
    unit: 'mm',
    format: settings.paperSize === 'A5' ? 'a5' : 'a4',
  });

  orders.forEach((order, index) => {
    if (index > 0) {
      doc.addPage();
    }

    doc.setFontSize(16);
    doc.text(`СБОРОЧНЫЙ БЛАНК ${order.id}`, 14, 18);

    doc.setFontSize(10);
    doc.text(`Дата: ${order.rawDate || formatRuDate(order.parsedDate)}`, 14, 25);
    doc.text(`Получатель: ${order.clientName}`, 14, 31);
    if (order.address) {
      doc.text(`Адрес: ${order.address}`, 14, 37);
    }

    // Table rows
    const tableData = (order.parsedItems || []).map((item, i) => [
      '[  ]',
      String(i + 1),
      item.name,
      String(item.qty),
    ]);

    (doc as any).autoTable({
      startY: order.address ? 43 : 37,
      head: [['Отметка', '№', 'Наименование', 'Кол-во']],
      body: tableData.length > 0 ? tableData : [['[  ]', '1', order.itemsText, order.quantity]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
      },
    });

    if (order.notes) {
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.text(`Примечание: ${order.notes}`, 14, finalY);
    }
  });

  doc.save(`orders_assembly_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
