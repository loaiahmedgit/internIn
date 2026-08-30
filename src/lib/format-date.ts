/** yyyy-mm-dd for a native `<input type="date">`, in the browser's local time. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "Aug 30, 2026" — per Intl, never a hardcoded format. */
export function formatDeadline(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function calendarDayInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value("year"), value("month") - 1, value("day"));
}

/** "Today" / "Yesterday" / "Aug 28" in the workspace timezone, identical during SSR and hydration. */
export function formatRecentDate(date: Date, now = new Date(), timeZone = "Asia/Qatar"): string {
  const daysAgo = Math.round((calendarDayInTimeZone(now, timeZone) - calendarDayInTimeZone(date, timeZone)) / 86400000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(date);
}
