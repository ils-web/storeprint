import { StockItem } from '../types';

export function categorizeItem(name: string): { group: number; subOrder: number; groupName: string } {
  const n = (name || '').trim();

  // 1. כפפות ניטרל (Nitrile gloves) - Top priority
  if (n.startsWith('כפפות ניטרל')) {
    let sub = 0;
    if (n.includes(' S')) sub = 1;
    else if (n.includes(' M')) sub = 2;
    else if (n.includes(' L')) sub = 3;
    else if (n.includes(' XL')) sub = 4;
    return { group: 1, subOrder: sub, groupName: 'כפפות ניטרל' };
  }

  // 2. כפפות כירורגיות סטריליות (Surgical gloves)
  if (n.includes('כפפות כירורגיות')) {
    const size = parseFloat(n.replace(/[^\d.]/g, '')) || 0;
    return { group: 2, subOrder: size, groupName: 'כפפות כירורגיות סטריליות' };
  }

  // 3. מיגון ובידוד (PPE & Isolation)
  if (
    n.includes('בידוד') ||
    (n.includes('חלוק') && !n.includes('חלוקת')) ||
    n.includes('מסכה כירורגית') ||
    n.includes('מסכה רגילה') ||
    n.includes('סינר ניילון')
  ) {
    return { group: 3, subOrder: 0, groupName: 'מיגון ובידוד' };
  }

  // 4. מזרקים (Syringes)
  if (n.includes('מזרק')) {
    const size = parseFloat(n.replace(/[^\d.]/g, '')) || 0;
    return { group: 4, subOrder: size, groupName: 'מזרקים' };
  }

  // 5. מחטים, ונפלונים, פרפרים (Needles, Cannulas, Butterflies)
  if (
    n.includes('מחט') ||
    n.includes('ונפלון') ||
    n.includes('פרפר') ||
    n.includes('הולדר') ||
    n.includes('vaktener') ||
    n.includes('וואקו')
  ) {
    return { group: 5, subOrder: 0, groupName: 'מחטים ודגימות' };
  }

  // 6. חבישות, פדים, אגדים ופלסטרים (Wound care, Gauze, Bandages)
  if (
    n.includes('גזה') ||
    n.includes('אגד') ||
    n.includes('תחבושת') ||
    n.includes('פד') ||
    n.includes('פלסטר') ||
    n.includes('kerllix') ||
    n.includes('Kerllix') ||
    n.includes('tagaderm') ||
    n.includes('fubupore') ||
    n.includes('profix') ||
    n.includes('adesive') ||
    n.includes('סטרי סטריפ') ||
    n.includes('סטוקינט') ||
    n.includes('רשת חבישה')
  ) {
    return { group: 6, subOrder: 0, groupName: 'חבישות וטיפול בפצעים' };
  }

  // 7. קנולות טרכאוסטומיה, הנשמה ושאיבה (Tracheostomy & Respiratory)
  if (
    n.includes('CANOLA') ||
    n.includes('קנולה') ||
    n.includes('טרכאוסטומי') ||
    n.includes('אמבו') ||
    n.includes('אינהלציה') ||
    n.includes('חמצן') ||
    n.includes('SPEACH') ||
    n.includes('CIRRUS') ||
    n.includes('CANISTER') ||
    n.includes('סקשיין')
  ) {
    return { group: 7, subOrder: 0, groupName: 'טרכאוסטומיה, הנשמה ושאיבה' };
  }

  // 8. עירוי, צנתרים וניקוז שתן (Infusion & Urinary Catheters)
  if (
    n.includes('עירוי') ||
    n.includes('פוליקטטר') ||
    n.includes('שתן') ||
    n.includes('ברזל כחול') ||
    n.includes('מאריך') ||
    n.includes('פנרוס')
  ) {
    return { group: 8, subOrder: 0, groupName: 'עירוי וצנתור' };
  }

  // 9. חלוקת תרופות וכללי (Medication cups, wipes, general)
  if (
    n.includes('כוסיות') ||
    n.includes('מגבונים') ||
    n.includes('צמיד') ||
    n.includes('סכין') ||
    n.includes('שק לנפטר') ||
    n.includes('אלכוהול') ||
    n.includes('ממחטות') ||
    n.includes('אפליקטור') ||
    n.includes('מטושים')
  ) {
    return { group: 9, subOrder: 0, groupName: 'תרופות, חיטוי וכללי' };
  }

  return { group: 10, subOrder: 0, groupName: 'פריטים נוספים' };
}

/**
 * Organizes a stock dictionary logically into grouped categories:
 * - Active items first by medical specialty, size, and Hebrew name
 * - Frozen items strictly at the bottom
 * - Strips phantom placeholders ('פריט X')
 * - Assigns clean consecutive colIndex (4..N)
 */
export function organizeStockLogically(stock: Record<string, StockItem>): Record<string, StockItem> {
  const items = Object.values(stock || {}).filter(
    (it) => it && it.name && !it.name.startsWith('פריט ') && !it.name.startsWith('item ')
  );

  const active = items.filter((it) => it.isActive !== false);
  const frozen = items.filter((it) => it.isActive === false);

  active.sort((a, b) => {
    const catA = categorizeItem(a.name);
    const catB = categorizeItem(b.name);
    if (catA.group !== catB.group) return catA.group - catB.group;
    if (catA.subOrder !== catB.subOrder) return catA.subOrder - catB.subOrder;
    return a.name.localeCompare(b.name, 'he');
  });

  frozen.sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const reordered = [...active, ...frozen];
  const next: Record<string, StockItem> = {};
  const nowIso = new Date().toISOString();

  reordered.forEach((it, idx) => {
    next[it.name] = {
      ...it,
      colIndex: idx + 4,
      lastUpdated: nowIso,
    };
  });

  return next;
}
