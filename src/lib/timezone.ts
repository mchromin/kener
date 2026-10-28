/**
 * Shared timezone helpers.
 *
 * All timestamps in Kener are stored as absolute UTC seconds. A timezone is only ever a
 * *presentation* concern — except for recurrence rules, where it also carries meaning for
 * how occurrences are expanded (see `maintenanceRecurrence.ts`).
 *
 * Both maintenances and incidents record the timezone their times were entered in, so the
 * admin UI can render and parse them consistently regardless of where the editor happens
 * to be, or what the viewer's own timezone preference is set to.
 */

export const DEFAULT_TIMEZONE = "UTC";

/**
 * Whether the given string is an IANA timezone this runtime understands.
 */
export function isValidTimezone(timezone: string | null | undefined): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an IANA timezone, falling back to `fallback` when missing or unknown.
 *
 * Unknown values are coerced rather than rejected: a bad timezone should never make an
 * existing record unreadable, and the fallback reproduces the pre-timezone behaviour.
 */
export function normalizeTimezone(timezone: string | null | undefined, fallback: string = DEFAULT_TIMEZONE): string {
  return isValidTimezone(timezone) ? (timezone as string) : fallback;
}
