import preferencesData from "../data/preferences.json";
import { resolveOpportunityDistance } from "./distance";
import type {
  Category,
  LocalMerchantInventory,
  Opportunity,
  LearnedPreferences,
  ScoringWeights,
  PreferenceEvidence,
  ScoreFactor,
  ScoredOpportunity
} from "../types";

const DAY_IN_MS = 86_400_000;
const householdPreferences = preferencesData as {
  household: {
    profile: string;
    childLifeStages: string[];
    hasBaby: boolean;
  };
  excludedKeywords: string[];
  highPriorityKeywords: string[];
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

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function learnedHistoryDetail(
  evidence: PreferenceEvidence | undefined
): string {
  if (!evidence || evidence.count <= 0) return "";
  const count = Math.round(evidence.count);
  return `Learned history: ${count} result${count === 1 ? "" : "s"}, ${money(
    evidence.confirmedSavings
  )} confirmed`;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  evidence: 18,
  dollarValue: 24,
  savingsRate: 6,
  householdFit: 10,
  localRelevance: 8,
  timing: 10,
  effort: 9,
  requiredSpend: 8,
  stackability: 7
};

const SCORING_WEIGHT_KEYS = [
  "evidence",
  "dollarValue",
  "savingsRate",
  "householdFit",
  "localRelevance",
  "timing",
  "effort",
  "requiredSpend",
  "stackability"
] as const;

export function effectiveScoringWeights(
  rawWeights?: Partial<ScoringWeights>
): ScoringWeights {
  if (!rawWeights) return DEFAULT_SCORING_WEIGHTS;

  const bounded: ScoringWeights = {
    evidence: 0,
    dollarValue: 0,
    savingsRate: 0,
    householdFit: 0,
    localRelevance: 0,
    timing: 0,
    effort: 0,
    requiredSpend: 0,
    stackability: 0
  };
  for (const key of SCORING_WEIGHT_KEYS) {
    const parsed = Number(rawWeights[key]);
    bounded[key] = Number.isFinite(parsed) ? clamp(parsed, 0, 50) : 0;
  }
  const total = SCORING_WEIGHT_KEYS.reduce(
    (sum, key) => sum + bounded[key],
    0
  );
  if (total <= 0) return DEFAULT_SCORING_WEIGHTS;

  const scaled = SCORING_WEIGHT_KEYS.map((key) => (bounded[key] / total) * 100);
  const normalized = scaled.map((weight) => Math.floor(weight));
  let remaining = 100 - normalized.reduce((sum, weight) => sum + weight, 0);
  const remainderOrder = scaled
    .map((weight, index) => ({ index, fraction: weight - Math.floor(weight) }))
    .sort((first, second) => second.fraction - first.fraction);

  for (
    let index = 0;
    index < remainderOrder.length && remaining > 0;
    index += 1
  ) {
    normalized[remainderOrder[index].index] += 1;
    remaining -= 1;
  }

  return {
    evidence: normalized[0],
    dollarValue: normalized[1],
    savingsRate: normalized[2],
    householdFit: normalized[3],
    localRelevance: normalized[4],
    timing: normalized[5],
    effort: normalized[6],
    requiredSpend: normalized[7],
    stackability: normalized[8]
  };
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
    ...opportunity.tags,
    ...(opportunity.preferenceSignals ?? [])
  ]
    .join(" ")
    .toLowerCase();
  return householdPreferences.excludedKeywords.some((keyword) =>
    searchable.includes(keyword.toLowerCase())
  );
}

function sourceAgeDays(
  opportunity: Opportunity,
  today: Date
): number | null {
  const checkedOn = new Date(`${opportunity.source.checkedOn}T12:00:00`);
  if (Number.isNaN(checkedOn.getTime())) return null;
  return Math.max(
    0,
    Math.floor((today.getTime() - checkedOn.getTime()) / DAY_IN_MS)
  );
}

