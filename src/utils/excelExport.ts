import { StockItem } from '../types';
import { categorizeItem } from './stockGrouper';
import { detectPackageSize } from './stockManager';

export interface PurchaseOrderExportLine {
  displayNumber: number;
  name: string;
  categoryName?: string;
  currentStock: number;
  minThreshold: number;
  orderQty: number;
  orderUnit: string;
  packageSize?: number;
  note?: string;
}

export interface PurchaseOrderExportMetadata {
  branchName?: string;
  referenceNumber?: string;
  supplierName?: string;
  orderedBy?: string;
  notes?: string;
  createdAt?: Date;
  isEmergencyMode?: boolean;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Escapes XML entities and strips invalid XML 1.0 control chars.
 * Guards against leading spreadsheet formula characters by prefixing an explicit space if needed
 * when rendered inside spreadsheet cells if desired, while inlineStr keeps literal display safe.
 */
function escapeXml(value: unknown): string {
  const raw = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnIndexToLetter(index: number): string {
  let col = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function stringCell(colIdx: number, rowNumber: number, value: string, styleIdx: number = 0): string {
  const ref = `${columnIndexToLetter(colIdx)}${rowNumber}`;
  return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function numberCell(colIdx: number, rowNumber: number, value: number, styleIdx: number = 0): string {
  const ref = `${columnIndexToLetter(colIdx)}${rowNumber}`;
  const safeNum = Number.isFinite(value) ? value : 0;
  return `<c r="${ref}" s="${styleIdx}" t="n"><v>${safeNum}</v></c>`;
}

function formulaCell(colIdx: number, rowNumber: number, formula: string, cachedValue: number, styleIdx: number = 0): string {
  const ref = `${columnIndexToLetter(colIdx)}${rowNumber}`;
  const safeCached = Number.isFinite(cachedValue) ? cachedValue : 0;
  return `<c r="${ref}" s="${styleIdx}"><f>${escapeXml(formula)}</f><v>${safeCached}</v></c>`;
}

function createZipArchive(files: { path: string; data: Uint8Array }[], now: Date): Uint8Array {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime(now);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // STORE compression
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const part of centralParts) centralDirSize += part.length;

  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralDirSize + endRecord.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localParts) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(endRecord, pos);
  return result;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Arial"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E293B"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FF065F46"/><name val="Arial"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0369A1"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="medium"><color rgb="FF334155"/></top>
      <bottom style="double"><color rgb="FF334155"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" readingOrder="2" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="2" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" readingOrder="2" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

export function buildPurchaseOrderXlsxBytes(
  lines: PurchaseOrderExportLine[],
  meta: PurchaseOrderExportMetadata = {}
): Uint8Array {
  const now = meta.createdAt || new Date();
  const branchName = meta.branchName?.trim() || 'מחסן ראשי';
  const refNum =
    meta.referenceNumber?.trim() ||
    `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const dateDisplay = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const totalOrderQty = lines.reduce((sum, l) => sum + (Number.isFinite(l.orderQty) ? l.orderQty : 0), 0);

  const rowXmls: string[] = [];

  // Row 1: Title Banner
  const titleText = meta.isEmergencyMode
    ? `טופס הזמנת רכש (שעת חירום X3) — ${branchName}`
    : `טופס הזמנת רכש מהמחסן — ${branchName}`;
  rowXmls.push(`<row r="1" ht="30" customHeight="1">${stringCell(0, 1, titleText, 1)}</row>`);

  // Row 2: Order Metadata
  const metaLeft = `מספר טופס: ${refNum}  |  תאריך הפקה: ${dateDisplay}`;
  const metaRight = [
    meta.orderedBy?.trim() ? `מבצע הזמנה: ${meta.orderedBy.trim()}` : '',
    meta.supplierName?.trim() ? `ספק: ${meta.supplierName.trim()}` : '',
  ]
    .filter(Boolean)
    .join('  |  ') || `סה"כ פריטים בטופס: ${lines.length}`;
  rowXmls.push(
    `<row r="2" ht="24" customHeight="1">${stringCell(0, 2, metaLeft, 2)}${stringCell(1, 2, '', 2)}${stringCell(2, 2, '', 2)}${stringCell(3, 2, metaRight, 2)}${stringCell(4, 2, '', 2)}${stringCell(5, 2, '', 2)}</row>`
  );

  // Row 3: Optional Notes / Summary
  const notesText = meta.notes?.trim()
    ? `הערות להזמנה: ${meta.notes.trim()}`
    : `סה"כ שורות להזמנה: ${lines.length}  |  סה"כ כמות כוללת: ${totalOrderQty}`;
  rowXmls.push(
    `<row r="3" ht="22" customHeight="1">${stringCell(0, 3, notesText, 2)}${stringCell(1, 3, '', 2)}${stringCell(2, 3, '', 2)}${stringCell(3, 3, '', 2)}${stringCell(4, 3, '', 2)}${stringCell(5, 3, '', 2)}</row>`
  );

  // Row 4: Spacer
  rowXmls.push(`<row r="4" ht="10" customHeight="1"/>`);

  // Row 5: Table Headers (6 compact printable columns)
  const headers = [
    "מס' במחסן",
    'קטגוריה',
    'שם הפריט / מוצר',
    'כמות להזמנה',
    'יחידת הזמנה',
    'פירוט אריזה והערות',
  ];
  rowXmls.push(
    `<row r="5" ht="26" customHeight="1">${headers.map((h, i) => stringCell(i, 5, h, 3)).join('')}</row>`
  );

  // Data Rows (starting at row 6)
  const firstDataRow = 6;
  lines.forEach((line, idx) => {
    const r = firstDataRow + idx;
    const cat = line.categoryName || categorizeItem(line.name).groupName;
    const pkgSz = line.packageSize || detectPackageSize(line.name);
    const detailsParts = [
      pkgSz && pkgSz > 1 ? `${pkgSz} יח' במארז` : '',
      line.note?.trim() || '',
    ].filter(Boolean);

    const cells = [
      numberCell(0, r, line.displayNumber, 5),
      stringCell(1, r, cat, 4),
      stringCell(2, r, line.name, 4),
      numberCell(3, r, line.orderQty, 6),
      stringCell(4, r, line.orderUnit || "יח'", 5),
      stringCell(5, r, detailsParts.join(' • '), 4),
    ].join('');

    rowXmls.push(`<row r="${r}" ht="22" customHeight="1">${cells}</row>`);
  });

  // Totals Summary Row
  const lastDataRow = firstDataRow + Math.max(0, lines.length - 1);
  const summaryRow = firstDataRow + lines.length;
  const sumFormula = lines.length > 0 ? `SUM(D${firstDataRow}:D${lastDataRow})` : '0';
  rowXmls.push(
    `<row r="${summaryRow}" ht="24" customHeight="1">${stringCell(0, summaryRow, 'סה"כ', 7)}${stringCell(1, summaryRow, '', 7)}${stringCell(2, summaryRow, `${lines.length} פריטים להזמנה`, 7)}${formulaCell(3, summaryRow, sumFormula, totalOrderQty, 7)}${stringCell(4, summaryRow, "יח'/אריזות", 7)}${stringCell(5, summaryRow, '', 7)}</row>`
  );

  const fitToHeightVal = lines.length <= 45 ? 1 : 0;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews>
    <sheetView workbookViewId="0" rightToLeft="1">
      <pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>
    <col min="1" max="1" width="13.5" customWidth="1"/>
    <col min="2" max="2" width="22" customWidth="1"/>
    <col min="3" max="3" width="42" customWidth="1"/>
    <col min="4" max="4" width="16" customWidth="1"/>
    <col min="5" max="5" width="15" customWidth="1"/>
    <col min="6" max="6" width="26" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowXmls.join('\n    ')}
  </sheetData>
  <autoFilter ref="A5:F${Math.max(5, lastDataRow)}"/>
  <mergeCells count="4">
    <mergeCell ref="A1:F1"/>
    <mergeCell ref="A2:C2"/>
    <mergeCell ref="D2:F2"/>
    <mergeCell ref="A3:F3"/>
  </mergeCells>
  <pageMargins left="0.35" right="0.35" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>
  <pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="${fitToHeightVal}"/>
</worksheet>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const safeSheetTitle = 'טופס הזמנת רכש';
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(safeSheetTitle)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const encoder = new TextEncoder();
  return createZipArchive(
    [
      { path: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
      { path: '_rels/.rels', data: encoder.encode(rootRelsXml) },
      { path: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
      { path: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
      { path: 'xl/styles.xml', data: encoder.encode(buildStylesXml()) },
      { path: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml) },
    ],
    now
  );
}

export function buildPurchaseOrderFilename(branchName?: string, now: Date = new Date()): string {
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cleanBranch = (branchName || 'StorePrint')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 28);
  return `הזמנת_רכש_${cleanBranch}_${datePart}.xlsx`;
}

export function downloadPurchaseOrderExcel(
  lines: PurchaseOrderExportLine[],
  meta: PurchaseOrderExportMetadata = {}
): string {
  const bytes = buildPurchaseOrderXlsxBytes(lines, meta);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = buildPurchaseOrderFilename(meta.branchName, meta.createdAt);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}

export function getSuggestedOrderQty(item: StockItem, effectiveThreshold: number): number {
  const safeQty = typeof item.currentStock === 'number' && !isNaN(item.currentStock) ? item.currentStock : 0;
  if (safeQty < effectiveThreshold) {
    return Math.max(1, effectiveThreshold - safeQty);
  }
  return 1;
}
