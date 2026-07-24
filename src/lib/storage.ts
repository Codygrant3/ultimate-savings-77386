import type { GroceryWatchItem, PriceAlert } from "../types";

const SAVED_KEY = "savings-desk:saved";
const REDEEMED_KEY = "savings-desk:redeemed";
const REMINDERS_KEY = "savings-desk:reminders";
const PRICE_ALERTS_KEY = "savings-desk:price-alerts";
const GROCERY_WATCHLIST_KEY = "savings-desk:grocery-watchlist";

function readIds(key: string): string[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  window.localStorage.setItem(key, JSON.stringify(ids));
}

export function readSavedIds(): string[] {
  return readIds(SAVED_KEY);
}

export function readRedeemedIds(): string[] {
  return readIds(REDEEMED_KEY);
}

export function readReminderIds(): string[] {
  return readIds(REMINDERS_KEY);
}

export function toggleStoredId(
  key: "saved" | "redeemed" | "reminder",
  id: string
): string[] {
  const storageKey =
    key === "saved"
      ? SAVED_KEY
      : key === "redeemed"
        ? REDEEMED_KEY
        : REMINDERS_KEY;
  const current = readIds(storageKey);
  const next = current.includes(id)
    ? current.filter((currentId) => currentId !== id)
    : [...current, id];
  writeIds(storageKey, next);
  return next;
}

export function readPriceAlerts(defaults: PriceAlert[]): PriceAlert[] {
  try {
    const value = window.localStorage.getItem(PRICE_ALERTS_KEY);
    if (value === null) {
      window.localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(value) as PriceAlert[];
  } catch {
    return defaults;
  }
}

export function writePriceAlerts(alerts: PriceAlert[]): PriceAlert[] {
  window.localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(alerts));
  return alerts;
}

export function readGroceryWatchlist(
  defaults: GroceryWatchItem[]
): GroceryWatchItem[] {
  try {
    const value = window.localStorage.getItem(GROCERY_WATCHLIST_KEY);
    if (value === null) {
      window.localStorage.setItem(GROCERY_WATCHLIST_KEY, JSON.stringify(defaults));
      return defaults;
    }

    const stored = JSON.parse(value) as GroceryWatchItem[];
    const refreshedDefaults = new Map(defaults.map((item) => [item.id, item]));
    return stored.map((item) => {
      const refreshed = refreshedDefaults.get(item.id);
      return refreshed
        ? {
            ...item,
            latestPrice: refreshed.latestPrice,
            retailer: refreshed.retailer,
            sourceLabel: refreshed.sourceLabel,
            sourceUrl: refreshed.sourceUrl,
            checkedOn: refreshed.checkedOn,
            locationStatus: refreshed.locationStatus
          }
        : item;
    });
  } catch {
    return defaults;
  }
}

export function writeGroceryWatchlist(
  items: GroceryWatchItem[]
): GroceryWatchItem[] {
  window.localStorage.setItem(GROCERY_WATCHLIST_KEY, JSON.stringify(items));
  return items;
}
