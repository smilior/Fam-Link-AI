import * as HolidayJP from "@holiday-jp/holiday_jp";

/**
 * Returns a Map from day-of-month (1-31) to holiday name
 * for the given year/month.
 */
export function getHolidayMap(year: number, month: number): Map<number, string> {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0); // last day of month
  const holidays = HolidayJP.between(start, end);
  const map = new Map<number, string>();
  for (const h of holidays) {
    // h.date is UTC midnight — use getUTCDate() to avoid timezone shift
    const dom = h.date.getUTCDate();
    map.set(dom, h.name);
  }
  return map;
}
