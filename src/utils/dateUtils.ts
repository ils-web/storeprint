import { WeekRange } from '../types';

/**
 * Gets the start (Monday) and end (Sunday) dates of the current calendar week.
 */
export function getCurrentWeekRange(referenceDate: Date = new Date()): WeekRange {
  const current = new Date(referenceDate);
  // Get current day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const day = current.getDay();
  // Calculate difference to Monday
  const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);

  const startDate = new Date(current);
  startDate.setDate(diffToMonday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  // ISO Week Number
  const tempDate = new Date(startDate);
  tempDate.setDate(tempDate.getDate() + 3);
  const firstThursday = tempDate.valueOf();
  tempDate.setMonth(0, 1);
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.round((firstThursday - tempDate.valueOf()) / 604800000);

  const formatDay = (d: Date) =>
    d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return {
    startDate,
    endDate,
    weekNumber,
    year: startDate.getFullYear(),
    formattedRange: `${formatDay(startDate)} — ${formatDay(endDate)}`,
  };
}

/**
 * Parses various date formats commonly found in Google Sheets:
 * - DD.MM.YYYY or DD.MM.YY
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - Excel Serial Numbers (e.g., 45500)
 * - ISO String timestamps
 */
export function parseSheetDate(value: string | number | null | undefined): Date | null {
  if (!value) return null;

  // Handle Excel serial date numbers (e.g., 45000 -> date)
  if (typeof value === 'number' || (!isNaN(Number(value)) && !String(value).includes('.') && !String(value).includes('-') && !String(value).includes('/'))) {
    const serial = Number(value);
    if (serial > 30000 && serial < 60000) {
      // Excel epoch starts Dec 30 1899
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return isNaN(dateInfo.getTime()) ? null : dateInfo;
    }
  }

  const str = String(value).trim();
  if (!str) return null;

  // DD.MM.YYYY or DD.MM.YY format (e.g. 12.08.2026, 12.8.26)
  const dotRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/;
  const dotMatch = str.match(dotRegex);
  if (dotMatch) {
    let day = parseInt(dotMatch[1], 10);
    let month = parseInt(dotMatch[2], 10) - 1;
    let year = parseInt(dotMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = dotMatch[4] ? parseInt(dotMatch[4], 10) : 12;
    const minutes = dotMatch[5] ? parseInt(dotMatch[5], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // YYYY-MM-DD format (e.g. 2026-08-12)
  const dashRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?$/;
  const dashMatch = str.match(dashRegex);
  if (dashMatch) {
    const year = parseInt(dashMatch[1], 10);
    const month = parseInt(dashMatch[2], 10) - 1;
    const day = parseInt(dashMatch[3], 10);
    const hours = dashMatch[4] ? parseInt(dashMatch[4], 10) : 12;
    const minutes = dashMatch[5] ? parseInt(dashMatch[5], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Slash format DD/MM/YYYY or MM/DD/YYYY
  const slashRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const slashMatch = str.match(slashRegex);
  if (slashMatch) {
    let p1 = parseInt(slashMatch[1], 10);
    let p2 = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    // Assume DD/MM/YYYY for Russian context if p1 <= 31 and p2 <= 12
    const day = p1;
    const month = p2 - 1;
    const parsed = new Date(year, month, day, 12, 0);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback standard Date.parse
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

/**
 * Strictly verifies whether a date falls within the specified week range.
 */
export function isDateInWeek(date: Date | null, weekRange: WeekRange): boolean {
  if (!date) return false;
  const time = date.getTime();
  return time >= weekRange.startDate.getTime() && time <= weekRange.endDate.getTime();
}

/**
 * Formats a date for Russian display
 */
export function formatRuDate(date: Date | null, includeTime: boolean = false): string {
  if (!date) return '—';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
