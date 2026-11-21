import { format, parseISO } from "date-fns";

/**
 * Wall-clock helpers. A reminder time is a time on the user's clock (their Settings zone), which can
 * differ from the browser's. These Dates carry that clock's fields (year … minute) and are used only
 * for arithmetic and display; they are sent as "YYYY-MM-DDTHH:mm" plus the zone, and the server turns
 * them into an instant (handling daylight-saving changes).
 */

/** The current time on `timeZone`'s clock. */
export function wallClockNow(nowMs: number, timeZone: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(nowMs))
      .map((p) => [p.type, p.value]),
  );
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
}

export function localString(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

/** "Sat 21 Nov, 10:00" (plus the zone when it isn't the user's current one). */
export function formatWallTime(local: string, zone: string, userZone?: string, pattern = "EEE d MMM, HH:mm"): string {
  const label = format(parseISO(local), pattern);
  return userZone && zone !== userZone ? `${label} (${zone})` : label;
}