function evidenceLabel(opportunity: Opportunity): string {
  if (opportunity.verification === "verified") return "Official source verified";
  if (opportunity.verification === "program") return "Official ongoing program";
  return "Unverified lead";
}

function evidenceQuality(
  opportunity: Opportunity,
  today: Date
): { value: number; detail: string } {
  const statusQuality = {
    verified: 100,
    program: 45,
    "needs-check": 10
  }[opportunity.verification];
  const age = sourceAgeDays(opportunity, today);

  if (age === null) {
    return {
      value: Math.round(statusQuality * 0.7),
      detail: `${evidenceLabel(opportunity)}; source-check date missing`
    };
  }

  const ageQuality =
    age <= 3 ? 100 : age <= 7 ? 85 : age <= 14 ? 65 : age <= 30 ? 40 : 15;
  return {
    value: Math.round(statusQuality * (ageQuality / 100)),
    detail: `${evidenceLabel(opportunity)}; checked ${age} ${
      age === 1 ? "day" : "days"
    } ago`
  };
}

function valueQuality(opportunity: Opportunity): { value: number; detail: string } {
  const dollarValue = Math.round(
    clamp(
      (Math.log1p(Math.max(0, opportunity.estimatedSavings)) /
        Math.log1p(50)) *
        100,
      0,
      100
    )
  );
  const freeFloor = opportunity.isFree ? 55 : 0;
  const basis = opportunity.isFree
    ? `free reward${
        opportunity.estimatedSavings > 0
          ? ` plus ${money(opportunity.estimatedSavings)} estimate`
          : ""
      }`
    : `${money(opportunity.estimatedSavings)} estimated value`;
  return {
    value: Math.max(dollarValue, freeFloor),
    detail: basis
  };
}

function householdFit(
  opportunity: Opportunity,
  learned?: LearnedPreferences
): { value: number; detail: string } {
  const categoryFit: Record<Category, number> = {
    grocery: 82,
    restaurants: 72,
    coffee: 84,
    convenience: 64,
    auto: 80,
    movies: 62,
    sports: 58,
    "tax-free": 86,
    financial: 24,
    shopping: 42,
    entertainment: 22,
    home: 12,
    fuel: 74,
    local: 8
  };
  const searchable = [
    opportunity.title,
    opportunity.summary,
    ...opportunity.tags,
    ...(opportunity.preferenceSignals ?? [])
  ]
    .join(" ")
    .toLowerCase();
  const preferredMatches = householdPreferences.preferredKeywords.filter(
    (keyword) => searchable.includes(keyword.toLowerCase())
  ).length;
  const highPriorityMatches = householdPreferences.highPriorityKeywords.filter(
    (keyword) => searchable.includes(keyword.toLowerCase())
  ).length;
  const matched = [
    ...householdPreferences.highPriorityKeywords,
    ...householdPreferences.preferredKeywords
  ]
    .filter((keyword) => searchable.includes(keyword.toLowerCase()))
    .slice(0, 3);

  const categoryAffinity = learned?.categoryAffinity[opportunity.category] ?? 0;
  const merchantAffinity =
    learned?.merchantAffinity[opportunity.merchant.trim().toLowerCase()] ?? 0;
  const categoryEvidence = learned?.categoryEvidence[opportunity.category];
  const learnedDetail = learnedHistoryDetail(categoryEvidence);

  return {
    value: Math.round(
      clamp(
        categoryFit[opportunity.category] +
          preferredMatches * 4 +
          highPriorityMatches * 7 +
          categoryAffinity * 30 +
          merchantAffinity * 20,
        0,
        100
      )
    ),
    detail:
      matched.length > 0
        ? `Household match: ${matched.join(", ")}`
        : "General household priority" + (learnedDetail ? `; ${learnedDetail}` : "")
  };
}

