import preferencesData from "../data/preferences.json";
import type { Category, Opportunity, ScoredOpportunity } from "../types";

const DAY_IN_MS = 86_400_000;
const householdPreferences = preferencesData as {
  excludedKeywords: string[];
  preferredKeywords: string[];
  preferredCoffeeBrands: string[];
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function daysUntil(date: string, today: Date): number {
  const expiration = new Date(`${date}T23:59:59`);
  return Math.ceil((expiration.getTime() - today.getTime()) / DAY_IN_MS);
}

export function isExpired(opportunity: Opportunity, today = new Date()): boolean {
  if (!opportunity.expiresOn) return false;
  const expiration = new Date(`${opportunity.expiresOn}T23:59:59`);
  return expiration.getTime() < today.getTime();
}

export function isExcludedByPreferences(opportunity: Opportunity): boolean {
  const searchable = [
    opportunity.merchant,
    opportunity.title,
    opportunity.summary,
    ...opportunity.tags
  ]
    .join(" ")
    .toLowerCase();
  return householdPreferences.excludedKeywords.some((keyword) =>
    searchable.includes(keyword.toLowerCase())
  );
}

export function scoreOpportunity(
  opportunity: Opportunity,
  today = new Date()
): ScoredOpportunity {
  const verificationPoints = {
    verified: 22,
    program: 10,
    "needs-check": 0
  }[opportunity.verification];

  const frictionPenalty = {
    low: 0,
    medium: 6,
    high: 14
  }[opportunity.friction];

  const valuePoints = clamp(opportunity.estimatedSavings * 1.4, 0, 24);
  const ratePoints = clamp((opportunity.savingsRate ?? 0) * 0.45, 0, 14);
  const freePoints = opportunity.isFree ? 22 : 0;
  const categoryPreferencePoints: Record<Category, number> = {
    grocery: 14,
    restaurants: 12,
    coffee: 14,
    convenience: 10,
    auto: 14,
    movies: 10,
    sports: 8,
    "tax-free": 16,
    financial: 0,
    shopping: 6,
    entertainment: 0,
    home: -6,
    fuel: 12,
    local: -12
  };
  const freeFoodPoints =
    opportunity.isFree &&
    ["restaurants", "coffee", "convenience"].includes(opportunity.category)
      ? 12
      : 0;
  const dealTypePoints = {
    "digital-coupon": 6,
    "loyalty-reward": 5,
    "free-food": 12,
    "fuel-reward": 8,
    "convenience-reward": 7,
    "stacking-strategy": 8,
    "grand-opening": 10,
    "promotion-event": 6,
    "vehicle-maintenance": 10,
    "movie-discount": 8,
    "sports-ticket": 6,
    "tax-holiday": 10
  }[opportunity.dealType ?? "loyalty-reward"];
  const preferredCoffeeBrandPoints =
    opportunity.category === "coffee" &&
    householdPreferences.preferredCoffeeBrands.some(
      (merchant) => opportunity.merchant.toLowerCase().includes(merchant)
    )
      ? 8
      : 0;
  const searchablePreferenceText = [
    opportunity.title,
    opportunity.summary,
    ...opportunity.tags,
    ...(opportunity.preferenceSignals ?? [])
  ]
    .join(" ")
    .toLowerCase();
  const householdFitPoints = clamp(
    householdPreferences.preferredKeywords.filter((keyword) =>
      searchablePreferenceText.includes(keyword.toLowerCase())
    ).length * 3,
    0,
    12
  );
  const freshnessPoints =
    opportunity.freshness === "new"
      ? 8
      : opportunity.freshness === "improved"
        ? 6
        : 0;
  const spendPenalty =
    opportunity.minimumSpend > 0
      ? clamp(opportunity.minimumSpend / Math.max(opportunity.estimatedSavings, 1), 0, 10)
      : 0;

  let urgencyPoints = 0;
  if (opportunity.expiresOn) {
    const remainingDays = daysUntil(opportunity.expiresOn, today);
    if (remainingDays >= 0 && remainingDays <= 3) urgencyPoints = 14;
    else if (remainingDays <= 7) urgencyPoints = 10;
    else if (remainingDays <= 14) urgencyPoints = 5;
  }

  const rawScore =
    28 +
    verificationPoints +
    valuePoints +
    ratePoints +
    freePoints +
    categoryPreferencePoints[opportunity.category] +
    freeFoodPoints +
    dealTypePoints +
    preferredCoffeeBrandPoints +
    freshnessPoints +
    householdFitPoints +
    urgencyPoints -
    frictionPenalty -
    spendPenalty;

  const score = Math.round(clamp(rawScore, 0, 100));
  const scoreLabel =
    score >= 85
      ? "Excellent"
      : score >= 70
        ? "Strong"
        : score >= 50
          ? "Worth a look"
          : "Low priority";

  return { ...opportunity, score, scoreLabel };
}

export function rankOpportunities(
  opportunities: Opportunity[],
  today = new Date()
): ScoredOpportunity[] {
  return opportunities
    .filter(
      (opportunity) =>
        !isExpired(opportunity, today) && !isExcludedByPreferences(opportunity)
    )
    .map((opportunity) => scoreOpportunity(opportunity, today))
    .sort((first, second) => second.score - first.score);
}

export function startOfWeek(date = new Date()): Date {
  const result = new Date(date);
  const day = result.getDay();
  const distanceFromMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + distanceFromMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}
