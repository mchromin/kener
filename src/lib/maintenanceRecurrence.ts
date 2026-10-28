import { rrulestr } from "rrule";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE, normalizeTimezone } from "./timezone.js";

/**
 * Timezone-aware expansion of maintenance recurrence rules.
 *
 * Shared between the server (event generation, projection) and the admin UI
 * (occurrence preview) so both produce identical results.
 *
 * Maintenance windows are stored as absolute UTC timestamps, but a recurrence rule is
 * only meaningful relative to a timezone: "every Monday at 18:00 in Los Angeles" is a
 * different instant before and after a daylight saving transition.
 *
 * Previously occurrences were expanded with `DTSTART:<utc>Z`, which anchors the series
 * to UTC and makes the local wall-clock time drift by an hour across DST boundaries.
 *
 * `rrule` only honours `DTSTART;TZID=` when `luxon` is installed, which this project
 * does not depend on. Instead we expand the rule in "floating" space — a Date whose UTC
 * fields carry the wall-clock time — and convert every occurrence back to a real instant
 * using the offset in effect on that particular day. This yields a stable wall-clock
 * time across DST transitions without an extra dependency.
 */

export const DEFAULT_MAINTENANCE_TIMEZONE = DEFAULT_TIMEZONE;

/**
 * Re-exported from the shared timezone module so existing imports keep working.
 * Existing rows (and any bad input) therefore keep the previous UTC-anchored behaviour
 * rather than throwing at expansion time.
 */
export { normalizeTimezone };

/** Real instant -> floating Date whose UTC fields hold the wall-clock time in `timezone`. */
function toFloating(instant: Date, timezone: string): Date {
  return new Date(`${formatInTimeZone(instant, timezone, "yyyy-MM-dd'T'HH:mm:ss")}Z`);
}

/** Floating Date (UTC fields = wall clock) -> real instant in `timezone`. */
function fromFloating(floating: Date, timezone: string): Date {
  // "yyyy-MM-ddTHH:mm:ss" — fromZonedTime resolves it against the offset active that day.
  const wallClock = floating.toISOString().slice(0, 19);
  return fromZonedTime(wallClock, timezone);
}

/** Build an rrule instance anchored to the wall-clock start time. */
function buildRule(startDateTime: number, rrule: string, timezone: string) {
  const floatingStart = toFloating(new Date(startDateTime * 1000), timezone);
  const dtstart = `${floatingStart.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  return rrulestr(`DTSTART:${dtstart}\nRRULE:${rrule}`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Expand occurrences that start within [rangeStart, rangeEnd].
 *
 * @returns Unix timestamps (seconds), ascending
 */
export function getOccurrencesBetween(
  startDateTime: number,
  rrule: string,
  timezone: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
): number[] {
  const tz = normalizeTimezone(timezone);
  const rule = buildRule(startDateTime, rrule, tz);

  // Widen the floating window by a day on each side: the instant->wall-clock mapping
  // shifts by the UTC offset, so a naive conversion of the bounds could clip an
  // occurrence sitting near the edge. Exact filtering happens on real timestamps below.
  const from = new Date(toFloating(rangeStart, tz).getTime() - DAY_MS);
  const to = new Date(toFloating(rangeEnd, tz).getTime() + DAY_MS);

  const startSec = Math.floor(rangeStart.getTime() / 1000);
  const endSec = Math.floor(rangeEnd.getTime() / 1000);

  return rule
    .between(from, to, true)
    .map((occurrence) => Math.floor(fromFloating(occurrence, tz).getTime() / 1000))
    .filter((ts) => ts >= startSec && ts <= endSec)
    .sort((a, b) => a - b);
}

/**
 * Expand the next `count` occurrences at or after `from`.
 *
 * @returns Unix timestamps (seconds), ascending
 */
export function getNextOccurrences(
  startDateTime: number,
  rrule: string,
  timezone: string | null | undefined,
  from: Date,
  count: number,
): number[] {
  const tz = normalizeTimezone(timezone);
  const rule = buildRule(startDateTime, rrule, tz);

  const results: number[] = [];
  let cursor = new Date(toFloating(from, tz).getTime() - DAY_MS);
  const fromSec = Math.floor(from.getTime() / 1000);

  // Guard against pathological rules yielding nothing usable.
  for (let i = 0; i < count * 4 && results.length < count; i++) {
    const next = rule.after(cursor, i === 0);
    if (!next) break;
    cursor = next;

    const ts = Math.floor(fromFloating(next, tz).getTime() / 1000);
    if (ts >= fromSec) results.push(ts);
  }

  return results.sort((a, b) => a - b);
}
