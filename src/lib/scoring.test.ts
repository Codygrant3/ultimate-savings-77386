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
      id: "baby",
      title: "Baby essentials coupon",
      tags: ["infant"]
    };

    expect(isExcludedByPreferences(babyOffer)).toBe(true);
    expect(rankOpportunities([babyOffer], new Date("2026-07-23T12:00:00"))).toHaveLength(0);
  });
});
