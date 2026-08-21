import type {
  GroceryWatchItem,
  PriceAlert,
  ReceiptEntry,
  CandidateReviews,
  ValueAlertSettings
} from "../types";

const SAVED_KEY = "savings-desk:saved";
const REDEEMED_KEY = "savings-desk:redeemed";
const REMINDERS_KEY = "savings-desk:reminders";
const PRICE_ALERTS_KEY = "savings-desk:price-alerts";
const GROCERY_WATCHLIST_KEY = "savings-desk:grocery-watchlist";
const SETTLEMENT_SAVED_KEY = "savings-desk:settlement-saved";
const SETTLEMENT_REMINDERS_KEY = "savings-desk:settlement-reminders";
const RECEIPTS_KEY = "savings-desk:receipts";
const VALUE_ALERT_SETTINGS_KEY = "savings-desk:value-alert-settings";
const ACKNOWLEDGED_VALUE_ALERTS_KEY = "savings-desk:value-alerts-acknowledged";
const CANDIDATE_REVIEWS_KEY = "savings-desk:candidate-reviews";

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
  key:
    | "saved"
    | "redeemed"
    | "reminder"
    | "settlement-saved"
    | "settlement-reminder",
  id: string
): string[] {
  const storageKey =
    key === "saved"
      ? SAVED_KEY
      : key === "redeemed"
        ? REDEEMED_KEY
        : key === "reminder"
          ? REMINDERS_KEY
          : key === "settlement-saved"
            ? SETTLEMENT_SAVED_KEY
            : SETTLEMENT_REMINDERS_KEY;
  const current = readIds(storageKey);
  const next = current.includes(id)
    ? current.filter((currentId) => currentId !== id)
    : [...current, id];
  writeIds(storageKey, next);
  return next;
}

export function readSettlementSavedIds(): string[] {
  return readIds(SETTLEMENT_SAVED_KEY);
}

export function readSettlementReminderIds(): string[] {
  return readIds(SETTLEMENT_REMINDERS_KEY);
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

export function readReceipts(): ReceiptEntry[] {
  try {
    const value = window.localStorage.getItem(RECEIPTS_KEY);
    if (value === null) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is ReceiptEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as ReceiptEntry).id === "string" &&
        typeof (entry as ReceiptEntry).merchant === "string" &&
        typeof (entry as ReceiptEntry).category === "string" &&
        typeof (entry as ReceiptEntry).occurredOn === "string" &&
        Number.isFinite((entry as ReceiptEntry).amountSpent) &&
        Number.isFinite((entry as ReceiptEntry).actualSavings)
    );
  } catch {
    return [];
  }
}

export function writeReceipts(entries: ReceiptEntry[]): ReceiptEntry[] {
  window.localStorage.setItem(RECEIPTS_KEY, JSON.stringify(entries));
  return entries;
}

export function readAcknowledgedValueAlertIds(): string[] {
  return readIds(ACKNOWLEDGED_VALUE_ALERTS_KEY);
}

export function writeAcknowledgedValueAlertIds(ids: string[]): string[] {
  writeIds(ACKNOWLEDGED_VALUE_ALERTS_KEY, ids);
  return ids;
}

export function readValueAlertSettings(
  defaults: ValueAlertSettings
): ValueAlertSettings {
  try {
    const value = window.localStorage.getItem(VALUE_ALERT_SETTINGS_KEY);
    if (value === null) return defaults;
    return JSON.parse(value) as ValueAlertSettings;
  } catch {
    return defaults;
  }
}

export function writeValueAlertSettings(
  settings: ValueAlertSettings
): ValueAlertSettings {
  window.localStorage.setItem(VALUE_ALERT_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export function readCandidateReviews(): CandidateReviews {
  try {
    const value = window.localStorage.getItem(CANDIDATE_REVIEWS_KEY);
    if (value === null) return {};
    const parsed = JSON.parse(value) as CandidateReviews;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, status]) =>
        status === "keep" || status === "dismissed"
      )
    );
  } catch {
    return {};
  }
}

export function writeCandidateReviews(reviews: CandidateReviews): CandidateReviews {
  window.localStorage.setItem(CANDIDATE_REVIEWS_KEY, JSON.stringify(reviews));
  return reviews;
}
