import { describe, expect, it } from "vitest";
import type { OfferCandidate, Opportunity } from "../types";
import {
  buildCandidateReviewContext,
  createLocallyVerifiedOffer,
  findCandidateMatch,
  findLocalOfferConflict
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
  },
  {
    id: "rainbow-birthday",
    merchant: "Rainbow Car Care",
    title: "Free full-service car wash on your birthday",
    summary: "Birthday reward.",
    category: "auto",
    estimatedSavings: 20,
    minimumSpend: 0,
    isFree: true,
    locationNote: "The Woodlands",
    verification: "verified",
    friction: "medium",
    tags: ["car wash", "birthday"],
    source: {
      label: "Official source",
      url: "https://example.com/rainbow",
      checkedOn: "2026-08-24"
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

  it("keeps a different value at the same merchant as a new lead", () => {
    const freeNuggets: Opportunity = {
      ...tracked[2],
      id: "wendys-free-nuggets",
      merchant: "Wendy's",
      title: "Free 6-piece nuggets Wednesday with $5 purchase",
      summary: "Wendy's app offer.",
      tags: ["nuggets", "wednesday", "app"]
    };

    expect(
      buildCandidateReviewContext(
        candidate({
          merchant: "Wendy's",
          title: "$1 Off Crispy Chicken or 4-piece Nuggets w/ $5 Purchase",
          amountText: "$1 Off",
          minimumSpend: 5
        }),
        [freeNuggets]
      )
    ).toEqual({ status: "new" });
  });

  it("matches cashback evidence before treating the estimate as a rate", () => {
    const pazeOffer: Opportunity = {
      ...tracked[2],
      id: "wendys-paze-offer",
      merchant: "Wendy's + Paze",
      title: "$10 back on a $10+ Wendy's app order",
      summary:
        "Eligible Paze users can earn a $10 statement credit on a Wendy's app purchase of at least $10.",
      estimatedSavings: 10,
      minimumSpend: 10,
      savingsRate: 100,
      isFree: false,
      expiresOn: "2026-09-10"
    };

    const match = findCandidateMatch(
      candidate({
        merchant: "Wendy's + Paze",
        title: "Paze users spend $10+ in the Wendy's app to earn $10 back",
        amountText: "$10 back",
        minimumSpend: 10,
        expirationText: "9/10/2026"
      }),
      [pazeOffer]
    );

    expect(match?.opportunity.id).toBe("wendys-paze-offer");
    expect(match?.amountMatches).toBe(true);
    expect(match?.minimumSpendMatches).toBe(true);
    expect(match?.expirationMatches).toBe(true);
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

  it("links a parsed local loyalty lead to its tracked birthday offer", () => {
    const match = findCandidateMatch(
      candidate({
        id: "rainbow-birthday-candidate",
        merchant: "Rainbow Car Care",
        title: "Free full-service car wash on your birthday",
        amountText: "Free",
        detail: "Some restrictions apply."
      }),
      tracked
    );

    expect(match?.opportunity.id).toBe("rainbow-birthday");
    expect(match?.amountMatches).toBe(true);
    expect(match?.minimumSpendMatches).toBe(true);
  });

  it("distinguishes a tracked duplicate from an update to the same local record", () => {
    const localRecord = {
      ...tracked[0],
      id: "local-candidate",
      localRecord: true as const
    };

    expect(findLocalOfferConflict(candidate(), tracked)).toEqual({
      status: "blocked",
      opportunity: tracked[0]
    });
    expect(
      findLocalOfferConflict(candidate(), [...tracked, localRecord])
    ).toEqual({
      status: "replace",
      opportunity: localRecord
    });
    expect(
      findLocalOfferConflict(
        candidate({ merchant: "New Market", title: "$15 off groceries" }),
        []
      )
    ).toEqual({ status: "none" });
  });

  it("requires explicit official-source confirmation before local verification", () => {
    const result = createLocallyVerifiedOffer(
      candidate(),
      {
        category: "auto",
        estimatedSavings: 15,
        minimumSpend: 0,
        isFree: false,
        friction: "low",
        stackStatus: "conditional",
        localParticipationConfirmed: false,
        officialTermsConfirmed: false
      },
      new Date("2026-08-24T12:00:00")
    );

    expect(result).toEqual({
      status: "invalid",
      errors: ["Confirm the offer terms on the linked official source"]
    });
  });

  it("creates a gated local offer only after the user captures confirmed terms", () => {
    const result = createLocallyVerifiedOffer(
      candidate({ detail: "Valid at participating locations." }),
      {
        category: "auto",
        estimatedSavings: 15,
        minimumSpend: 25,
        isFree: false,
        expiresOn: "2026-09-30",
        friction: "low",
        stackNote: "One coupon per visit",
        stackGroup: "Market App Offer",
        savingsRate: 30,
        distanceMiles: 4.2,
        stackStatus: "exclusive",
        localParticipationConfirmed: true,
        officialTermsConfirmed: true
      },
      new Date("2026-08-24T12:00:00")
    );

    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    expect(result.offer.id).toBe("local-candidate");
    expect(result.offer.verification).toBe("verified");
    expect(result.offer.localRecord).toBe(true);
    expect(result.offer.estimatedSavings).toBe(15);
    expect(result.offer.minimumSpend).toBe(25);
    expect(result.offer.savingsRate).toBe(30);
    expect(result.offer.expiresOn).toBe("2026-09-30");
    expect(result.offer.stackNote).toBe("One coupon per visit");
    expect(result.offer.stackGroup).toBe("market-app-offer");
    expect(result.offer.stackStatus).toBe("exclusive");
    expect(result.offer.locationNote).toContain("locally confirmed");
    expect(result.offer.distanceMiles).toBe(4.2);
  });

  it("requires a bounded distance before marking local participation", () => {
    const result = createLocallyVerifiedOffer(
      candidate(),
      {
        category: "auto",
        estimatedSavings: 15,
        minimumSpend: 0,
        isFree: false,
        friction: "low",
        stackStatus: "conditional",
        distanceMiles: 51,
        localParticipationConfirmed: true,
        officialTermsConfirmed: true
      },
      new Date("2026-08-24T12:00:00")
    );

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.errors).toContain(
      "Enter a confirmed distance from 0 to 50 miles"
    );
  });

  it("carries valid official redemption days into a local offer and rejects bad evidence", () => {
    const valid = createLocallyVerifiedOffer(
      candidate({ availableDaysOfWeek: [3, 3, 5] }),
      {
        category: "restaurants",
        estimatedSavings: 0,
        minimumSpend: 5,
        isFree: true,
        friction: "low",
        stackStatus: "conditional",
        localParticipationConfirmed: false,
        officialTermsConfirmed: true
      },
      new Date("2026-08-24T12:00:00")
    );

    expect(valid.status).toBe("created");
    if (valid.status !== "created") return;
    expect(valid.offer.availableDaysOfWeek).toEqual([3, 5]);

    const invalid = createLocallyVerifiedOffer(
      candidate({ availableDaysOfWeek: [7] }),
      {
        category: "restaurants",
        estimatedSavings: 0,
        minimumSpend: 5,
        isFree: true,
        friction: "low",
        stackStatus: "conditional",
        localParticipationConfirmed: false,
        officialTermsConfirmed: true
      },
      new Date("2026-08-24T12:00:00")
    );

    expect(invalid).toEqual({
      status: "invalid",
      errors: ["Capture valid official redemption days from Sunday to Saturday"]
    });
  });

  it("rejects an out-of-range published savings rate", () => {
    const result = createLocallyVerifiedOffer(
      candidate(),
      {
        category: "auto",
        estimatedSavings: 15,
        minimumSpend: 0,
        isFree: false,
        friction: "low",
        stackStatus: "conditional",
        savingsRate: 101,
        localParticipationConfirmed: false,
        officialTermsConfirmed: true
      },
      new Date("2026-08-24T12:00:00")
    );

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.errors).toContain(
      "Enter a savings rate from 1 to 100 percent"
    );
  });

  it("rejects an unsafe exclusion group", () => {
    const result = createLocallyVerifiedOffer(
      candidate(),
      {
        category: "auto",
        estimatedSavings: 15,
        minimumSpend: 0,
        isFree: false,
        friction: "low",
        stackGroup: "not safe!",
        stackStatus: "conditional",
        localParticipationConfirmed: false,
        officialTermsConfirmed: true
      },
      new Date("2026-08-24T12:00:00")
    );

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.errors).toContain(
      "Use an exclusion group with 1 to 60 letters, numbers, or dashes"
    );
  });
});
