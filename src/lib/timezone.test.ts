import { describe, it, expect } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { isValidTimezone, normalizeTimezone, DEFAULT_TIMEZONE } from "./timezone";
import { timestampToDatetimeLocalAtTz, datetimeLocalToTimestampAtTz } from "./client/datetime";

/**
 * Incidents record the timezone their times were entered in, so a `datetime-local` value
 * means the same instant regardless of where the editor's browser is.
 *
 * Unlike maintenances there is no recurrence rule here, so these tests cover the
 * round-trip and the NULL-means-fallback semantics rather than DST drift of a series.
 */

const WARSAW = "Europe/Warsaw";
const LA = "America/Los_Angeles";

describe("normalizeTimezone", () => {
  it("accepts valid IANA timezones", () => {
    expect(normalizeTimezone(WARSAW)).toBe(WARSAW);
    expect(normalizeTimezone(LA)).toBe(LA);
    expect(normalizeTimezone("UTC")).toBe("UTC");
  });

  it("falls back to UTC by default", () => {
    expect(normalizeTimezone(null)).toBe(DEFAULT_TIMEZONE);
    expect(normalizeTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(normalizeTimezone("")).toBe(DEFAULT_TIMEZONE);
    expect(normalizeTimezone("Not/AZone")).toBe(DEFAULT_TIMEZONE);
  });

  it("honours an explicit fallback, which is how incidents treat a NULL timezone", () => {
    // An incident with no recorded timezone must keep rendering in the viewer's
    // timezone rather than silently switching to UTC.
    expect(normalizeTimezone(null, WARSAW)).toBe(WARSAW);
    expect(normalizeTimezone("", WARSAW)).toBe(WARSAW);
    expect(normalizeTimezone("Not/AZone", WARSAW)).toBe(WARSAW);
    // A recorded timezone still wins over the fallback.
    expect(normalizeTimezone(LA, WARSAW)).toBe(LA);
  });

  it("validates without throwing", () => {
    expect(isValidTimezone(WARSAW)).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
  });
});

describe("incident datetime round-trip", () => {
  it("resolves a wall-clock time against the incident's own timezone", () => {
    // 2026-10-26 14:00 in Warsaw is CET (UTC+1) -> 13:00 UTC
    const ts = datetimeLocalToTimestampAtTz("2026-10-26T14:00", WARSAW);
    expect(formatInTimeZone(new Date(ts * 1000), "UTC", "yyyy-MM-dd HH:mm")).toBe("2026-10-26 13:00");
  });

  it("maps the same wall clock to different instants in different timezones", () => {
    const warsaw = datetimeLocalToTimestampAtTz("2026-10-26T14:00", WARSAW);
    const la = datetimeLocalToTimestampAtTz("2026-10-26T14:00", LA);

    // Warsaw is CET (UTC+1), Los Angeles is still PDT (UTC-7) on this date.
    expect(la - warsaw).toBe(8 * 3600);
  });

  it("round-trips a timestamp back to the same wall clock", () => {
    for (const [tz, wallClock] of [
      [WARSAW, "2026-10-24T14:00"], // before the EU transition (CEST)
      [WARSAW, "2026-10-26T14:00"], // after the EU transition (CET)
      [LA, "2026-10-26T09:00"], // before the US transition (PDT)
      [LA, "2026-11-03T09:00"], // after the US transition (PST)
    ] as const) {
      const ts = datetimeLocalToTimestampAtTz(wallClock, tz);
      expect(timestampToDatetimeLocalAtTz(ts, tz)).toBe(wallClock);
    }
  });

  it("keeps the stored instant stable when the viewer's timezone changes", () => {
    // The incident timezone is what anchors the value; a viewer elsewhere must not
    // shift it. This is the regression behind "entered time != displayed time".
    const ts = datetimeLocalToTimestampAtTz("2026-10-26T14:00", WARSAW);

    expect(timestampToDatetimeLocalAtTz(ts, WARSAW)).toBe("2026-10-26T14:00");
    // Rendered elsewhere it is a different wall clock, but the same instant.
    expect(timestampToDatetimeLocalAtTz(ts, LA)).toBe("2026-10-26T06:00");
    expect(timestampToDatetimeLocalAtTz(ts, "UTC")).toBe("2026-10-26T13:00");
  });
});
