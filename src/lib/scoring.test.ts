import { describe, expect, it } from "vitest";
import type { Opportunity } from "../types";
import {
  isExcludedByPreferences,
  isExpired,
  rankOpportunities,
  scoreOpportunity,
  startOfWeek
} from "./scoring";

const baseOpportunity: Opportunity = {
  id: "test",
  merchant: "Test",
  title: "Test deal",
  summary: "Test summary",
  category: "grocery",
  estimatedSavings: 10,
  minimumSpend: 20,
  savingsRate: 50,
  isFree: false,
  expiresOn: "2026-07-28",
  locationNote: "Test location",
  verification: "verified",
  friction: "low",
  tags: [],
  source: {
    label: "Official source",
    url: "https://example.com",
    checkedOn: "2026-07-23"
  },
  actionLabel: "Review"
};

describe("savings scoring", () => {
  it("rewards verified offers over unverified leads", () => {
    const today = new Date("2026-07-23T12:00:00");
    const verified = scoreOpportunity(baseOpportunity, today);
    const unverified = scoreOpportunity(
      { ...baseOpportunity, id: "lead", verification: "needs-check" },
      today
    );

    expect(verified.score).toBeGreaterThan(unverified.score);
  });

  it("filters expired offers before ranking", () => {
    const today = new Date("2026-07-23T12:00:00");
    const expired = { ...baseOpportunity, id: "expired", expiresOn: "2026-07-22" };

    expect(isExpired(expired, today)).toBe(true);
    expect(rankOpportunities([expired], today)).toHaveLength(0);
  });

  it("uses Monday as the weekly report boundary", () => {
    expect(startOfWeek(new Date("2026-07-23T12:00:00")).toISOString().slice(0, 10)).toBe(
      "2026-07-20"
    );
  });

  it("prioritizes grocery savings over an otherwise identical fuel offer", () => {
    const today = new Date("2026-07-23T12:00:00");
    const lowerValueOffer = {
      ...baseOpportunity,
      estimatedSavings: 2,
      minimumSpend: 20,
      savingsRate: 10,
      verification: "program" as const,
      friction: "medium" as const,
      expiresOn: undefined
    };
    const grocery = scoreOpportunity(lowerValueOffer, today);
    const fuel = scoreOpportunity(
      { ...lowerValueOffer, id: "fuel", category: "fuel" },
      today
    );

    expect(grocery.score).toBeGreaterThan(fuel.score);
  });

  it("excludes baby and infant offers from the household feed", () => {
    const babyOffer = {
      ...baseOpportunity,
      id: "heb-baby-essentials",
      merchant: "H-E-B",
      title: "$10 off baby essentials",
      summary: "Stock up on infant supplies.",
      tags: ["digital coupon"],
      preferenceSignals: ["baby essentials"]
    };

    expect(isExcludedByPreferences(babyOffer)).toBe(true);
    expect(rankOpportunities([babyOffer], new Date("2026-07-23T12:00:00"))).toHaveLength(0);
  });

  it("prioritizes teen back-to-school needs over generic shopping offers", () => {
    const today = new Date("2026-07-23T12:00:00");
    const genericShopping = {
      ...baseOpportunity,
      id: "generic-shopping",
      category: "shopping" as const,
      title: "General merchandise offer",
      estimatedSavings: 2,
      minimumSpend: 20,
      savingsRate: 10,
      verification: "program" as const,
      friction: "medium" as const,
      expiresOn: undefined,
      tags: ["shopping"]
    };
    const teenSchoolOffer = {
      ...genericShopping,
      id: "teen-school",
      title: "Back-to-school savings for a 14-year-old",
      tags: ["teen clothing", "school shoes", "student backpack"],
      preferenceSignals: ["teen", "back-to-school", "school supplies"]
    };

    expect(scoreOpportunity(teenSchoolOffer, today).score).toBeGreaterThan(
      scoreOpportunity(genericShopping, today).score
    );
    expect(rankOpportunities([genericShopping, teenSchoolOffer], today)[0].id).toBe(
      "teen-school"
    );
  });

  it("uses proximity as a ranking criterion", () => {
    const today = new Date("2026-07-23T12:00:00");
    const nearby = scoreOpportunity(
      { ...baseOpportunity, id: "nearby", distanceMiles: 2 },
      today
    );
    const distant = scoreOpportunity(
      { ...baseOpportunity, id: "distant", distanceMiles: 25 },
      today
    );

    expect(nearby.score).toBeGreaterThan(distant.score);
    expect(nearby.scoreBreakdown.find(({ label }) => label === "Local relevance")?.detail).toBe(
      "2 miles from 77386"
    );
  });

  it("penalizes stale source evidence", () => {
    const today = new Date("2026-07-23T12:00:00");
    const fresh = scoreOpportunity(baseOpportunity, today);
    const stale = scoreOpportunity(
      {
        ...baseOpportunity,
        id: "stale",
        source: { ...baseOpportunity.source, checkedOn: "2026-06-01" }
      },
      today
    );

    expect(stale.score).toBeLessThan(fresh.score);
    expect(stale.scoreBreakdown[0].detail).toContain("checked 52 days ago");
  });

  it("rewards a documented compatible stack without saturating the total score", () => {
    const today = new Date("2026-07-23T12:00:00");
    const stacked = scoreOpportunity(
      { ...baseOpportunity, id: "stacked", stackNote: "Digital coupon plus loyalty" },
      today
    );
    const unstacked = scoreOpportunity(
      { ...baseOpportunity, id: "unstacked" },
      today
    );

    expect(stacked.score).toBeGreaterThan(unstacked.score);
    expect(stacked.scoreBreakdown).toHaveLength(9);
    expect(stacked.scoreBreakdown.reduce((total, factor) => total + factor.weight, 0)).toBe(100);
    expect(stacked.score).toBeLessThan(100);
  });
});
