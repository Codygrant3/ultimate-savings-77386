import { describe, expect, it } from "vitest";
import type { ScoredOpportunity } from "../types";
import { DEFAULT_WEEKLY_PLAN_SETTINGS, buildWeeklyPlan } from "./plan";

const today = new Date("2026-08-21T12:00:00");

const baseOpportunity: ScoredOpportunity = {
  id: "offer-a",
  merchant: "Merchant A",
  title: "Verified household offer",
  summary: "Official offer evidence",
  category: "grocery",
  estimatedSavings: 10,
  minimumSpend: 20,
  isFree: false,
  expiresOn: "2026-08-31",
  locationNote: "77386 area",
  verification: "verified",
  friction: "low",
  tags: [],
  stackNote: "Compatible with loyalty",
  source: {
    label: "Official source",
    url: "https://example.com/a",
    checkedOn: "2026-08-21"
  },
  actionLabel: "Review",
  distanceMiles: 2,
  score: 82,
  scoreLabel: "Strong",
  scoreBreakdown: []
};

function makeOffer(overrides: Partial<ScoredOpportunity>): ScoredOpportunity {
  return { ...baseOpportunity, ...overrides };
}

function expectCloseTo(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(0.0001);
}

describe("weekly action plan optimizer", () => {
  it("never selects a deal whose required spend exceeds the weekly budget", () => {
    const affordable = makeOffer({
      id: "affordable",
      merchant: "Affordable Market",
      estimatedSavings: 8,
      minimumSpend: 15
    });
    const expensive = makeOffer({
      id: "expensive",
      merchant: "Premium Market",
      estimatedSavings: 12,
      minimumSpend: 25
    });

    const plan = buildWeeklyPlan(
      [expensive, affordable],
      { weeklyBudget: 20 },
      today
    );

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].merchant).toBe("Affordable Market");
    expect(plan.requiredSpend).toBe(15);
    expectCloseTo(plan.valueEfficiency ?? -1, 8 / 15);
    expectCloseTo(plan.estimatedNetCost, 7);
    expect(plan.excluded.find(({ opportunity }) => opportunity.id === "expensive")?.reason).toBe(
      "Outside the strongest plan under current limits"
    );
  });

  it("summarizes the blended cash tradeoff for a selected plan", () => {
    const first = makeOffer({
      id: "first",
      merchant: "First Market",
      estimatedSavings: 12,
      minimumSpend: 30
    });
    const second = makeOffer({
      id: "second",
      merchant: "Second Market",
      estimatedSavings: 4,
      minimumSpend: 10
    });

    const plan = buildWeeklyPlan(
      [first, second],
      { weeklyBudget: 40, maxTrips: 2 },
      today
    );

    expect(plan.selectedDeals).toHaveLength(2);
    expect(plan.requiredSpend).toBe(40);
    expect(plan.estimatedSavings).toBe(16);
    expectCloseTo(plan.valueEfficiency ?? -1, 0.4);
    expect(plan.estimatedNetCost).toBe(24);
    expect(plan.savingsRate).toBeCloseTo(40);
  });

  it("limits the number of merchant trips", () => {
    const plan = buildWeeklyPlan(
      [
        makeOffer({ id: "first", merchant: "First Market", estimatedSavings: 12 }),
        makeOffer({ id: "second", merchant: "Second Market", estimatedSavings: 9 }),
        makeOffer({ id: "third", merchant: "Third Market", estimatedSavings: 3 })
      ],
      { weeklyBudget: 100, maxTrips: 2 },
      today
    );

    expect(plan.trips.map((trip) => trip.merchant)).toEqual([
      "First Market",
      "Second Market"
    ]);
    expect(plan.excluded.find(({ opportunity }) => opportunity.id === "third")).toBeTruthy();
  });

  it("labels mixed-distance merchant trips while retaining the nearest confirmed distance", () => {
    const confirmed = makeOffer({ id: "confirmed-local", merchant: "Mixed Market" });
    const unconfirmed = makeOffer({
      id: "unknown-local",
      merchant: "Mixed Market",
      distanceMiles: undefined
    });

    const plan = buildWeeklyPlan(
      [confirmed, unconfirmed],
      {
        ...DEFAULT_WEEKLY_PLAN_SETTINGS,
        maxDealsPerTrip: 2,
        includeUnconfirmedLocations: true
      },
      today
    );

    expect(plan.trips[0].distanceConfirmed).toBe(true);
    expect(plan.trips[0].distanceMiles).toBe(2);
    expect(plan.trips[0].hasUnconfirmedLocationDeal).toBe(true);
    expect(plan.trips[0].deals.find(({ warnings }) => warnings.length > 0)).toBeTruthy();
  });

  it("excludes unconfirmed locations when the user asks for confirmed distances only", () => {
    const plan = buildWeeklyPlan([{ ...baseOpportunity, distanceMiles: undefined }], {
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      includeUnconfirmedLocations: false
    }, today);

    expect(plan.excluded[0].reason).toBe("Location distance not confirmed");
  });

  it("can reorder the same optimized trips nearest first", () => {
    const offers = [
      makeOffer({
        id: "far-high-value",
        merchant: "Far Market",
        distanceMiles: 8,
        estimatedSavings: 20,
        minimumSpend: 20,
        score: 90
      }),
      makeOffer({
        id: "mid-medium-value",
        merchant: "Mid Market",
        distanceMiles: 4,
        estimatedSavings: 10,
        minimumSpend: 10,
        score: 70
      }),
      makeOffer({
        id: "near-lower-value",
        merchant: "Near Market",
        distanceMiles: 1,
        estimatedSavings: 5,
        minimumSpend: 5,
        score: 60
      })
    ];

    const byUtility = buildWeeklyPlan(
      offers,
      { weeklyBudget: 50, maxTrips: 3 },
      today
    );
    const byDistance = buildWeeklyPlan(
      offers,
      { weeklyBudget: 50, maxTrips: 3, tripOrder: "distance" },
      today
    );

    expect(byUtility.trips.map(({ merchant }) => merchant)).toEqual([
      "Far Market",
      "Mid Market",
      "Near Market"
    ]);
    expect(byDistance.trips.map(({ merchant }) => merchant)).toEqual([
      "Near Market",
      "Mid Market",
      "Far Market"
    ]);
    expect(byDistance.assumptions).toContain(
      "Trips are displayed nearest first using approximate location distances."
    );
  });

  it("uses the user travel-cost estimate to prefer better net household results", () => {
    const offers = [
      makeOffer({
        id: "near",
        merchant: "Near Market",
        distanceMiles: 2,
        estimatedSavings: 10,
        minimumSpend: 20,
        score: 80
      }),
      makeOffer({
        id: "far",
        merchant: "Far Market",
        distanceMiles: 8,
        estimatedSavings: 11,
        minimumSpend: 20,
        score: 82
      })
    ];

    const withoutCost = buildWeeklyPlan(
      offers,
      { weeklyBudget: 40, maxTrips: 2 },
      today
    );
    const withCost = buildWeeklyPlan(
      offers,
      { weeklyBudget: 40, maxTrips: 1, travelCostPerMile: 0.7 },
      today
    );

    expect(withoutCost.trips).toHaveLength(2);
    expect(withCost.trips.map(({ merchant }) => merchant)).toEqual([
      "Near Market"
    ]);
    expect(withCost.totalTravelCost).toBeCloseTo(1.4);
    expect(withCost.netBenefitAfterTravel).toBeCloseTo(8.6);
    expect(
      withCost.assumptions.some((assumption) =>
        assumption.includes("$0.70-per-mile travel estimate")
      )
    ).toBe(true);
  });

  it("does not treat a checked distance as proof of local promotion participation", () => {
    const plan = buildWeeklyPlan([makeOffer({ id: "catalog-local" })], {}, today);

    expect(plan.trips[0].hasUnconfirmedParticipationDeal).toBe(true);
    expect(plan.trips[0].deals[0].warnings).toContain(
      "Distance does not prove local participation; confirm it before travel."
    );
  });

  it("explains when proximity comes from a nearby store rather than the offer", () => {
    const plan = buildWeeklyPlan(
      [
        makeOffer({
          id: "merchant-location-only",
          distanceBasis: "merchant-location",
          distanceCheckedOn: "2026-08-20"
        })
      ],
      {},
      today
    );

    expect(plan.trips[0].hasUnconfirmedParticipationDeal).toBe(true);
    expect(plan.trips[0].deals[0].warnings).toContain(
      "Nearby store is confirmed; confirm promotion participation."
    );
  });

  it("treats a locally captured confirmed-distance offer as participation-ready", () => {
    const plan = buildWeeklyPlan(
      [
        makeOffer({
          id: "local-confirmed",
          localRecord: true,
          distanceBasis: "offer"
        })
      ],
      {},
      today
    );

    expect(plan.trips[0].hasUnconfirmedParticipationDeal).toBe(false);
    expect(
      plan.trips[0].deals[0].warnings.some((warning) =>
        warning.toLowerCase().includes("participation")
      )
    ).toBe(false);
  });

  it("can require locally confirmed participation before planning a trip", () => {
    const catalogOffer = makeOffer({ id: "catalog-distance-only" });
    const localOffer = makeOffer({
      id: "local-participation-confirmed",
      localRecord: true,
      distanceBasis: "offer"
    });

    const plan = buildWeeklyPlan(
      [catalogOffer, localOffer],
      {
        ...DEFAULT_WEEKLY_PLAN_SETTINGS,
        maxDealsPerTrip: 2,
        requireLocalParticipation: true
      },
      today
    );

    expect(plan.trips[0].deals.map(({ opportunity }) => opportunity.id)).toEqual([
      "local-participation-confirmed"
    ]);
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "catalog-distance-only")
        ?.reason
    ).toBe("Local participation is not confirmed on this device");
    expect(plan.assumptions).toContain(
      "Only locally captured offers with confirmed distances are eligible."
    );
  });

  it("does not combine multiple new-customer rewards at one merchant", () => {
    const stronger = makeOffer({
      id: "new-member-stronger",
      merchant: "Signup Cafe",
      title: "$8 reward for new members",
      estimatedSavings: 8,
      minimumSpend: 10
    });
    const weaker = makeOffer({
      id: "new-user-weaker",
      merchant: "Signup Cafe",
      title: "$5 credit for first app users",
      estimatedSavings: 5,
      minimumSpend: 5
    });

    const plan = buildWeeklyPlan(
      [stronger, weaker],
      { weeklyBudget: 50, maxDealsPerTrip: 2 },
      today
    );

    expect(plan.trips[0].merchant).toBe("Signup Cafe");
    expect(plan.trips[0].deals).toHaveLength(1);
    expect(plan.trips[0].deals[0].opportunity.id).toBe("new-member-stronger");
  });

  it("counts only one offer from an official exclusion group per merchant trip", () => {
    const stronger = makeOffer({
      id: "exclusive-stronger",
      merchant: "Exclusive Market",
      estimatedSavings: 10,
      minimumSpend: 10,
      stackGroup: "market-app-offer"
    });
    const weaker = makeOffer({
      id: "exclusive-weaker",
      merchant: "Exclusive Market",
      estimatedSavings: 8,
      minimumSpend: 5,
      stackGroup: "market-app-offer"
    });

    const plan = buildWeeklyPlan(
      [stronger, weaker],
      { weeklyBudget: 50, maxDealsPerTrip: 2 },
      today
    );

    expect(plan.trips[0].deals).toHaveLength(1);
    expect(plan.trips[0].deals[0].opportunity.id).toBe("exclusive-stronger");
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "exclusive-weaker")
        ?.reason
    ).toBe("Another offer from its exclusion group was selected.");
    expect(plan.estimatedSavings).toBe(10);
    expect(plan.requiredSpend).toBe(10);
    expect(plan.assumptions).toContain(
      "Only one offer with conditional or undocumented stacking is counted per merchant trip; exclusive offers are planned alone."
    );
  });

  it("still combines offers from distinct exclusion groups", () => {
    const coupon = makeOffer({
      id: "coupon",
      merchant: "Stackable Market",
      estimatedSavings: 10,
      minimumSpend: 20,
      stackGroup: "coupon"
    });
    const reward = makeOffer({
      id: "reward",
      merchant: "Stackable Market",
      estimatedSavings: 9,
      minimumSpend: 5,
      stackGroup: "loyalty-reward"
    });

    const plan = buildWeeklyPlan(
      [coupon, reward],
      { weeklyBudget: 50, maxDealsPerTrip: 2 },
      today
    );

    expect(plan.trips[0].deals.map(({ opportunity }) => opportunity.id)).toEqual([
      "coupon",
      "reward"
    ]);
    expect(plan.estimatedSavings).toBe(19);
  });

  it("plans an offer with exclusive stack terms by itself", () => {
    const exclusive = makeOffer({
      id: "exclusive",
      merchant: "Solo Market",
      title: "Strong standalone coupon",
      estimatedSavings: 10,
      minimumSpend: 10,
      stackNote: "This coupon cannot be combined with other offers"
    });
    const compatible = makeOffer({
      id: "compatible",
      merchant: "Solo Market",
      title: "Smaller compatible reward",
      estimatedSavings: 9,
      minimumSpend: 5,
      stackNote: "Eligible rewards can combine"
    });

    const plan = buildWeeklyPlan(
      [exclusive, compatible],
      { weeklyBudget: 50, maxDealsPerTrip: 2 },
      today
    );

    expect(plan.trips[0].deals.map(({ opportunity }) => opportunity.id)).toEqual([
      "exclusive"
    ]);
    expect(plan.trips[0].deals[0].warnings).toContain(
      "Official terms require this offer to be redeemed by itself."
    );
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "compatible")
        ?.reason
    ).toBe("Not combinable with the selected exclusive offer.");
    expect(plan.estimatedSavings).toBe(10);
    expect(plan.assumptions).toContain(
      "Only one offer with conditional or undocumented stacking is counted per merchant trip; exclusive offers are planned alone."
    );
  });

  it("prefers an otherwise equal offer with stronger linked outcomes", () => {
    const underperformer = makeOffer({
      id: "underperformer",
      merchant: "Outcome Market",
      estimatedSavings: 10,
      minimumSpend: 10
    });
    const outperformer = makeOffer({
      id: "outperformer",
      merchant: "Better Outcome Market",
      estimatedSavings: 10,
      minimumSpend: 10
    });

    const plan = buildWeeklyPlan(
      [underperformer, outperformer],
      { weeklyBudget: 20, maxTrips: 1 },
      today,
      {
        underperformer: {
          ratio: 0.5,
          samples: 1,
          adjustment: 0.75
        },
        outperformer: {
          ratio: 1.5,
          samples: 1,
          adjustment: 1.25
        }
      }
    );

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].deals).toHaveLength(1);
    expect(plan.trips[0].deals[0].opportunity.id).toBe("outperformer");
    expect(plan.trips[0].estimatedSavings).toBe(10);
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "underperformer")
        ?.reason
    ).toBe("Outside the strongest plan under current limits");
    expect(plan.assumptions).toContain(
      "Linked confirmed results locally adjust planning value when evidence exists."
    );
  });

  it("warns when linked local results differ materially from listed estimates", () => {
    const plan = buildWeeklyPlan([makeOffer({ id: "offer-a" })], {}, today, {
      "offer-a": {
        ratio: 0.5,
        samples: 1,
        adjustment: 0.75
      }
    });

    expect(plan.trips[0].deals[0].warnings).toContain(
      "Linked local results are below the listed estimate."
    );
  });

  it("lets the user allow conditional stacking for a merchant trip", () => {
    const first = makeOffer({
      id: "conditional-one",
      merchant: "Conditional Market",
      estimatedSavings: 10,
      minimumSpend: 10,
      stackNote: "Use only if both items are already planned"
    });
    const second = makeOffer({
      id: "conditional-two",
      merchant: "Conditional Market",
      estimatedSavings: 9,
      minimumSpend: 5,
      stackNote: "Confirm whether this can be used with another offer"
    });

    const conservative = buildWeeklyPlan(
      [first, second],
      { weeklyBudget: 50, maxDealsPerTrip: 2 },
      today
    );
    const confirmed = buildWeeklyPlan(
      [first, second],
      {
        weeklyBudget: 50,
        maxDealsPerTrip: 2,
        allowConditionalStacking: true
      },
      today
    );

    expect(conservative.trips[0].deals).toHaveLength(1);
    expect(conservative.trips[0].deals[0].warnings).toContain(
      "Stacking requires confirmation."
    );
    expect(
      conservative.excluded.find(
        ({ opportunity }) => opportunity.id === "conditional-two"
      )?.reason
    ).toBe("Excluded by the conditional-stacking guard.");
    expect(confirmed.trips[0].deals.map(({ opportunity }) => opportunity.id)).toEqual([
      "conditional-one",
      "conditional-two"
    ]);
    expect(confirmed.assumptions).toContain(
      "Conditional stacks are allowed only because you turned on the local override; official terms still control."
    );
  });

  it("counts payment-program labels as one underlying merchant trip", () => {
    const direct = makeOffer({
      id: "wendys-direct",
      merchant: "Wendy's",
      estimatedSavings: 4,
      minimumSpend: 5
    });
    const paymentOffer = makeOffer({
      id: "wendys-payment",
      merchant: "Wendy's + Paze",
      estimatedSavings: 10,
      minimumSpend: 10
    });

    const plan = buildWeeklyPlan(
      [direct, paymentOffer],
      { weeklyBudget: 50, maxDealsPerTrip: 2 },
      today
    );

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].merchant).toBe("Wendy's");
    expect(plan.trips[0].deals).toHaveLength(2);
  });

  it("explains why unsuitable offers cannot be planned", () => {
    const plan = buildWeeklyPlan(
      [
        makeOffer({ id: "lead", verification: "needs-check" }),
        makeOffer({ id: "expired", expiresOn: "2026-08-20" }),
        makeOffer({ id: "no-value", estimatedSavings: 0, isFree: false }),
        makeOffer({ id: "high-effort", friction: "high" }),
        makeOffer({ id: "too-far", distanceMiles: 12 }),
        makeOffer({ id: "bad-date", expiresOn: "2026-13-45" })
      ],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, maxDistanceMiles: 10 },
      today
    );

    const reasons = Object.fromEntries(
      plan.excluded.map(({ opportunity, reason }) => [opportunity.id, reason])
    );
    expect(reasons.lead).toBe("Not source-verified");
    expect(reasons.expired).toBe("Expired");
    expect(reasons["no-value"]).toBe("No captured dollar value");
    expect(reasons["high-effort"]).toBe("Above medium-effort limit");
    expect(reasons["too-far"]).toBe("Beyond 10-mile limit");
    expect(reasons["bad-date"]).toBe("Invalid expiration evidence");
  });

  it("honors the selected maximum redemption effort", () => {
    const lowEffort = makeOffer({
      id: "low-effort",
      merchant: "Low Effort Market",
      friction: "low"
    });
    const mediumEffort = makeOffer({
      id: "medium-effort",
      merchant: "Medium Effort Market",
      friction: "medium"
    });
    const highEffort = makeOffer({
      id: "high-effort",
      merchant: "High Effort Market",
      estimatedSavings: 20,
      friction: "high"
    });

    const strict = buildWeeklyPlan(
      [lowEffort, mediumEffort, highEffort],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, maximumFriction: "low", weeklyBudget: 100 },
      today
    );
    const standard = buildWeeklyPlan(
      [lowEffort, mediumEffort, highEffort],
      {
        ...DEFAULT_WEEKLY_PLAN_SETTINGS,
        maximumFriction: "medium",
        weeklyBudget: 100
      },
      today
    );
    const permissive = buildWeeklyPlan(
      [lowEffort, mediumEffort, highEffort],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, maximumFriction: "any", weeklyBudget: 100 },
      today
    );

    expect(strict.trips.map(({ merchant }) => merchant)).toEqual([
      "Low Effort Market"
    ]);
    expect(strict.assumptions).toContain("Only low-effort offers are eligible.");
    expect(standard.trips).toHaveLength(2);
    expect(permissive.trips).toHaveLength(3);
    expect(
      permissive.assumptions.find((assumption) =>
        assumption.includes("All verified effort levels")
      )
    ).toBeTruthy();
  });

  it("excludes offers below the requested minimum validity window", () => {
    const plan = buildWeeklyPlan(
      [makeOffer({ id: "too-soon", expiresOn: "2026-08-23" })],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, minimumDaysRemaining: 3 },
      today
    );

    expect(plan.trips).toHaveLength(0);
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "too-soon")
        ?.reason
    ).toBe("Ends within 3-day validity limit");
    expect(plan.assumptions).toContain(
      "Offers must remain valid for at least 3 more days; this is planning math, not an eligibility guarantee."
    );
  });

  it("excludes offers whose official-source evidence exceeds the freshness limit", () => {
    const stale = makeOffer({
      id: "stale-source",
      merchant: "Stale Market",
      source: {
        label: "Official source",
        url: "https://example.com/stale",
        checkedOn: "2026-08-06"
      }
    });

    const plan = buildWeeklyPlan(
      [stale],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, maximumSourceAgeDays: 14 },
      today
    );

    expect(plan.trips).toHaveLength(0);
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "stale-source")
        ?.reason
    ).toBe(
      "Official-source check is 15 days old, beyond the 14-day freshness limit"
    );
    expect(plan.assumptions).toContain(
      "Official offers and nearby-location checks must have evidence from the last 14 days."
    );
  });

  it("excludes merchant-location proximity when its own evidence is stale", () => {
    const staleLocation = makeOffer({
      id: "stale-location",
      distanceBasis: "merchant-location",
      distanceCheckedOn: "2026-08-06"
    });

    const plan = buildWeeklyPlan(
      [staleLocation],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, maximumSourceAgeDays: 14 },
      today
    );

    expect(plan.trips).toHaveLength(0);
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "stale-location")
        ?.reason
    ).toBe(
      "Nearby-location check is 15 days old, beyond the 14-day freshness limit"
    );
  });

  it("keeps merchant-location proximity with fresh location evidence", () => {
    const freshLocation = makeOffer({
      id: "fresh-location",
      distanceBasis: "merchant-location",
      distanceCheckedOn: "2026-08-20"
    });

    const plan = buildWeeklyPlan(
      [freshLocation],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, maximumSourceAgeDays: 14 },
      today
    );

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].deals[0].opportunity.id).toBe("fresh-location");
  });

  it("requires a source-check date before action planning", () => {
    const undated = makeOffer({
      id: "undated-source",
      merchant: "Undated Market",
      source: {
        label: "Official source",
        url: "https://example.com/undated",
        checkedOn: ""
      }
    });

    const plan = buildWeeklyPlan(
      [undated],
      DEFAULT_WEEKLY_PLAN_SETTINGS,
      today
    );

    expect(plan.trips).toHaveLength(0);
    expect(
      plan.excluded.find(({ opportunity }) => opportunity.id === "undated-source")
        ?.reason
    ).toBe("Source-check date is missing");
    expect(plan.assumptions).toContain(
      "Official offers and nearby-location checks must have evidence from the last 14 days."
    );
  });

  it("keeps an offer that meets the validity window and treats today as valid when no window is set", () => {
    const meetingMinimum = makeOffer({ id: "meets-minimum" });
    const expiringToday = makeOffer({
      id: "expiring-today",
      merchant: "Today Market",
      expiresOn: "2026-08-21"
    });

    const constrained = buildWeeklyPlan(
      [meetingMinimum],
      { ...DEFAULT_WEEKLY_PLAN_SETTINGS, minimumDaysRemaining: 10 },
      today
    );
    const unconstrained = buildWeeklyPlan(
      [expiringToday],
      DEFAULT_WEEKLY_PLAN_SETTINGS,
      today
    );

    expect(constrained.trips[0].deals[0].opportunity.id).toBe("meets-minimum");
    expect(unconstrained.trips[0].deals[0].opportunity.id).toBe(
      "expiring-today"
    );
  });

  it("supports a zero-dollar plan without indexing an undefined budget state", () => {
    const freeReward = makeOffer({
      id: "free-reward",
      merchant: "Free Reward Cafe",
      title: "Free drink reward",
      estimatedSavings: 5,
      minimumSpend: 0,
      isFree: true,
      distanceMiles: 1
    });

    const plan = buildWeeklyPlan([freeReward], { weeklyBudget: 0 }, today);

    expect(plan.trips).toHaveLength(1);
    expect(plan.requiredSpend).toBe(0);
    expect(plan.savingsRate).toBe(100);
  });
});

