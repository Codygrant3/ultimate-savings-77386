import { describe, expect, it } from "vitest";
import type { LocalMerchantInventory, Opportunity } from "../types";
import { buildLearnedPreferences } from "./preferences";
import {
  DEFAULT_HOUSEHOLD_PROFILE,
  DEFAULT_SCORING_WEIGHTS,
  effectiveScoringWeights,
  isExcludedByPreferences,
  isExpired,
  normalizeHouseholdProfile,
  rankOpportunities,
  scoreOpportunity,
  startOfWeek,
  sourceAgeDays
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
  it("measures evidence age from the official source-check date", () => {
    expect(
      sourceAgeDays(baseOpportunity, new Date("2026-07-23T12:00:00"))
    ).toBe(0);
    expect(
      sourceAgeDays(baseOpportunity, new Date("2026-08-05T12:00:00"))
    ).toBe(13);
    expect(
      sourceAgeDays(
        { ...baseOpportunity, source: { ...baseOpportunity.source, checkedOn: "" } },
        new Date("2026-07-23T12:00:00")
      )
    ).toBeNull();
  });

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

  it("resolves a checked H-E-B store location as approximate proximity", () => {
    const today = new Date("2026-08-24T12:00:00");
    const inventory: LocalMerchantInventory = {
      zipCode: "77386",
      origin: { label: "77386 centroid", latitude: 30.1622, longitude: -95.4018 },
      checkedOn: "2026-08-24",
      merchants: [
        {
          id: "heb-spring-creek",
          merchantAliases: ["H-E-B"],
          locationName: "H-E-B Spring Creek Market",
          address: "3540 Rayford Road, Spring, TX 77386",
          distanceMiles: 3.9,
          sourceLabel: "Business-confirmed profile",
          sourceUrl: "https://example.com/heb-profile",
          checkedOn: "2026-08-24"
        }
      ]
    };
    const scored = scoreOpportunity(
      { ...baseOpportunity, merchant: "H-E-B" },
      today,
      undefined,
      inventory
    );

    expect(scored.distanceMiles).toBe(3.9);
    expect(scored.distanceCheckedOn).toBe("2026-08-24");
    expect(scored.distanceSourceUrl).toBe("https://example.com/heb-profile");
    expect(
      scored.scoreBreakdown.find(({ label }) => label === "Local relevance")?.detail
    ).toContain("~3.9 miles to H-E-B Spring Creek Market");
    expect(
      scored.scoreBreakdown.find(({ label }) => label === "Local relevance")?.detail
    ).toContain("participation unconfirmed");
  });

  it("decays nearby-location proximity as its evidence ages", () => {
    const today = new Date("2026-08-24T12:00:00");
    const makeInventory = (checkedOn: string): LocalMerchantInventory => ({
      zipCode: "77386",
      origin: { label: "77386 centroid", latitude: 30.1622, longitude: -95.4018 },
      checkedOn,
      merchants: [
        {
          id: "heb-spring-creek",
          merchantAliases: ["H-E-B"],
          locationName: "H-E-B Spring Creek Market",
          address: "3540 Rayford Road, Spring, TX 77386",
          distanceMiles: 3.9,
          sourceLabel: "Business-confirmed profile",
          sourceUrl: "https://example.com/heb-profile",
          checkedOn
        }
      ]
    });
    const fresh = scoreOpportunity(
      { ...baseOpportunity, merchant: "H-E-B" },
      today,
      undefined,
      makeInventory("2026-08-20")
    );
    const stale = scoreOpportunity(
      { ...baseOpportunity, merchant: "H-E-B" },
      today,
      undefined,
      makeInventory("2026-07-15")
    );

    expect(fresh.distanceEvidenceAgeDays).toBe(4);
    expect(stale.distanceEvidenceAgeDays).toBe(40);
    expect(fresh.score).toBeGreaterThan(stale.score);
    expect(
      fresh.scoreBreakdown.find(({ label }) => label === "Local relevance")?.detail
    ).toContain("location checked 4 days ago");
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

  it("separates compatible, conditional, and exclusive stack evidence", () => {
    const today = new Date("2026-07-23T12:00:00");
    const factorFor = (opportunity: Opportunity) =>
      scoreOpportunity(opportunity, today).scoreBreakdown.find(
        ({ label }) => label === "Stackability"
      );

    const compatible = factorFor({
      ...baseOpportunity,
      id: "compatible",
      stackNote: "Eligible rewards can combine"
    });
    const conditional = factorFor({
      ...baseOpportunity,
      id: "conditional",
      stackNote: "Use only if both items are already planned"
    });
    const exclusive = factorFor({
      ...baseOpportunity,
      id: "exclusive",
      stackNote: "This coupon cannot be combined with other offers"
    });

    expect(compatible?.detail).toContain("Compatible");
    expect(conditional?.detail).toContain("confirmation");
    expect(exclusive?.detail).toContain("restrict combining");
    if (
      compatible?.points === undefined ||
      conditional?.points === undefined ||
      exclusive?.points === undefined
    ) {
      throw new Error("Stackability factor missing");
    }
    expect(compatible.points).toBeGreaterThan(conditional.points);
    expect(conditional.points).toBeGreaterThan(exclusive.points);
  });

  it("uses confirmed receipt history to adjust household fit", () => {
    const today = new Date("2026-08-21T12:00:00");
    const learned = buildLearnedPreferences(
      [
        {
          id: "receipt-one",
          merchant: "Test",
          category: "grocery",
          occurredOn: "2026-08-20",
          amountSpent: 10,
          actualSavings: 10
        },
        {
          id: "receipt-two",
          merchant: "Test",
          category: "grocery",
          occurredOn: "2026-08-19",
          amountSpent: 10,
          actualSavings: 8
        }
      ],
      today
    );
    const learnedScore = scoreOpportunity(baseOpportunity, today, learned);
    const baseline = scoreOpportunity(baseOpportunity, today);
    const fitFactor = learnedScore.scoreBreakdown.find(
      ({ label }) => label === "Household fit"
    );

    expect(learnedScore.scoreBreakdown.find(({ label }) => label === "Household fit")?.points)
      .toBeGreaterThan(
        baseline.scoreBreakdown.find(({ label }) => label === "Household fit")?.points ?? 0
      );
    expect(fitFactor?.detail).toContain("Learned history:");
  });

  it("normalizes custom ranking priorities into a bounded 100-point contract", () => {
    const weights = effectiveScoringWeights({
      evidence: 80,
      dollarValue: 20,
      savingsRate: Number.NaN
    });
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

    expect(weights.evidence).toBeGreaterThan(weights.dollarValue);
    expect(weights.savingsRate).toBe(0);
    expect(total).toBe(100);
    expect(effectiveScoringWeights()).toEqual(DEFAULT_SCORING_WEIGHTS);
    expect(effectiveScoringWeights({})).toEqual(DEFAULT_SCORING_WEIGHTS);
  });

  it("changes rankings according to household scoring priorities", () => {
    const today = new Date("2026-07-23T12:00:00");
    const highValue = {
      ...baseOpportunity,
      id: "high-value",
      estimatedSavings: 50,
      source: { ...baseOpportunity.source, checkedOn: "2026-06-01" }
    };
    const freshEvidence = {
      ...baseOpportunity,
      id: "fresh-evidence",
      estimatedSavings: 2
    };
    const valueFirstWeights = {
      ...DEFAULT_SCORING_WEIGHTS,
      dollarValue: 45,
      evidence: 5,
      savingsRate: 1,
      householdFit: 1,
      localRelevance: 1,
      timing: 1,
      effort: 1,
      requiredSpend: 1,
      stackability: 1
    };
    const evidenceFirstWeights = {
      ...DEFAULT_SCORING_WEIGHTS,
      dollarValue: 5,
      evidence: 45,
      savingsRate: 1,
      householdFit: 1,
      localRelevance: 1,
      timing: 1,
      effort: 1,
      requiredSpend: 1,
      stackability: 1
    };

    expect(
      rankOpportunities(
        [highValue, freshEvidence],
        today,
        undefined,
        undefined,
        valueFirstWeights
      )[0].id
    ).toBe("high-value");
    expect(
      rankOpportunities(
        [highValue, freshEvidence],
        today,
        undefined,
        undefined,
        evidenceFirstWeights
      )[0].id
    ).toBe("fresh-evidence");
  });

  it("uses local household keywords for fit boosts and exclusions", () => {
    const today = new Date("2026-07-23T12:00:00");
    const movieOffer = {
      ...baseOpportunity,
      id: "family-movie",
      category: "movies" as const,
      title: "Family movie night bundle"
    };
    const sportsOffer = {
      ...baseOpportunity,
      id: "away-game",
      category: "sports" as const,
      title: "Away game ticket package"
    };
    const profile = {
      excludedKeywords: ["away game"],
      highPriorityKeywords: ["family movie"],
      preferredKeywords: ["bundle"]
    };
    const scored = scoreOpportunity(movieOffer, today, undefined, undefined, undefined, profile);
    const fit = scored.scoreBreakdown.find(({ label }) => label === "Household fit");

    expect(isExcludedByPreferences(movieOffer, profile)).toBe(false);
    expect(isExcludedByPreferences(sportsOffer, profile)).toBe(true);
    expect(fit?.detail).toContain("family movie");
    const baselineFit = scoreOpportunity(movieOffer, today)
      .scoreBreakdown.find(({ label }) => label === "Household fit");
    expect(fit?.points ?? 0).toBeGreaterThan(baselineFit?.points ?? 0);
    expect(normalizeHouseholdProfile({})).toEqual({
      excludedKeywords: [],
      highPriorityKeywords: [],
      preferredKeywords: []
    });
    expect(DEFAULT_HOUSEHOLD_PROFILE.excludedKeywords).toContain("baby");
  });

  it("uses a checked merchant location with a conservative distance score", () => {
    const today = new Date("2026-08-21T12:00:00");
    const opportunity = {
      ...baseOpportunity,
      id: "merchant-location",
      merchant: "Take 5 Oil Change",
      locationNote: "Participating locations; confirm locally."
    };
    const inventory = {
      zipCode: "77386",
      origin: { label: "77386 centroid", latitude: 30.1622, longitude: -95.4018 },
      checkedOn: "2026-08-21",
      merchants: [
        {
          id: "take5",
          merchantAliases: ["Take 5 Oil Change"],
          locationName: "Take 5 Rayford Road",
          address: "442 Rayford Road, Spring, TX 77386",
          distanceMiles: 2.4,
          sourceLabel: "Official location page",
          sourceUrl: "https://example.com/location",
          checkedOn: "2026-08-19"
        }
      ]
    };
    const scored = scoreOpportunity(
      opportunity,
      today,
      undefined,
      inventory as never
    );
    const factor = scored.scoreBreakdown.find(
      ({ label }) => label === "Local relevance"
    );

    expect(factor?.detail).toContain("~2.4 miles to Take 5 Rayford Road");
    expect(factor?.detail).toContain("offer participation unconfirmed");
  });
});
