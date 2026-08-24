// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  readAcknowledgedValueAlertIds,
  readSavedIds,
  removeStoredId,
  toggleStoredId
} from "./storage";

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
