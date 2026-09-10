import { describe, expect, it } from "vitest";
import settlementsData from "../data/settlements.json";
import { daysUntilDeadline, isOpenSettlement, rankSettlements } from "./settlements";
import type { ClassActionSettlement } from "../types";

const settlements = settlementsData as ClassActionSettlement[];
const testDate = new Date("2026-07-25T12:00:00");

describe("class action settlement guardrails", () => {
  it("keeps only open, free-to-file, official opportunities", () => {
    const expired = {
      ...settlements[0],
      id: "expired",
      claimDeadline: "2026-01-01"
    };
    const ranked = rankSettlements([...settlements, expired], testDate);

    expect(ranked).toHaveLength(9);
    expect(ranked.some((settlement) => settlement.id === "expired")).toBe(false);
    expect(ranked.every((settlement) => settlement.feeRequired === false)).toBe(true);
  });

  it("ranks relevance without changing the unconfirmed eligibility state", () => {
    const ranked = rankSettlements(settlements, testDate);

    expect(ranked[0].id).toBe("biddle-disney-online-tv-2026");
    expect(
      ranked.every(
        (settlement) =>
          settlement.eligibilityStatus === "user-confirmation-required"
      )
    ).toBe(true);
  });

  it("calculates deadline urgency and rejects an expired settlement", () => {
    expect(daysUntilDeadline("2026-09-08", testDate)).toBeGreaterThan(40);
    expect(
      isOpenSettlement(
        { ...settlements[0], claimDeadline: "2026-07-01" },
        testDate
      )
    ).toBe(false);
  });
});