function localRelevance(
  opportunity: Opportunity,
  inventory?: LocalMerchantInventory
): {
  value: number;
  detail: string;
  distanceMiles?: number;
  distanceBasis: "offer" | "merchant-location" | "unknown";
} {
  const resolved =
    opportunity.distanceMiles !== undefined
      ? null
      : resolveOpportunityDistance(opportunity, inventory);
  const distance = opportunity.distanceMiles ?? resolved?.distanceMiles;

  if (distance === undefined) {
    return {
      value: 55,
      detail: "Location not distance-confirmed",
      distanceBasis: "unknown"
    };
  }

  const value =
    distance <= 1
      ? 100
      : distance <= 3
        ? 92
        : distance <= 5
          ? 82
          : distance <= 10
            ? 68
            : distance <= 20
              ? 40
              : 10;

  if (resolved) {
    return {
      value: Math.round(value * 0.75),
      detail: `~${distance} miles to ${resolved.locationName}; offer participation unconfirmed`,
      distanceMiles: distance,
      distanceBasis: "merchant-location"
    };
  }

  return {
    value,
    detail: `${distance} miles from 77386`,
    distanceMiles: distance,
    distanceBasis: "offer"
  };
}

function timingQuality(
  opportunity: Opportunity,
  today: Date
): { value: number; detail: string } {
  let urgency = 35;
  let urgencyDetail = "No stated end date";
  if (opportunity.expiresOn) {
    const remaining = daysUntil(opportunity.expiresOn, today);
    if (remaining < 0) {
      urgency = 0;
      urgencyDetail = "Expired";
    } else if (remaining <= 3) {
      urgency = 100;
      urgencyDetail = `Ends in ${remaining} ${remaining === 1 ? "day" : "days"}`;
    } else if (remaining <= 7) {
      urgency = 78;
      urgencyDetail = `Ends in ${remaining} days`;
    } else if (remaining <= 14) {
      urgency = 55;
      urgencyDetail = `Ends in ${remaining} days`;
    } else {
      urgency = 30;
      urgencyDetail = `Ends ${opportunity.expiresOn}`;
    }
  }

  const freshness =
    opportunity.freshness === "new"
      ? 100
      : opportunity.freshness === "improved"
        ? 88
        : opportunity.freshness === "current"
          ? 70
          : 45;
  const freshnessDetail =
    opportunity.freshness === "new"
      ? "newly found"
      : opportunity.freshness === "improved"
        ? "recently improved"
        : opportunity.freshness === "monitoring"
          ? "monitoring only"
          : "current";

  return {
    value: Math.round(urgency * 0.7 + freshness * 0.3),
    detail: `${urgencyDetail}; ${freshnessDetail}`
  };
}

function effortQuality(opportunity: Opportunity): { value: number; detail: string } {
  return {
    value: { low: 100, medium: 60, high: 20 }[opportunity.friction],
    detail: `${opportunity.friction} redemption effort`
  };
}

function spendEfficiency(opportunity: Opportunity): { value: number; detail: string } {
  if (opportunity.minimumSpend <= 0) {
    return { value: 100, detail: "No required spend" };
  }
  const ratio =
    opportunity.minimumSpend / Math.max(opportunity.estimatedSavings, 0.01);
  const value =
    ratio <= 1
      ? 95
      : ratio <= 2
        ? 80
        : ratio <= 5
          ? 55
          : ratio <= 10
            ? 30
            : 10;
  return {
    value,
    detail: `${money(opportunity.minimumSpend)} required per ${money(
      opportunity.estimatedSavings
    )} saved`
  };
}

