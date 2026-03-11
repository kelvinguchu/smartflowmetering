/**
 * Pure timezone date utilities — no DB or queue imports.
 */

export function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getPreviousDateInTimezone(timezone: string): string {
  const yesterday = new Date(Date.now() - 86_400_000);
  return formatDateInTimezone(yesterday, timezone);
}

export function getDateBoundsInTimezone(
  dateStr: string,
  timezone: string,
): { dayStart: Date; dayEnd: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Probe UTC midnight of the target date
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // Format that instant in the target timezone to get local date/time parts
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(utcMidnight);

  const localYear = Number(parts.find((p) => p.type === "year")?.value);
  const localMonth = Number(parts.find((p) => p.type === "month")?.value);
  const localDay = Number(parts.find((p) => p.type === "day")?.value);
  const localHour = Number(parts.find((p) => p.type === "hour")?.value);
  const localMinute = Number(parts.find((p) => p.type === "minute")?.value);

  // Reconstruct what UTC time corresponds to this local time
  const localAsUtc = Date.UTC(
    localYear,
    localMonth - 1,
    localDay,
    localHour,
    localMinute,
    0,
  );
  // offsetMs = localAsUtc - utcMidnight.getTime() tells us the timezone offset
  const offsetMs = localAsUtc - utcMidnight.getTime();

  // Midnight of the target date in the timezone = UTC midnight minus the offset
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000 - 1);
  return { dayStart, dayEnd };
}
