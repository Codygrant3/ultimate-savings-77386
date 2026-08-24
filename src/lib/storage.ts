import type {
  GroceryWatchItem,
  PriceAlert,
  ReceiptEntry,
  ScoringWeights,
  CandidateReviews,
  ValueAlertSettings,
  WeeklyPlanSettings,
  HouseholdProfile,
  Opportunity
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
const WEEKLY_PLAN_SETTINGS_KEY = "savings-desk:weekly-plan-settings";
const SCORING_WEIGHTS_KEY = "savings-desk:scoring-weights";
const HOUSEHOLD_PROFILE_KEY = "savings-desk:household-profile";
const LOCAL_OFFERS_KEY = "savings-desk:local-offers";

const MAX_STORED_IDS = 1_000;
const MAX_LOCAL_OFFERS = 1_000;
const LOCAL_CATEGORIES = new Set([
  "restaurants",
  "grocery",
  "fuel",
  "coffee",
  "convenience",
  "auto",
  "movies",
  "sports",
  "tax-free",
  "shopping"
]);
const FRICTION_LEVELS = new Set(["low", "medium", "high"]);
const STACK_STATUSES = new Set(["compatible", "conditional", "exclusive"]);

function normalizeStoredIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    )
  ).slice(0, MAX_STORED_IDS);
}

function readIds(key: string): string[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? normalizeStoredIds(JSON.parse(value)) : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  window.localStorage.setItem(key, JSON.stringify(normalizeStoredIds(ids)));
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

export function removeStoredId(
  key: "saved" | "redeemed" | "reminder",
  id: string
): string[] {
  const storageKey =
    key === "saved"
      ? SAVED_KEY
      : key === "redeemed"
        ? REDEEMED_KEY
        : REMINDERS_KEY;
  const next = readIds(storageKey).filter((currentId) => currentId !== id);
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

export function readWeeklyPlanSettings(
  defaults: WeeklyPlanSettings
): WeeklyPlanSettings {
  try {
    const value = window.localStorage.getItem(WEEKLY_PLAN_SETTINGS_KEY);
    if (value === null) return defaults;
    return { ...defaults, ...(JSON.parse(value) as Partial<WeeklyPlanSettings>) };
  } catch {
    return defaults;
  }
}

export function writeWeeklyPlanSettings(
  settings: WeeklyPlanSettings
): WeeklyPlanSettings {
  window.localStorage.setItem(
    WEEKLY_PLAN_SETTINGS_KEY,
    JSON.stringify(settings)
  );
  return settings;
}

export function readScoringWeights(
  defaults: ScoringWeights
): ScoringWeights {
  try {
    const value = window.localStorage.getItem(SCORING_WEIGHTS_KEY);
    if (value === null) return defaults;
    return { ...defaults, ...(JSON.parse(value) as Partial<ScoringWeights>) };
  } catch {
    return defaults;
  }
}

export function writeScoringWeights(weights: ScoringWeights): ScoringWeights {
  window.localStorage.setItem(SCORING_WEIGHTS_KEY, JSON.stringify(weights));
  return weights;
}

export function readHouseholdProfile(
  defaults: HouseholdProfile
): HouseholdProfile {
  try {
    const value = window.localStorage.getItem(HOUSEHOLD_PROFILE_KEY);
    if (value === null) return defaults;

    const parsed = JSON.parse(value) as Partial<HouseholdProfile>;
    return {
      excludedKeywords: Array.isArray(parsed.excludedKeywords)
        ? parsed.excludedKeywords.filter(
            (keyword): keyword is string => typeof keyword === "string"
          )
        : defaults.excludedKeywords,
      highPriorityKeywords: Array.isArray(parsed.highPriorityKeywords)
        ? parsed.highPriorityKeywords.filter(
            (keyword): keyword is string => typeof keyword === "string"
          )
        : defaults.highPriorityKeywords,
      preferredKeywords: Array.isArray(parsed.preferredKeywords)
        ? parsed.preferredKeywords.filter(
            (keyword): keyword is string => typeof keyword === "string"
          )
        : defaults.preferredKeywords
    };
  } catch {
    return defaults;
  }
}

export function writeHouseholdProfile(
  profile: HouseholdProfile
): HouseholdProfile {
  window.localStorage.setItem(HOUSEHOLD_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function isValidStoredDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime());
}

function isOfficialUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeStackGroup(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9]|[a-z0-9])$/.test(value)
  );
}

