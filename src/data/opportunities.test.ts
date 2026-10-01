import { describe, expect, it } from "vitest";
import inventory from "./local-merchant-inventory.json";
import opportunities from "./opportunities.json";
import { resolveOpportunityDistance } from "../lib/distance";
import type { Opportunity } from "../types";

const catalog = opportunities as Opportunity[];

describe("verified opportunity catalog", () => {
  it("keeps every public-source record complete and non-negative", () => {
    for (const opportunity of catalog) {
      expect(opportunity.id).toBeTruthy();
      expect(opportunity.title).toBeTruthy();
      expect(opportunity.source.url).toMatch(/^https:\/\//);
      expect(opportunity.source.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(opportunity.estimatedSavings).toBeGreaterThanOrEqual(0);
      expect(opportunity.minimumSpend).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the current Exxon referral five-fill evidence", () => {
    const exxon = catalog.find(
      ({ id }) => id === "exxon-mobil-referral-five-fill-bonus-2026"
    );

    expect(exxon?.title).toContain("referral-code fills");
    expect(exxon?.estimatedSavings).toBe(11.25);
    expect(exxon?.expiresOn).toBe("2026-10-15");
    expect(exxon?.source.url).toBe(
      "https://www.exxonmobilfuels.com/en/rewards/faqs/terms-conditions"
    );
    expect(exxon?.finePrint).toContain("October 15, 2026");
  });

  it("resolves high-value fuel rewards to officially checked nearby locations", () => {
    const cases = [
      {
        merchant: "Shell Fuel Rewards",
        locationName: "Shell Rayford Road"
      },
      {
        merchant: "Exxon Mobil Rewards+",
        locationName: "Exxon Express Mart # 5"
      },
      {
        merchant: "7REWARDS Fuel",
        locationName: "7-Eleven Birnham Woods Drive"
      },
      {
        merchant: "Taco Bell",
        locationName: "Taco Bell Rayford Road"
      }
    ] as const;

    for (const { merchant, locationName } of cases) {
      const resolved = resolveOpportunityDistance(
        {
          id: `distance-${merchant}`,
          merchant,
          title: "Fuel reward",
          summary: "Official reward evidence",
          category: "fuel",
          estimatedSavings: 1,
          minimumSpend: 0,
          isFree: false,
          locationNote: "Participating locations; confirm locally.",
          verification: "verified",
          friction: "medium",
          tags: [],
          source: {
            label: "Official source",
            url: "https://example.com/offer",
            checkedOn: "2026-08-24"
          },
          actionLabel: "Review"
        },
        inventory
      );

      expect(resolved?.locationName).toBe(locationName);
      expect(resolved?.distanceMiles).toBeGreaterThan(0);
      expect(resolved?.distanceMiles).toBeLessThan(5);
    }
  });
});