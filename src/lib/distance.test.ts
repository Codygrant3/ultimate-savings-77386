import { describe, expect, it } from "vitest";
import type { LocalMerchantInventory, Opportunity } from "../types";
import { haversineMiles, resolveOpportunityDistance } from "./distance";

const opportunity: Opportunity = {
  id: "test",
  merchant: "Take 5 Oil Change",
  title: "Oil change offer",
  summary: "Test summary",
  category: "auto",
  estimatedSavings: 15,
  minimumSpend: 0,
  isFree: false,
  locationNote: "Participating locations; confirm locally.",
  verification: "verified",
  friction: "low",
  tags: [],
  source: { label: "Official", url: "https://example.com", checkedOn: "2026-08-21" },
  actionLabel: "Review"
};

const inventory: LocalMerchantInventory = {
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
      sourceLabel: "Official Take 5 page",
      sourceUrl: "https://example.com/take5",
      checkedOn: "2026-08-19"
    }
  ]
};

describe("local merchant distance resolution", () => {
  it("calculates great-circle distance in miles", () => {
    const miles = haversineMiles(
      { latitude: 30.1622, longitude: -95.4018 },
      { latitude: 30.1717, longitude: -95.4362 }
    );

    expect(miles).toBeGreaterThan(1);
    expect(miles).toBeLessThan(3);
  });

  it("resolves an exact merchant alias to its nearest checked location", () => {
    const resolved = resolveOpportunityDistance(opportunity, inventory);

    expect(resolved?.distanceMiles).toBe(2.4);
    expect(resolved?.basis).toBe("merchant-location");
    expect(resolved?.locationName).toBe("Take 5 Rayford Road");
  });

  it("does not resolve unknown merchants", () => {
    const resolved = resolveOpportunityDistance(
      { ...opportunity, merchant: "Unknown Merchant" },
      inventory
    );

    expect(resolved).toBeNull();
  });

  it("does not override an offer-specific distance", () => {
    expect(
      resolveOpportunityDistance(
        { ...opportunity, distanceMiles: 9.1 },
        inventory
      )
    ).toBeNull();
  });
});