function isLocalOffer(value: unknown): value is Opportunity {
  if (typeof value !== "object" || value === null) return false;
  const offer = value as Partial<Opportunity>;

  return (
    typeof offer.id === "string" &&
    offer.id.startsWith("local-") &&
    offer.id.length >= 7 &&
    offer.id.length <= 120 &&
    typeof offer.merchant === "string" &&
    offer.merchant.trim().length > 0 &&
    offer.merchant.length <= 120 &&
    typeof offer.title === "string" &&
    offer.title.trim().length > 0 &&
    offer.title.length <= 240 &&
    typeof offer.summary === "string" &&
    offer.summary.length <= 1_000 &&
    typeof offer.category === "string" &&
    LOCAL_CATEGORIES.has(offer.category) &&
    typeof offer.isFree === "boolean" &&
    typeof offer.estimatedSavings === "number" &&
    Number.isFinite(offer.estimatedSavings) &&
    offer.estimatedSavings >= 0 &&
    (!offer.isFree || offer.estimatedSavings >= 0) &&
    (offer.isFree || offer.estimatedSavings > 0) &&
    typeof offer.minimumSpend === "number" &&
    Number.isFinite(offer.minimumSpend) &&
    offer.minimumSpend >= 0 &&
    typeof offer.locationNote === "string" &&
    offer.locationNote.length <= 500 &&
    offer.verification === "verified" &&
    typeof offer.friction === "string" &&
    FRICTION_LEVELS.has(offer.friction) &&
    Array.isArray(offer.tags) &&
    offer.tags.every((tag) => typeof tag === "string" && tag.length <= 60) &&
    isValidStoredDate(offer.source?.checkedOn) &&
    typeof offer.source?.label === "string" &&
    offer.source.label.length <= 160 &&
    isOfficialUrl(offer.source?.url) &&
    typeof offer.actionLabel === "string" &&
    offer.actionLabel.length <= 120 &&
    (offer.savingsRate === undefined ||
      (Number.isFinite(offer.savingsRate) &&
        offer.savingsRate > 0 &&
        offer.savingsRate <= 100)) &&
    (offer.distanceMiles === undefined ||
      (Number.isFinite(offer.distanceMiles) &&
        offer.distanceMiles >= 0 &&
        offer.distanceMiles <= 50)) &&
    (offer.expiresOn === undefined || isValidStoredDate(offer.expiresOn)) &&
    (offer.stackGroup === undefined || isSafeStackGroup(offer.stackGroup)) &&
    (offer.stackStatus === undefined ||
      (typeof offer.stackStatus === "string" &&
        STACK_STATUSES.has(offer.stackStatus))) &&
    (offer.tier === undefined || offer.tier === "A") &&
    offer.localRecord === true
  );
}

function normalizeLocalOffers(value: unknown): Opportunity[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const offers: Opportunity[] = [];

  for (const item of value) {
    if (!isLocalOffer(item)) continue;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    offers.push(item);
    if (offers.length >= MAX_LOCAL_OFFERS) break;
  }

  return offers;
}

export function readLocalOffers(): Opportunity[] {
  try {
    const value = window.localStorage.getItem(LOCAL_OFFERS_KEY);
    if (value === null) return [];
    return normalizeLocalOffers(JSON.parse(value));
  } catch {
    return [];
  }
}

export function writeLocalOffers(offers: Opportunity[]): Opportunity[] {
  const validOffers = normalizeLocalOffers(offers);
  window.localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify(validOffers));
  return validOffers;
}
