import { describe, expect, it } from "vitest";
import type { ScoredOpportunity, WeeklyPlan } from "../types";
import {
  buildWeeklyPlanChecklist,
  weeklyPlanChecklistFileName
} from "./plan-export";

const opportunity: ScoredOpportunity = {
  id: "offer-a",
  merchant: "Market A",
  title: "$10 off $20",
  summary: "Official test offer",
  category: "grocery",
  estimatedSavings: 10,
  minimumSpend: 20,
  isFree: false,
  expiresOn: "2026-08-31",
  locationNote: "Spring-area participation must be confirmed.",
  verification: "verified",
  friction: "low",
  tags: [],
  source: {
    label: "Official source",
    url: "https://example.com/offer",
    checkedOn: "2026-08-24"
  },
  actionLabel: "Review"
  ,
  score: 80,
  scoreLabel: "Strong",
  preferenceSignals: ["teen"],
  stackNote: "This offer cannot be combined with other promotions.",
  scoreBreakdown: [
    {
      label: "Household fit",
      points: 7,
      weight: 10,
      detail: "Household match: teen"
    }
  ]
};

const plan: WeeklyPlan = {
  trips: [
    {
      id: "market-a",
      merchant: "Market A",
      distanceMiles: 2,
      distanceConfirmed: true,
      hasUnconfirmedLocationDeal: false,
      hasUnconfirmedParticipationDeal: true,
      requiredSpend: 20,
      estimatedSavings: 10,
    calibratedSavings: 10,
    evidenceConfidence: 0.85,
    timingPriority: 1,
    riskAdjustedSavings: 8.5,
      estimatedTravelCost: 1.4,
      netBenefitAfterTravel: 7.1,
      averageScore: 80,
      utility: 80,
      warnings: ["Nearby store is confirmed; confirm promotion participation."],
      deals: [
        {
          opportunity,
          warnings: ["Nearby store is confirmed; confirm promotion participation."]
        }
      ]
    }
  ],
  selectedDeals: [],
  excluded: [],
  requiredSpend: 20,
  estimatedSavings: 10,
  calibratedSavings: 10,
  calibrationDelta: 0,
  evidenceConfidence: 0.85,
  timingPriority: 1,
  riskAdjustedSavings: 8.5,
  totalTravelCost: 1.4,
  valueEfficiency: 0.5,
  planningEfficiency: 0.61,
  estimatedNetCost: 10,
  netBenefitAfterTravel: 7.1,
  savingsRate: 50,
  constraintChecks: [],
  assumptions: ["Estimated values are planning aids."]
};

describe("weekly plan checklist export", () => {
  it("builds a private, actionable markdown checklist", () => {
    const markdown = buildWeeklyPlanChecklist(
      plan,
      new Date("2026-08-24T12:00:00")
    );

    expect(markdown).toContain("# Weekly savings action plan");
    expect(markdown).toContain("## Trip 1: Market A");
    expect(markdown).toContain("- [ ] $10 off $20 — $10 value; spend $20; ends Aug 31");
    expect(markdown).toContain("https://example.com/offer");
    expect(markdown).toContain("- Effort: Low");
    expect(markdown).toContain("- Source checked: Aug 24");
    expect(markdown).toContain("- Fit: Household match: teen");
    expect(markdown).toContain(
      "- Stack terms: Official terms restrict combining offers"
    );
    expect(markdown).toContain("- Confirm: Nearby store is confirmed");
    expect(markdown).toContain("- Estimated values are planning aids.");
  });

  it("uses a stable dated filename", () => {
    expect(
      weeklyPlanChecklistFileName(new Date("2026-08-24T12:00:00"))
    ).toBe("savings-action-plan-2026-08-24.md");
  });
});
