import { WeekRange } from '../types';

/**
 * Gets the start (Sunday) and end (Saturday) dates of the Israeli calendar week.
 */
export function getIsraelWeekRange(referenceDate: Date = new Date()): WeekRange {
  const current = new Date(referenceDate);
  const day = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate difference to Sunday (0)
  const diffToSunday = -day;

  const startDate = new Date(current);
  startDate.setDate(current.getDate() + diffToSunday);
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
    d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return {
    startDate,
    endDate,
    weekNumber,
    year: startDate.getFullYear(),
    formattedRange: `${formatDay(startDate)} — ${formatDay(endDate)}`,
  };
}

/**
 * Legacy get current week range (Sunday to Saturday)
 */
export function getCurrentWeekRange(referenceDate: Date = new Date()): WeekRange {
  return getIsraelWeekRange(referenceDate);
}

/**
 * Checks if a date falls on today (in local time)
 */
export function isDateToday(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/**
 * Checks if a date is within the last N days
 */
export function isDateInLastDays(date: Date | null, days: number = 7): boolean {
  if (!date) return false;
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return date.getTime() >= cutoff.getTime();
}

/**
 * Checks if a date is in the current month
 */
export function isDateInCurrentMonth(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

/**
 * Checks if a date falls within a custom from..to range
 */
export function isDateInCustomRange(
  date: Date | null,
  fromDateStr: string,
  toDateStr: string
): boolean {
  if (!date) return false;
  const time = date.getTime();

  if (fromDateStr) {
    const from = new Date(fromDateStr);
    from.setHours(0, 0, 0, 0);
    if (!isNaN(from.getTime()) && time < from.getTime()) {
      return false;
    }
  }

  if (toDateStr) {
    const to = new Date(toDateStr);
    to.setHours(23, 59, 59, 999);
    if (!isNaN(to.getTime()) && time > to.getTime()) {
      return false;
    }
  }

  return true;
}

/**
 * Parses various date formats commonly found in Google Sheets:
 * - DD/MM/YYYY HH:MM:SS or DD/MM/YYYY
 * - DD.MM.YYYY or DD.MM.YY
 * - YYYY-MM-DD
 * - Excel Serial Numbers (e.g., 45500)
 */
export function parseSheetDate(value: string | number | null | undefined): Date | null {
  if (!value) return null;

  if (
    typeof value === 'number' ||
    (!isNaN(Number(value)) &&
      !String(value).includes('.') &&
      !String(value).includes('-') &&
      !String(value).includes('/'))
  ) {
    const serial = Number(value);
    if (serial > 30000 && serial < 60000) {
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return isNaN(dateInfo.getTime()) ? null : dateInfo;
    }
  }

  const str = String(value).trim();
  if (!str) return null;

  // Slash format with time or without: DD/MM/YYYY [HH:MM:SS]
  const slashRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const slashMatch = str.match(slashRegex);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = slashMatch[4] ? parseInt(slashMatch[4], 10) : 12;
    const minutes = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    const seconds = slashMatch[6] ? parseInt(slashMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Dot format: DD.MM.YYYY [HH:MM:SS]
  const dotRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const dotMatch = str.match(dotRegex);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10) - 1;
    let year = parseInt(dotMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = dotMatch[4] ? parseInt(dotMatch[4], 10) : 12;
    const minutes = dotMatch[5] ? parseInt(dotMatch[5], 10) : 0;
    const seconds = dotMatch[6] ? parseInt(dotMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Dash format: YYYY-MM-DD
  const dashRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const dashMatch = str.match(dashRegex);
  if (dashMatch) {
    const year = parseInt(dashMatch[1], 10);
    const month = parseInt(dashMatch[2], 10) - 1;
    const day = parseInt(dashMatch[3], 10);
    const hours = dashMatch[4] ? parseInt(dashMatch[4], 10) : 12;
    const minutes = dashMatch[5] ? parseInt(dashMatch[5], 10) : 0;
    const seconds = dashMatch[6] ? parseInt(dashMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Checks if date is within a week range
 */
export function isDateInWeek(date: Date | null, weekRange: WeekRange): boolean {
  if (!date) return false;
  const time = date.getTime();
  return time >= weekRange.startDate.getTime() && time <= weekRange.endDate.getTime();
}

/**
 * Formats a date for display (Israeli format: DD/MM/YYYY)
 */
export function formatIsraelDate(date: Date | null, includeTime: boolean = false): string {
  if (!date) return '—';
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
