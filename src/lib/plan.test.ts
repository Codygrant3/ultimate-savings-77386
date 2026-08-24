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
    expect(plan.excluded.find(({ opportunity }) => opportunity.id === "expensive")?.reason).toBe(
      "Outside the strongest plan under current limits"
    );
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

  it("labels a mixed-distance merchant trip as unconfirmed and warns about participation", () => {
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

    expect(plan.trips[0].distanceConfirmed).toBe(false);
    expect(plan.trips[0].deals.find(({ warnings }) => warnings.length > 0)).toBeTruthy();
  });

  it("excludes unconfirmed locations when the user asks for confirmed distances only", () => {
    const plan = buildWeeklyPlan([{ ...baseOpportunity, distanceMiles: undefined }], {
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      includeUnconfirmedLocations: false
    }, today);

    expect(plan.excluded[0].reason).toBe("Location distance not confirmed");
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
    expect(plan.estimatedSavings).toBe(10);
    expect(plan.requiredSpend).toBe(10);
    expect(plan.assumptions).toContain(
      "Offers sharing an official exclusion group are counted at most once per merchant trip."
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

