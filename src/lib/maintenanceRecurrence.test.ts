import { describe, it, expect } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { getNextOccurrences, getOccurrencesBetween, normalizeTimezone } from "./maintenanceRecurrence";

/**
 * Regression tests for the "off by an hour" bug: recurring maintenances were anchored to
 * UTC, so their local wall-clock time drifted across daylight saving transitions.
 */

const LA = "America/Los_Angeles";
const WARSAW = "Europe/Warsaw";

function wallClock(ts: number, tz: string): string {
  return formatInTimeZone(new Date(ts * 1000), tz, "yyyy-MM-dd HH:mm");
}

/** 2026-10-19 18:00 in Los Angeles (PDT, UTC-7) -> 2026-10-20T01:00:00Z */
const LA_START = Math.floor(Date.UTC(2026, 9, 20, 1, 0, 0) / 1000);

describe("maintenanceRecurrence", () => {
  it("keeps the local wall-clock time across a DST transition (US)", () => {
    // US leaves DST on 2026-11-01, so occurrences after that date are at a different
    // UTC offset but must stay at 18:00 local.
    const occurrences = getOccurrencesBetween(
      LA_START,
      "FREQ=WEEKLY;BYDAY=MO",
      LA,
      new Date(Date.UTC(2026, 9, 19)),
      new Date(Date.UTC(2026, 10, 30)),
    );

    expect(occurrences.length).toBeGreaterThan(3);
    for (const ts of occurrences) {
      expect(wallClock(ts, LA).slice(11)).toBe("18:00");
    }
  });

  it("produces a different UTC offset before and after the transition", () => {
    const occurrences = getOccurrencesBetween(
      LA_START,
      "FREQ=WEEKLY;BYDAY=MO",
      LA,
      new Date(Date.UTC(2026, 9, 19)),
      new Date(Date.UTC(2026, 10, 30)),
    );

    const before = occurrences.find((ts) => ts < Date.UTC(2026, 10, 1) / 1000)!;
    const after = occurrences.find((ts) => ts > Date.UTC(2026, 10, 2) / 1000)!;

    // PDT (UTC-7) -> 01:00Z, PST (UTC-8) -> 02:00Z
    expect(formatInTimeZone(new Date(before * 1000), "UTC", "HH:mm")).toBe("01:00");
    expect(formatInTimeZone(new Date(after * 1000), "UTC", "HH:mm")).toBe("02:00");
  });

  it("keeps the local wall-clock time across a DST transition (Europe)", () => {
    // 2026-10-20 18:00 Warsaw (CEST, UTC+2); Poland leaves DST on 2026-10-25.
    const start = Math.floor(Date.UTC(2026, 9, 20, 16, 0, 0) / 1000);

    const occurrences = getOccurrencesBetween(
      start,
      "FREQ=DAILY",
      WARSAW,
      new Date(Date.UTC(2026, 9, 20)),
      new Date(Date.UTC(2026, 9, 31)),
    );

    for (const ts of occurrences) {
      expect(wallClock(ts, WARSAW).slice(11)).toBe("18:00");
    }
  });

  it("preserves the legacy UTC-anchored behaviour when timezone is UTC", () => {
    const occurrences = getOccurrencesBetween(
      LA_START,
      "FREQ=WEEKLY;BYDAY=MO",
      "UTC",
      new Date(Date.UTC(2026, 9, 19)),
      new Date(Date.UTC(2026, 10, 30)),
    );

    for (const ts of occurrences) {
      expect(formatInTimeZone(new Date(ts * 1000), "UTC", "HH:mm")).toBe("01:00");
    }
  });

  it("returns the requested number of upcoming occurrences", () => {
    const next = getNextOccurrences(LA_START, "FREQ=WEEKLY;BYDAY=MO", LA, new Date(Date.UTC(2026, 9, 19)), 5);

    expect(next).toHaveLength(5);
    expect([...next].sort((a, b) => a - b)).toEqual(next);
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(normalizeTimezone("Not/AZone")).toBe("UTC");
    expect(normalizeTimezone(null)).toBe("UTC");
    expect(normalizeTimezone(LA)).toBe(LA);
  });
});
