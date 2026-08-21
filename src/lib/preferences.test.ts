import { describe, expect, it } from "vitest";
import type { ReceiptEntry } from "../types";
import { buildLearnedPreferences } from "./preferences";

const today = new Date("2026-08-21T12:00:00");

function receipt(overrides: Partial<ReceiptEntry>): ReceiptEntry {
  return {
    id: overrides.id ?? "receipt",
    merchant: "Test Merchant",
    category: "grocery",
    occurredOn: "2026-08-20",
    amountSpent: 10,
    actualSavings: 10,
    ...overrides
  };
}

describe("learned savings preferences", () => {
  it("returns neutral evidence when no receipts exist", () => {
    const learned = buildLearnedPreferences([], today);

    expect(learned.categoryAffinity.grocery).toBe(0);
    expect(learned.categoryEvidence.grocery.count).toBe(0);
  });

  it("boosts a category that repeatedly produces confirmed savings", () => {
    const learned = buildLearnedPreferences(
      [
        receipt({ id: "one", category: "grocery", actualSavings: 8 }),
        receipt({ id: "two", category: "grocery", actualSavings: 10 }),
        receipt({ id: "three", category: "fuel", actualSavings: 0 })
      ],
      today
    );

    expect(learned.categoryAffinity.grocery).toBeGreaterThan(
      learned.categoryAffinity.fuel
    );
    expect(learned.categoryAffinity.grocery).toBeGreaterThan(0);
  });

  it("does not demote a category from one zero-value result", () => {
    const learned = buildLearnedPreferences(
      [receipt({ id: "only", category: "movies", actualSavings: 0 })],
      today
    );

    expect(learned.categoryAffinity.movies).toBe(0);
  });

  it("recognizes a merchant with repeated confirmed value", () => {
    const learned = buildLearnedPreferences(
      [
        receipt({ id: "one", merchant: "H-E-B", actualSavings: 9 }),
        receipt({ id: "two", merchant: "h-e-b ", actualSavings: 7 })
      ],
      today
    );

    expect(learned.merchantAffinity["h-e-b"]).toBeGreaterThan(0);
    expect(learned.merchantEvidence["h-e-b"].confirmedSavings).toBe(16);
  });
});
