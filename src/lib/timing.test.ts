import { describe, expect, it } from "vitest";
import {
  formatRedemptionWindows,
  isValidRedemptionWindows,
  parseTimeOfDay,
  redemptionTimingWarnings
} from "./timing";

describe("official redemption timing", () => {
  it("validates bounded and open-ended clock evidence", () => {
    expect(isValidRedemptionWindows(undefined)).toBe(true);
    expect(
      isValidRedemptionWindows([{ startTime: "17:00", endTime: "22:00" }])
    ).toBe(true);
    expect(isValidRedemptionWindows([{ startTime: "15:00" }])).toBe(true);
    expect(
      isValidRedemptionWindows([{ startTime: "18:00", endTime: "17:00" }])
    ).toBe(false);
    expect(isValidRedemptionWindows([{ startTime: "24:00" }])).toBe(false);
    expect(parseTimeOfDay("15:05")).toBe(905);
    expect(parseTimeOfDay("bad")).toBeNull();
  });

  it("reports active, upcoming, and ended windows deterministically", () => {
    const windows = [{ startTime: "15:00", endTime: "18:00" }];

    expect(redemptionTimingWarnings(windows, new Date("2026-08-25T16:30:00"))).toEqual([
      "An official redemption window is active now."
    ]);
    expect(redemptionTimingWarnings(windows, new Date("2026-08-25T13:00:00"))).toEqual([
      "Official redemption starts at 3:00 PM; confirm before traveling."
    ]);
    expect(redemptionTimingWarnings(windows, new Date("2026-08-25T19:00:00"))).toEqual([
      "No official redemption window is active now."
    ]);
  });

  it("formats captured windows for stable user-facing disclosure", () => {
    expect(
      formatRedemptionWindows([
        { startTime: "17:00", endTime: "22:00" },
        { startTime: "15:00" }
      ])
    ).toBe("5:00 PM-10:00 PM, after 3:00 PM");
  });
});
