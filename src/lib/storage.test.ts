// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  readAcknowledgedValueAlertIds,
  readLocalOffers,
  readSavedIds,
  removeStoredId,
  toggleStoredId,
  writeLocalOffers
} from "./storage";
import type { Opportunity } from "../types";

function setRawIds(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

describe("stored execution IDs", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("filters and deduplicates corrupted saved-offer arrays", () => {
    setRawIds("savings-desk:saved", [7, "offer-b", null, "", "offer-a", "offer-b"]);

    expect(readSavedIds()).toEqual(["offer-b", "offer-a"]);
  });

  it("treats a corrupted acknowledged-alert array as empty", () => {
    setRawIds("savings-desk:value-alerts-acknowledged", { offer: true });

    expect(readAcknowledgedValueAlertIds()).toEqual([]);
  });

  it("repairs existing IDs when saving a new offer", () => {
    setRawIds("savings-desk:saved", ["offer-a", 42, "offer-a"]);

    expect(toggleStoredId("saved", "offer-b")).toEqual([
      "offer-a",
      "offer-b"
    ]);
    expect(readSavedIds()).toEqual(["offer-a", "offer-b"]);
  });

  it("removes only the requested used-offer ID", () => {
    window.localStorage.setItem(
      "savings-desk:redeemed",
      JSON.stringify(["offer-a", "offer-b"])
    );

    expect(removeStoredId("redeemed", "offer-a")).toEqual(["offer-b"]);
    expect(readAcknowledgedValueAlertIds()).toEqual([]);
  });
});

describe("stored locally captured offers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const validOffer = {
    id: "local-valid-offer",
    merchant: "Local Market",
    title: "$5 off a $20 planned basket",
    summary: "Terms were manually confirmed from the linked official source.",
    category: "grocery",
    estimatedSavings: 5,
    minimumSpend: 20,
    isFree: false,
    locationNote: "Official terms confirmed on this device.",
    verification: "verified",
    friction: "low",
    tags: ["locally recorded"],
    source: {
      label: "Local Market official page",
      url: "https://example.com/offer",
      checkedOn: "2026-08-24"
    },
    actionLabel: "Review confirmed terms",
    tier: "A",
    dealType: "digital-coupon",
    freshness: "new",
    discoveredOn: "2026-08-24",
    preferenceSignals: ["user-verified"],
    localRecord: true
  } as unknown as Opportunity;

  it("filters semantically invalid records while keeping valid history", () => {
    const corrupted = {
      ...validOffer,
      id: "local-corrupt-offer",
      category: "financial",
      estimatedSavings: -2,
      friction: "extreme",
      expiresOn: "2026-02-31",
      distanceMiles: 99,
      stackGroup: "not safe!"
    } as unknown as Opportunity;

    window.localStorage.setItem(
      "savings-desk:local-offers",
      JSON.stringify([corrupted, validOffer])
    );

    expect(readLocalOffers()).toEqual([validOffer]);
  });

  it("deduplicates IDs and blocks invalid records on write", () => {
    const duplicate = { ...validOffer } as Opportunity;
    const malformed = { id: 7 } as unknown as Opportunity;

    expect(writeLocalOffers([duplicate, validOffer, malformed])).toEqual([
      validOffer
    ]);
    expect(readLocalOffers()).toEqual([validOffer]);
  });
});