function stackability(opportunity: Opportunity): { value: number; detail: string } {
  if (opportunity.stackNote) {
    return { value: 100, detail: "Compatible stack documented" };
  }

  const dealTypeValue: Record<NonNullable<Opportunity["dealType"]>, number> = {
    "stacking-strategy": 90,
    "fuel-reward": 75,
    "digital-coupon": 68,
    "loyalty-reward": 60,
    "convenience-reward": 58,
    "free-food": 42,
    "grand-opening": 38,
    "promotion-event": 34,
    "vehicle-maintenance": 32,
    "movie-discount": 30,
    "sports-ticket": 28,
    "tax-holiday": 26
  };
  return {
    value: opportunity.dealType ? dealTypeValue[opportunity.dealType] : 25,
    detail: "No compatible stack documented"
  };
}

export function scoreOpportunity(
  opportunity: Opportunity,
  today = new Date(),
  learned?: LearnedPreferences,
  inventory?: LocalMerchantInventory,
  rawScoringWeights?: Partial<ScoringWeights>
): ScoredOpportunity {
  const proximity = localRelevance(opportunity, inventory);
  const selectedWeights = effectiveScoringWeights(rawScoringWeights);
  const factors = [
    evidenceQuality(opportunity, today),
    valueQuality(opportunity),
    {
      value: clamp((opportunity.savingsRate ?? 0) * 2, 0, 100),
      detail:
        opportunity.savingsRate !== undefined
          ? `${opportunity.savingsRate}% saved`
          : "Savings rate not published"
    },
    householdFit(opportunity, learned),
    proximity,
    timingQuality(opportunity, today),
    effortQuality(opportunity),
    spendEfficiency(opportunity),
    stackability(opportunity)
  ];
  const weights = [
    selectedWeights.evidence,
    selectedWeights.dollarValue,
    selectedWeights.savingsRate,
    selectedWeights.householdFit,
    selectedWeights.localRelevance,
    selectedWeights.timing,
    selectedWeights.effort,
    selectedWeights.requiredSpend,
    selectedWeights.stackability
  ];
  const labels = [
    "Evidence",
    "Dollar value",
    "Savings rate",
    "Household fit",
    "Local relevance",
    "Timing",
    "Effort",
    "Required spend",
    "Stackability"
  ];
  const scoreBreakdown: ScoreFactor[] = factors.map((factor, index) => ({
    label: labels[index],
    points: factor.value * (weights[index] / 100),
    weight: weights[index],
    detail: factor.detail
  }));
  const score = Math.round(
    clamp(
      scoreBreakdown.reduce((total, factor) => total + factor.points, 0),
      0,
      100
    )
  );
  const scoreLabel =
    score >= 88
      ? "Excellent"
      : score >= 72
        ? "Strong"
        : score >= 50
          ? "Worth a look"
          : "Low priority";

  return {
    ...opportunity,
    ...(proximity.distanceMiles !== undefined
      ? { distanceMiles: proximity.distanceMiles }
      : {}),
    score,
    scoreLabel,
    scoreBreakdown
  };
}

export function rankOpportunities(
  opportunities: Opportunity[],
  today = new Date(),
  learned?: LearnedPreferences,
  inventory?: LocalMerchantInventory,
  scoringWeights?: Partial<ScoringWeights>
): ScoredOpportunity[] {
  return opportunities
    .filter(
      (opportunity) =>
        !isExpired(opportunity, today) && !isExcludedByPreferences(opportunity)
    )
    .map((opportunity) =>
      scoreOpportunity(
        opportunity,
        today,
        learned,
        inventory,
        scoringWeights
      )
    )
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      if (second.estimatedSavings !== first.estimatedSavings) {
        return second.estimatedSavings - first.estimatedSavings;
      }
      const firstDistance = first.distanceMiles ?? Number.POSITIVE_INFINITY;
      const secondDistance = second.distanceMiles ?? Number.POSITIVE_INFINITY;
      if (firstDistance !== secondDistance) {
        return firstDistance - secondDistance;
      }
      return `${first.merchant} ${first.title}`.localeCompare(
        `${second.merchant} ${second.title}`
      );
    });
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

export function formatDate(date?: string): string {
  if (!date) return "Ongoing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}
