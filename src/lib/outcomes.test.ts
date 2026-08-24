import { describe, expect, it } from "vitest";
import type { ReceiptEntry } from "../types";
import { buildOfferOutcomeAdjustments } from "./outcomes";

const today = new Date("2026-08-21T12:00:00");

function makeReceipt(overrides: Partial<ReceiptEntry>): ReceiptEntry {
  return {
    id: "receipt",
    merchant: "Local Market",
    category: "grocery",
    occurredOn: "2026-08-21",
    amountSpent: 20,
    actualSavings: 10,
    ...overrides
  };
}

describe("offer outcome adjustments", () => {
  it("reduces recent underperforming linked offers without hiding the evidence", () => {
    const adjustments = buildOfferOutcomeAdjustments(
      [
        makeReceipt({
          opportunityId: "underperformer",
          listedValue: 10,
          actualSavings: 5
        })
      ],
      today
    );

    expect(adjustments.underperformer).toEqual({
      ratio: 0.5,
      samples: 1,
      adjustment: 0.833
    });
  });

  it("aggregates linked results with recency-weighted confidence", () => {
    const adjustments = buildOfferOutcomeAdjustments(
      [
        makeReceipt({
          opportunityId: "volatile-offer",
          listedValue: 10,
          actualSavings: 5
        }),
        makeReceipt({
          id: "older-receipt",
          opportunityId: "volatile-offer",
          occurredOn: "2026-07-22",
          listedValue: 10,
          actualSavings: 15
        })
      ],
      today
    );

    expect(adjustments["volatile-offer"]).toEqual({
      ratio: 0.914,
      samples: 1.707,
      adjustment: 0.951
    });
  });

  it("ignores malformed, future-dated, or unlinked receipt outcomes", () => {
    const adjustments = buildOfferOutcomeAdjustments(
      [
        makeReceipt({ listedValue: 10 }),
        makeReceipt({
          opportunityId: "bad-listed",
          listedValue: 0,
          actualSavings: 5
        }),
        makeReceipt({
          opportunityId: "negative-savings",
          listedValue: 10,
          actualSavings: -5
        }),
        makeReceipt({
          opportunityId: "future-receipt",
          occurredOn: "2026-08-22",
          listedValue: 10,
          actualSavings: 20
        })
      ],
      today
    );

    expect(adjustments).toEqual({});
  });
});
