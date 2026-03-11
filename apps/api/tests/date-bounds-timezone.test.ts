import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDateBoundsInTimezone } from "../src/lib/timezone-dates";

describe("getDateBoundsInTimezone", () => {
  it("Africa/Nairobi (UTC+3): dayStart is previous day 21:00 UTC", () => {
    const { dayStart, dayEnd } = getDateBoundsInTimezone(
      "2025-01-10",
      "Africa/Nairobi",
    );
    assert.equal(dayStart.toISOString(), "2025-01-09T21:00:00.000Z");
    assert.equal(dayEnd.getTime(), dayStart.getTime() + 24 * 3_600_000 - 1);
  });

  it("UTC: dayStart equals the date itself at 00:00 UTC (hour-24 regression)", () => {
    const { dayStart, dayEnd } = getDateBoundsInTimezone("2025-01-10", "UTC");
    assert.equal(dayStart.toISOString(), "2025-01-10T00:00:00.000Z");
    assert.equal(dayEnd.getTime(), dayStart.getTime() + 24 * 3_600_000 - 1);
  });

  it("America/New_York (UTC-5 in winter): dayStart is 05:00 UTC", () => {
    const { dayStart, dayEnd } = getDateBoundsInTimezone(
      "2025-01-10",
      "America/New_York",
    );
    assert.equal(dayStart.toISOString(), "2025-01-10T05:00:00.000Z");
    assert.equal(dayEnd.getTime(), dayStart.getTime() + 24 * 3_600_000 - 1);
  });

  it("dayEnd is always dayStart + 24h - 1ms", () => {
    const timezones = [
      "Africa/Nairobi",
      "UTC",
      "America/New_York",
      "Asia/Kolkata",
      "Pacific/Auckland",
    ];
    for (const tz of timezones) {
      const { dayStart, dayEnd } = getDateBoundsInTimezone("2025-06-15", tz);
      assert.equal(
        dayEnd.getTime() - dayStart.getTime(),
        24 * 3_600_000 - 1,
        `dayEnd - dayStart should be 24h-1ms for ${tz}`,
      );
    }
  });

  it("handles month boundary (e.g., March 1st) correctly", () => {
    const { dayStart } = getDateBoundsInTimezone(
      "2025-03-01",
      "Africa/Nairobi",
    );
    assert.equal(dayStart.toISOString(), "2025-02-28T21:00:00.000Z");
  });

  it("Europe/London in winter (UTC+0) does not hit the hour-24 bug", () => {
    const { dayStart } = getDateBoundsInTimezone("2025-01-10", "Europe/London");
    assert.equal(dayStart.toISOString(), "2025-01-10T00:00:00.000Z");
  });
});
