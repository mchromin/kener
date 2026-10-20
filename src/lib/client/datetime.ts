import { getUnixTime, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

/**
 * Get start of day timestamp for a given timezone
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Start of day in the given timezone as Unix timestamp (seconds)
 */
function getStartOfDayAtTz(timezone: string): number {
  const now = new Date();
  const zonedTime = toZonedTime(now, timezone);
  const startOfZonedDay = startOfDay(zonedTime);
  const startOfDayInUTC = fromZonedTime(startOfZonedDay, timezone);
  return getUnixTime(startOfDayInUTC);
}

/**
 * Get end of day timestamp for a given timezone
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns End of day in the given timezone as Unix timestamp (seconds)
 */
export function getEndOfDayAtTz(timezone: string): number {
  return getStartOfDayAtTz(timezone) + 86400;
}

/**
 * Calendar-day key ("yyyy-MM-dd") for a timestamp, resolved in the given timezone.
 *
 * Grouping by this string key (instead of a start-of-day timestamp derived from the
 * browser's own timezone) keeps day buckets consistent with how the timestamps are
 * rendered, which otherwise drifts by a day across timezone boundaries.
 *
 * @param ts - Unix timestamp in seconds
 * @param timezone - IANA timezone string
 */
export function getDayKeyAtTz(ts: number, timezone: string): string {
  return formatInTimeZone(new Date(ts * 1000), timezone, "yyyy-MM-dd");
}

/**
 * Convert a calendar-day key ("yyyy-MM-dd") back into the Unix timestamp (seconds)
 * of that day's midnight in the given timezone.
 *
 * @param dayKey - Calendar day in "yyyy-MM-dd" form
 * @param timezone - IANA timezone string
 */
export function dayKeyToTimestampAtTz(dayKey: string, timezone: string): number {
  return getUnixTime(fromZonedTime(`${dayKey}T00:00:00`, timezone));
}

/**
 * Format a Unix timestamp for an `<input type="datetime-local">` value, expressed in
 * the given timezone.
 *
 * `datetime-local` inputs are timezone-naive: the browser always renders and parses
 * them in the host machine's timezone. These helpers make the input honour the user's
 * selected timezone instead, so what is typed matches what is displayed elsewhere.
 *
 * @param ts - Unix timestamp in seconds
 * @param timezone - IANA timezone string
 * @returns A "yyyy-MM-ddTHH:mm" string
 */
export function timestampToDatetimeLocalAtTz(ts: number, timezone: string): string {
  return formatInTimeZone(new Date(ts * 1000), timezone, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse an `<input type="datetime-local">` value as wall-clock time in the given
 * timezone and convert it to a Unix timestamp (seconds).
 *
 * @param datetime - A "yyyy-MM-ddTHH:mm" string from a datetime-local input
 * @param timezone - IANA timezone string
 */
export function datetimeLocalToTimestampAtTz(datetime: string, timezone: string): number {
  if (!datetime) return Math.floor(Date.now() / 1000);
  const parsed = fromZonedTime(datetime, timezone);
  if (isNaN(parsed.getTime())) return Math.floor(Date.now() / 1000);
  return getUnixTime(parsed);
}

/**
 * Short timezone label (e.g. "GMT-8") for the given timezone, useful as a hint next to
 * timezone-naive inputs.
 *
 * @param timezone - IANA timezone string
 * @param ts - Optional reference timestamp in seconds (defaults to now) so the label
 *             reflects the DST offset in effect at that moment
 */
export function getTimezoneOffsetLabel(timezone: string, ts?: number): string {
  const reference = ts === undefined ? new Date() : new Date(ts * 1000);
  try {
    return formatInTimeZone(reference, timezone, "O");
  } catch {
    return "";
  }
}
