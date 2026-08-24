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
    },
    {
      id: "heb-spring-creek",
      merchantAliases: ["H-E-B"],
      locationName: "H-E-B Spring Creek Market",
      address: "3540 Rayford Road, Spring, TX 77386",
      distanceMiles: 3.9,
      sourceLabel: "Business-confirmed profile",
      sourceUrl: "https://example.com/heb-profile",
      checkedOn: "2026-08-24"
    },
    {
      id: "whataburger-rayford",
      merchantAliases: ["Whataburger", "Whataburger Rewards"],
      locationName: "Whataburger Rayford Road",
      address: "3447 Rayford Road, Spring, TX 77386",
      distanceMiles: 3.5,
      sourceLabel: "Whataburger official Rayford Road location page",
      sourceUrl: "https://locations.whataburger.com/tx/spring/3447-rayford-rd.html",
      checkedOn: "2026-08-24"
    },
    {
      id: "wendys-sawdust",
      merchantAliases: ["Wendy's", "Wendy's + Paze"],
      locationName: "Wendy's Sawdust Road",
      address: "505 Sawdust Road, Spring, TX 77380",
      distanceMiles: 4.6,
      sourceLabel: "Wendy's official restaurant locator",
      sourceUrl: "https://order.wendys.com/us/en/select-restaurant?location=77386",
      checkedOn: "2026-08-24"
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

  it("resolves the nearby H-E-B store without claiming coupon participation", () => {
    const resolved = resolveOpportunityDistance(
      { ...opportunity, merchant: "H-E-B" },
      inventory
    );

    expect(resolved?.distanceMiles).toBe(3.9);
    expect(resolved?.locationName).toBe("H-E-B Spring Creek Market");
  });

  it("resolves Whataburger rewards and offers to the official Rayford location", () => {
    const resolved = resolveOpportunityDistance(
      { ...opportunity, merchant: "Whataburger Rewards" },
      inventory
    );

    expect(resolved?.distanceMiles).toBe(3.5);
    expect(resolved?.locationName).toBe("Whataburger Rayford Road");
    expect(resolved?.sourceLabel).toContain("official");
  });

  it("resolves Wendy's payment-branded offers to the official nearest locator result", () => {
    const resolved = resolveOpportunityDistance(
      { ...opportunity, merchant: "Wendy's + Paze" },
      inventory
    );

    expect(resolved?.distanceMiles).toBe(4.6);
    expect(resolved?.locationName).toBe("Wendy's Sawdust Road");
    expect(resolved?.sourceLabel).toContain("official");
  });
});
