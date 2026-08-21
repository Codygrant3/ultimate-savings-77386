import { describe, expect, it } from "vitest";
import type { ScoredOpportunity } from "../types";
import {
  DEFAULT_VALUE_ALERT_SETTINGS,
  buildValueAlerts,
  normalizeValueAlertSettings
} from "./value-alerts";

const baseOpportunity: ScoredOpportunity = {
  id: "high-value",
  merchant: "Test",
  title: "$20 off",
  summary: "Test",
  category: "grocery",
  estimatedSavings: 20,
  minimumSpend: 20,
  isFree: false,
  locationNote: "77386",
  verification: "verified",
  friction: "low",
  tags: [],
  source: { label: "Official", url: "https://example.com", checkedOn: "2026-08-20" },
  actionLabel: "Review",
  score: 80,
  scoreLabel: "Strong",
  scoreBreakdown: []
};

describe("value threshold alerts", () => {
  it("normalizes invalid settings to safe defaults", () => {
    const settings = normalizeValueAlertSettings({
      minimumValue: Number.NaN,
      includeFreeRewards: undefined,
      maximumFriction: "extreme" as never
    });

    expect(settings).toEqual(DEFAULT_VALUE_ALERT_SETTINGS);
  });

  it("includes dollar offers at or above the user threshold", () => {
    const alerts = buildValueAlerts(
      [baseOpportunity, { ...baseOpportunity, id: "low", estimatedSavings: 5 }],
      { ...DEFAULT_VALUE_ALERT_SETTINGS, includeFreeRewards: false },
      []
    );

    expect(alerts.map(({ id }) => id)).toEqual(["high-value"]);
    expect(alerts[0].reason).toContain("$20 clears the $10 threshold");
  });

  it("optionally includes free rewards even when dollar value is unknown", () => {
    const freeOffer = {
      ...baseOpportunity,
      id: "free",
      estimatedSavings: 0,
      isFree: true
    };
    const included = buildValueAlerts(
      [freeOffer],
      { ...DEFAULT_VALUE_ALERT_SETTINGS, includeFreeRewards: true },
      []
    );
    const excluded = buildValueAlerts(
      [freeOffer],
      { ...DEFAULT_VALUE_ALERT_SETTINGS, includeFreeRewards: false },
      []
    );

    expect(included[0].reason).toBe("Included free reward");
    expect(excluded).toHaveLength(0);
  });

  it("honors maximum effort and acknowledged offers", () => {
    const highEffort = { ...baseOpportunity, id: "hard", friction: "high" as const };
    const alerts = buildValueAlerts(
      [highEffort],
      DEFAULT_VALUE_ALERT_SETTINGS,
      []
    );
    const acknowledged = buildValueAlerts(
      [baseOpportunity],
      DEFAULT_VALUE_ALERT_SETTINGS,
      ["high-value"]
    );

    expect(alerts).toHaveLength(0);
    expect(acknowledged).toHaveLength(0);
  });
});
