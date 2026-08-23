import { describe, expect, it } from "vitest";
import opportunities from "./opportunities.json";
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

  it("uses the current seven-fill Exxon newcomer evidence", () => {
    const exxon = catalog.find(
      ({ id }) => id === "exxon-mobil-new-app-user-ten-dollar-bonus-2026"
    );

    expect(exxon?.title).toBe("Up to $15 in points across seven qualifying app fill-ups");
    expect(exxon?.estimatedSavings).toBe(15);
    expect(exxon?.source.url).toBe("https://www.exxonmobilfuels.com/en/rewards/faqs");
    expect(exxon?.source.checkedOn).toBe("2026-08-23");
    expect(exxon?.finePrint).toContain("next five qualifying app fills");
  });
});
