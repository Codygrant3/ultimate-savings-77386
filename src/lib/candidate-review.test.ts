import { describe, expect, it } from "vitest";
import type { OfferCandidate, Opportunity } from "../types";
import {
  buildCandidateReviewContext,
  findCandidateMatch
} from "./candidate-review";

const tracked: Opportunity[] = [
  {
    id: "take5-15-off",
    merchant: "Take 5 Oil Change",
    title: "$15 toward an eligible oil change",
    summary: "Local oil-change coupon.",
    category: "auto",
    estimatedSavings: 15,
    minimumSpend: 0,
    isFree: false,
    locationNote: "Spring",
    verification: "verified",
    friction: "low",
    tags: ["oil change", "coupon"],
    source: {
      label: "Official source",
      url: "https://example.com/take5",
      checkedOn: "2026-08-23"
    },
    actionLabel: "Review"
  },
  {
    id: "costa-30-percent",
    merchant: "Costa Oil Rayford",
    title: "30% off any oil change for eligible service members",
    summary: "Veterans, military, and first responders.",
    category: "auto",
    estimatedSavings: 0,
    minimumSpend: 0,
    savingsRate: 30,
    isFree: false,
    expiresOn: "2026-12-31",
    locationNote: "Spring",
    verification: "verified",
    friction: "low",
    tags: ["oil change", "military"],
    source: {
      label: "Official source",
      url: "https://example.com/costa",
      checkedOn: "2026-08-23"
    },
    actionLabel: "Review"
  }
];

function candidate(overrides: Partial<OfferCandidate> = {}): OfferCandidate {
  return {
    id: "candidate",
    sourceId: "source",
    merchant: "Take 5 Oil Change",
    title: "$15 off any oil change",
    url: "https://example.com/candidate",
    amountText: "$15 Off",
    ...overrides
  };
}

describe("candidate review matching", () => {
  it("matches an exact tracked offer and its evidence", () => {
    const match = findCandidateMatch(candidate(), tracked);

    expect(match?.opportunity.id).toBe("take5-15-off");
    expect(match?.amountMatches).toBe(true);
    expect(match?.minimumSpendMatches).toBe(true);
    expect(match?.expirationMatches).toBe(true);
  });

  it("keeps an unrelated merchant candidate as a new lead", () => {
    expect(
      buildCandidateReviewContext(
        candidate({ merchant: "New Auto Shop", title: "$15 off oil change" }),
        tracked
      )
    ).toEqual({ status: "new" });
  });

  it("normalizes local merchant naming without losing the tracked match", () => {
    const match = findCandidateMatch(
      candidate({
        merchant: "Costa Oil Spring Rayford",
        title: "30% off any oil change",
        amountText: "30% off",
        expirationText: "12/31/2026"
      }),
      tracked
    );

    expect(match?.opportunity.id).toBe("costa-30-percent");
    expect(match?.amountMatches).toBe(true);
    expect(match?.expirationMatches).toBe(true);
  });

  it("flags changed value, spend, and expiration evidence", () => {
    const match = findCandidateMatch(
      candidate({
        amountText: "$10 Off",
        minimumSpend: 50,
        expirationText: "9/30/2026"
      }),
      tracked
    );

    expect(match?.opportunity.id).toBe("take5-15-off");
    expect(match?.amountMatches).toBe(false);
    expect(match?.minimumSpendMatches).toBe(false);
    expect(match?.expirationMatches).toBe(false);
  });
});
