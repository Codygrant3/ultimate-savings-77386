import type {
  PlannedDeal,
  PlannedTrip,
  ScoredOpportunity,
  WeeklyPlan,
  WeeklyConstraintCheck,
  WeeklyConstraintCheckKey,
  WeeklyPlanSettings
} from "../types";
import type { OfferOutcomeAdjustments } from "./outcomes";
import {
  effectiveStackCompatibility,
  formatCurrency,
  matchesHighPriorityProfile
} from "./scoring";

type BaseWeeklyPlan = Omit<WeeklyPlan, "constraintChecks">;

export const DEFAULT_WEEKLY_PLAN_SETTINGS: WeeklyPlanSettings = {
  weeklyBudget: 100,
  maxTrips: 3,
  maxDistanceMiles: 10,
  travelCostPerMile: 0,
  maximumSourceAgeDays: 14,
  minimumValuePerDollar: 0,
  minimumDaysRemaining: 0,
  maximumFriction: "medium",
  includeUnconfirmedLocations: true,
  requireLocalParticipation: false,
  requireHighPriorityFit: false,
  requireMeasuredDollarValue: false,
  allowConditionalStacking: false,
  maxDealsPerTrip: 3,
  planObjective: "balanced",
  tripOrder: "utility"
};

interface DealCandidate {
  opportunity: ScoredOpportunity;
  warnings: string[];
  planningMerchant: string;
  newCustomerOffer: boolean;
  stackGroup?: string;
  outcomeAdjustment: number;
  evidenceFactor: number;
  timingFactor: number;
}

interface TripBundle {
  merchantKey: string;
  merchant: string;
  distanceMiles?: number;
  distanceConfirmed: boolean;
  hasUnconfirmedLocationDeal: boolean;
  hasUnconfirmedParticipationDeal: boolean;
  requiredSpend: number;
  estimatedSavings: number;
  calibratedSavings: number;
  riskAdjustedSavings: number;
  evidenceConfidence: number;
  timingPriority: number;
  estimatedTravelCost?: number;
  netBenefitAfterTravel?: number | null;
  utility: number;
  deals: DealCandidate[];
  warnings: string[];
}

function normalizeSettings(settings: Partial<WeeklyPlanSettings>): WeeklyPlanSettings {
  const bounded = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : fallback;
  };

  return {
    weeklyBudget: bounded(
      settings.weeklyBudget,
      DEFAULT_WEEKLY_PLAN_SETTINGS.weeklyBudget,
      0,
      500
    ),
    maxTrips: Math.round(
      bounded(settings.maxTrips, DEFAULT_WEEKLY_PLAN_SETTINGS.maxTrips, 1, 8)
    ),
    maxDistanceMiles: bounded(
      settings.maxDistanceMiles,
      DEFAULT_WEEKLY_PLAN_SETTINGS.maxDistanceMiles,
      1,
      50
    ),
    travelCostPerMile: bounded(
      settings.travelCostPerMile,
      DEFAULT_WEEKLY_PLAN_SETTINGS.travelCostPerMile,
      0,
      5
    ),
    maximumSourceAgeDays: Math.round(
      bounded(
        settings.maximumSourceAgeDays,
        DEFAULT_WEEKLY_PLAN_SETTINGS.maximumSourceAgeDays,
        1,
        90
      )
    ),
    minimumValuePerDollar: bounded(
      settings.minimumValuePerDollar,
      DEFAULT_WEEKLY_PLAN_SETTINGS.minimumValuePerDollar,
      0,
      10
    ),
    minimumDaysRemaining: Math.round(
      bounded(
        settings.minimumDaysRemaining,
        DEFAULT_WEEKLY_PLAN_SETTINGS.minimumDaysRemaining,
        0,
        30
      )
    ),
    maximumFriction: ["low", "medium", "any"].includes(
      settings.maximumFriction as string
    )
      ? (settings.maximumFriction as WeeklyPlanSettings["maximumFriction"])
      : DEFAULT_WEEKLY_PLAN_SETTINGS.maximumFriction,
    includeUnconfirmedLocations:
      typeof settings.includeUnconfirmedLocations === "boolean"
        ? settings.includeUnconfirmedLocations
        : DEFAULT_WEEKLY_PLAN_SETTINGS.includeUnconfirmedLocations,
    requireLocalParticipation:
      typeof settings.requireLocalParticipation === "boolean"
        ? settings.requireLocalParticipation
        : DEFAULT_WEEKLY_PLAN_SETTINGS.requireLocalParticipation,
    requireHighPriorityFit:
      typeof settings.requireHighPriorityFit === "boolean"
        ? settings.requireHighPriorityFit
        : DEFAULT_WEEKLY_PLAN_SETTINGS.requireHighPriorityFit,
    requireMeasuredDollarValue:
      typeof settings.requireMeasuredDollarValue === "boolean"
        ? settings.requireMeasuredDollarValue
        : DEFAULT_WEEKLY_PLAN_SETTINGS.requireMeasuredDollarValue,
    allowConditionalStacking:
      typeof settings.allowConditionalStacking === "boolean"
        ? settings.allowConditionalStacking
        : DEFAULT_WEEKLY_PLAN_SETTINGS.allowConditionalStacking,
    maxDealsPerTrip: Math.round(
      bounded(
        settings.maxDealsPerTrip,
        DEFAULT_WEEKLY_PLAN_SETTINGS.maxDealsPerTrip,
        1,
        5
      )
    ),
    planObjective: ["balanced", "cash", "efficiency"].includes(
      settings.planObjective as string
    )
      ? (settings.planObjective as WeeklyPlanSettings["planObjective"])
      : DEFAULT_WEEKLY_PLAN_SETTINGS.planObjective,
    tripOrder: settings.tripOrder === "distance" ? "distance" : "utility"
  };
}

function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function planningMerchant(opportunity: ScoredOpportunity): string {
  const withoutPaymentBrand = opportunity.merchant.includes("+")
    ? opportunity.merchant.split("+")[0]
    : opportunity.merchant;
  return withoutPaymentBrand.replace(/\s+(?:Rewards\+?|Fuel)$/i, "").trim();
}

function objectiveLabel(objective: WeeklyPlanSettings["planObjective"]): string {
  return {
    balanced: "balanced evidence, value, fit, effort, and travel",
    cash: "maximum measured cash value within spend and travel",
    efficiency: "best blended net return per planned dollar"
}[objective];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function isNewCustomerOffer(opportunity: ScoredOpportunity): boolean {
  const searchable = [
    opportunity.title,
    opportunity.summary,
    ...opportunity.tags,
    ...(opportunity.preferenceSignals ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return (
    /\b(?:new|first)\b[^.]*\b(?:app|account|member|user)s?\b/.test(searchable) ||
    /\bnew app users?\b/.test(searchable)
  );
}

function exceedsEffortLimit(
  friction: ScoredOpportunity["friction"],
  maximumFriction: WeeklyPlanSettings["maximumFriction"]
): boolean {
  const effortRank = { low: 1, medium: 2, high: 3 };
  const limitRank = { low: 1, medium: 2, any: 3 };

  return effortRank[friction] > limitRank[maximumFriction];
}

function effortLimitLabel(
  maximumFriction: WeeklyPlanSettings["maximumFriction"]
): string {
  return {
    low: "low-effort",
    medium: "medium-effort",
    any: "any-effort"
}[maximumFriction];
}

function sourceAgeInDays(
  opportunity: ScoredOpportunity,
  today: Date
): number | null {
  const checkedOn = new Date(`${opportunity.source.checkedOn}T12:00:00`);
  if (!Number.isFinite(checkedOn.getTime())) return null;

  return Math.max(
    0,
    Math.floor((today.getTime() - checkedOn.getTime()) / (24 * 60 * 60 * 1000))
  );
}

function evidenceAgeInDays(
  checkedOn: string | undefined,
  today: Date
): number | null {
  if (!checkedOn) return null;
  const checked = new Date(`${checkedOn}T12:00:00`);
  if (!Number.isFinite(checked.getTime())) return null;

  return Math.max(
    0,
    Math.floor((today.getTime() - checked.getTime()) / (24 * 60 * 60 * 1000))
  );
}

function hasExclusiveStackConflict(deals: DealCandidate[]): boolean {
  const seenGroups = new Set<string>();

  for (const deal of deals) {
    if (!deal.stackGroup) continue;
    if (seenGroups.has(deal.stackGroup)) return true;
    seenGroups.add(deal.stackGroup);
  }

  return false;
}

function hasUnconfirmedStackConflict(
  deals: DealCandidate[],
  allowConditionalStacking: boolean
): boolean {
  if (allowConditionalStacking) return false;

  const conditionalCount = deals.filter((deal) => {
    const compatibility =
      effectiveStackCompatibility(deal.opportunity) ?? "conditional";
    return compatibility === "conditional";
  }).length;

  return deals.length > 1 && conditionalCount > 1;
}

function hasConfirmedLocalParticipation(opportunity: ScoredOpportunity): boolean {
  return (
    opportunity.localRecord === true &&
    opportunity.distanceMiles !== undefined &&
    opportunity.distanceBasis === "offer"
  );
}

function hasHighPriorityFit(opportunity: ScoredOpportunity): boolean {
  return matchesHighPriorityProfile(opportunity);
}

function planningEvidenceFactor(
  opportunity: ScoredOpportunity,
  today: Date,
  maximumSourceAgeDays: number
): number {
  const age = sourceAgeInDays(opportunity, today);
  const freshnessFactor =
    age === null || maximumSourceAgeDays <= 0
      ? 0.65
      : clamp(1 - (age / maximumSourceAgeDays) * 0.35, 0.65, 1);

  let participationFactor = 0.75;
  if (hasConfirmedLocalParticipation(opportunity)) {
    participationFactor = 1;
  } else if (opportunity.distanceMiles !== undefined) {
    participationFactor = 0.85;
  }

  let locationFactor = 1;
  if (opportunity.distanceBasis === "merchant-location") {
    const locationAge = evidenceAgeInDays(opportunity.distanceCheckedOn, today);
    locationFactor =
      locationAge === null || maximumSourceAgeDays <= 0
        ? 0.65
        : clamp(1 - (locationAge / maximumSourceAgeDays) * 0.25, 0.75, 1);
  }

  return freshnessFactor * participationFactor * locationFactor;
}

function planningTimingFactor(
  opportunity: ScoredOpportunity,
  today: Date
): number {
  if (!opportunity.expiresOn) return 0.85;

  const daysLeft = daysUntilExpiration(opportunity.expiresOn, today);
  if (!Number.isFinite(daysLeft)) return 0.75;
  if (daysLeft <= 2) return 1;
  if (daysLeft <= 7) return 0.95;
  if (daysLeft <= 14) return 0.9;
  return 0.8;
}

export function daysUntilExpiration(
  expiresOn: string,
  today = new Date()
): number {
  const expirationEnd = new Date(`${expiresOn}T23:59:59`);
  if (!Number.isFinite(expirationEnd.getTime())) return Number.NaN;

  const expirationDay = new Date(
    expirationEnd.getFullYear(),
    expirationEnd.getMonth(),
    expirationEnd.getDate()
  );
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round(
    (expirationDay.getTime() - todayDay.getTime()) / (24 * 60 * 60 * 1000)
  );
}

function combinations<T>(items: T[], maxSize: number): T[][] {
  const results: T[][] = [[]];
  const build = (startIndex: number, partial: T[]) => {
      for (let index = startIndex; index < items.length; index += 1) {
        const next = [...partial, items[index]];
        results.push(next);
        if (next.length < maxSize) build(index + 1, next);
      }
  };
  build(0, []);
  return results;
}

function makeBundle(
  group: DealCandidate[],
  settings: WeeklyPlanSettings
): TripBundle {
  const requiredSpend = group.reduce(
    (total, deal) => total + deal.opportunity.minimumSpend,
    0
  );
  const estimatedSavings = group.reduce(
    (total, deal) => total + deal.opportunity.estimatedSavings,
    0
  );
  const distances = group
    .map((deal) => deal.opportunity.distanceMiles)
    .filter((distance): distance is number => distance !== undefined);
  const hasUnconfirmedLocationDeal = distances.length < group.length;
  const distanceConfirmed = group.length > 0 && distances.length > 0;
  const hasUnconfirmedParticipationDeal = group.some(
    ({ opportunity }) =>
      opportunity.distanceMiles === undefined ||
      opportunity.distanceBasis === "merchant-location" ||
      !(opportunity.localRecord === true && opportunity.distanceMiles !== undefined)
  );
  const distanceMiles =
    distances.length > 0 ? Math.min(...distances) : undefined;
  const distancePenalty = distanceConfirmed
    ? (distanceMiles ?? 0) * 3
    : 12;
  const estimatedTravelCost = settings.travelCostPerMile > 0 &&
    distanceConfirmed &&
    distanceMiles !== undefined
    ? distanceMiles * 2 * settings.travelCostPerMile
    : 0;
  const grossBenefit = group.reduce(
    (total, deal) =>
      total + deal.opportunity.estimatedSavings * deal.outcomeAdjustment,
    0
  );
  const riskAdjustedSavings = group.reduce(
    (total, deal) =>
      total +
      deal.opportunity.estimatedSavings *
      deal.outcomeAdjustment *
      deal.evidenceFactor,
    0
  );
  const priorityAdjustedSavings = group.reduce(
    (total, deal) =>
      total +
      deal.opportunity.estimatedSavings *
      deal.outcomeAdjustment *
      deal.evidenceFactor *
      deal.timingFactor,
    0
  );
  const averageTimingFactor =
    group.length > 0
      ? group.reduce((total, deal) => total + deal.timingFactor, 0) /
        group.length
      : 1;
  const evidenceConfidence =
    grossBenefit > 0 ? riskAdjustedSavings / grossBenefit : 1;
  const balancedUtility =
    group.reduce(
      (total, deal) =>
        total +
        deal.opportunity.score +
        deal.opportunity.estimatedSavings * deal.outcomeAdjustment * 2 -
        deal.opportunity.minimumSpend * 0.15,
      0
    ) - distancePenalty - estimatedTravelCost * 2;
  const cashUtility =
    priorityAdjustedSavings * 2 -
    group.reduce(
      (total, deal) => total + deal.opportunity.minimumSpend * 0.15,
      0
    ) -
    distancePenalty -
    estimatedTravelCost * 2;
  const utility =
    settings.planObjective === "cash"
      ? cashUtility
      : settings.planObjective === "efficiency"
        ? priorityAdjustedSavings - estimatedTravelCost
        : balancedUtility;
  const warnings = Array.from(
    new Set(group.flatMap((deal) => deal.warnings))
  );

  return {
    merchantKey: merchantKey(group[0].planningMerchant),
    merchant: group[0].planningMerchant,
    distanceMiles,
    distanceConfirmed,
    hasUnconfirmedLocationDeal,
    hasUnconfirmedParticipationDeal,
    requiredSpend,
    estimatedSavings,
    calibratedSavings: grossBenefit,
    timingPriority: averageTimingFactor,
    riskAdjustedSavings,
    evidenceConfidence,
    ...(settings.travelCostPerMile > 0
      ? {
          estimatedTravelCost,
          netBenefitAfterTravel:
            distanceConfirmed && distanceMiles !== undefined
              ? riskAdjustedSavings - estimatedTravelCost
              : null
        }
      : {}),
    utility,
    deals: group,
    warnings
  };
}

function buildBaseWeeklyPlan(
  opportunities: ScoredOpportunity[],
  rawSettings: Partial<WeeklyPlanSettings>,
  today = new Date(),
  outcomeAdjustments: OfferOutcomeAdjustments = {}
): BaseWeeklyPlan {
  const settings = normalizeSettings(rawSettings);
  const eligible: DealCandidate[] = [];
  const excluded: WeeklyPlan["excluded"] = [];

  for (const opportunity of opportunities) {
    if (opportunity.verification !== "verified") {
      excluded.push({
        opportunity,
        reason: "Not source-verified"
      });
      continue;
    }

    const expirationEnd = opportunity.expiresOn
      ? new Date(`${opportunity.expiresOn}T23:59:59`)
      : null;
    if (
      expirationEnd &&
      !Number.isFinite(expirationEnd.getTime())
    ) {
      excluded.push({
        opportunity,
        reason: "Invalid expiration evidence"
      });
      continue;
    }

    if (expirationEnd && expirationEnd.getTime() < today.getTime()) {
      excluded.push({ opportunity, reason: "Expired" });
      continue;
    }

    if (
      opportunity.expiresOn &&
      daysUntilExpiration(opportunity.expiresOn, today) <
        settings.minimumDaysRemaining
    ) {
      excluded.push({
        opportunity,
        reason: `Ends within ${settings.minimumDaysRemaining}-day validity limit`
      });
      continue;
    }

    if (
      opportunity.estimatedSavings <= 0 &&
      (!opportunity.isFree || settings.requireMeasuredDollarValue)
    ) {
      excluded.push({
        opportunity,
        reason: settings.requireMeasuredDollarValue
          ? "Unpriced reward has no measured dollar value"
          : "No captured dollar value"
      });
      continue;
    }

    const sourceAge = sourceAgeInDays(opportunity, today);
    if (
      sourceAge === null ||
      sourceAge > settings.maximumSourceAgeDays
    ) {
      excluded.push({
        opportunity,
        reason:
          sourceAge === null
            ? "Source-check date is missing"
            : `Official-source check is ${sourceAge} days old, beyond the ${settings.maximumSourceAgeDays}-day freshness limit`
      });
      continue;
    }

    if (
      settings.minimumValuePerDollar > 0 &&
      opportunity.minimumSpend > 0 &&
      opportunity.estimatedSavings / opportunity.minimumSpend <
        settings.minimumValuePerDollar - 0.000001
    ) {
      excluded.push({
        opportunity,
        reason: `Below the $${settings.minimumValuePerDollar.toFixed(2)}-per-$1-spent efficiency floor`
      });
      continue;
    }

    if (opportunity.distanceBasis === "merchant-location") {
      const locationAge = evidenceAgeInDays(opportunity.distanceCheckedOn, today);
      if (
        locationAge === null ||
        locationAge > settings.maximumSourceAgeDays
      ) {
        excluded.push({
          opportunity,
          reason:
            locationAge === null
              ? "Nearby-location check date is missing"
              : `Nearby-location check is ${locationAge} days old, beyond the ${settings.maximumSourceAgeDays}-day freshness limit`
        });
        continue;
      }
    }

    if (exceedsEffortLimit(opportunity.friction, settings.maximumFriction)) {
      excluded.push({
        opportunity,
        reason: `Above ${effortLimitLabel(settings.maximumFriction)} limit`
      });
      continue;
    }

    if (
      opportunity.distanceMiles !== undefined &&
      opportunity.distanceMiles > settings.maxDistanceMiles
    ) {
      excluded.push({
        opportunity,
        reason: `Beyond ${settings.maxDistanceMiles}-mile limit`
      });
      continue;
    }

    if (opportunity.distanceMiles === undefined && !settings.includeUnconfirmedLocations) {
      excluded.push({
        opportunity,
        reason: "Location distance not confirmed"
      });
      continue;
    }

    if (
      settings.requireLocalParticipation &&
      !hasConfirmedLocalParticipation(opportunity)
    ) {
      excluded.push({
        opportunity,
        reason: "Local participation is not confirmed on this device"
      });
      continue;
    }

    if (settings.requireHighPriorityFit && !hasHighPriorityFit(opportunity)) {
      excluded.push({
        opportunity,
        reason: "Does not match a high-priority household keyword"
      });
      continue;
    }

    const warnings: string[] = [];
    const stackCompatibility =
      effectiveStackCompatibility(opportunity) ?? "conditional";
    const outcomeAdjustment =
      outcomeAdjustments[opportunity.id]?.adjustment ?? 1;
    const evidenceFactor = planningEvidenceFactor(
      opportunity,
      today,
      settings.maximumSourceAgeDays
    );
    if (stackCompatibility === "exclusive") {
      warnings.push("Official terms require this offer to be redeemed by itself.");
    } else if (stackCompatibility === "conditional") {
      warnings.push("Stacking requires confirmation.");
    } else if (opportunity.distanceMiles === undefined) {
      warnings.push("Distance and local participation are unconfirmed");
    } else if (opportunity.distanceBasis === "merchant-location") {
      warnings.push("Nearby store is confirmed; confirm promotion participation.");
    } else if (opportunity.localRecord !== true) {
      warnings.push("Distance does not prove local participation; confirm it before travel.");
    }

    if (!opportunity.stackNote && stackCompatibility !== "exclusive") {
      warnings.push("Confirm whether this combines with other offers");
    }

    if (outcomeAdjustment <= 0.95) {
      warnings.push("Linked local results are below the listed estimate.");
    } else if (outcomeAdjustment >= 1.05) {
      warnings.push("Linked local results exceed the listed estimate.");
    }

    eligible.push({
      opportunity,
      warnings,
      planningMerchant: planningMerchant(opportunity),
      newCustomerOffer: isNewCustomerOffer(opportunity),
      stackGroup: opportunity.stackGroup,
    outcomeAdjustment,
    evidenceFactor,
    timingFactor: planningTimingFactor(opportunity, today)
    });
  }

  const groups = new Map<string, DealCandidate[]>();
  for (const deal of eligible) {
    const key = merchantKey(deal.planningMerchant);
    groups.set(key, [...(groups.get(key) ?? []), deal]);
  }

  const budgetCents = Math.round(settings.weeklyBudget * 100);
  const bundlesByMerchant = [...groups.keys()]
    .sort((first, second) => first.localeCompare(second))
    .map((merchantKey) => {
      const group = groups.get(merchantKey);
      if (!group) return [];

      return Array.from(
        combinations(group, settings.maxDealsPerTrip)
      ).flatMap((combination) => {
        if (combination.length === 0) return [];
        if (
          combination.filter((deal) => deal.newCustomerOffer).length > 1
        ) {
          return [];
        }
        if (hasExclusiveStackConflict(combination)) return [];
        if (
          combination.length > 1 &&
          combination.some(
            (deal) =>
              effectiveStackCompatibility(deal.opportunity) === "exclusive"
          )
        ) {
          return [];
        }
        if (
          hasUnconfirmedStackConflict(
            combination,
            settings.allowConditionalStacking
          )
        ) {
          return [];
        }
        return [makeBundle(combination, settings)];
      });
    });

  type PlanState = {
    utility: number;
    bundles: TripBundle[];
  };
  let best: PlanState = { utility: 0, bundles: [] };

  if (settings.planObjective === "efficiency") {
    const efficiencyDp = Array.from(
      { length: settings.maxTrips + 1 },
      () =>
        Array.from({ length: budgetCents + 1 }, (): PlanState => ({
          utility: Number.NEGATIVE_INFINITY,
          bundles: []
        }))
    );
    efficiencyDp[0][0] = { utility: 0, bundles: [] };

    for (const merchantBundles of bundlesByMerchant) {
      const next = efficiencyDp.map((states) =>
        states.map((state) => ({
          utility: state.utility,
          bundles: [...state.bundles]
        }))
      );

      for (const bundle of merchantBundles) {
        const costCents = Math.round(
          (bundle.requiredSpend + (bundle.estimatedTravelCost ?? 0)) * 100
        );
        if (costCents > budgetCents) continue;

        for (
          let tripsUsed = 1;
          tripsUsed <= settings.maxTrips;
          tripsUsed += 1
        ) {
          for (let spent = costCents; spent <= budgetCents; spent += 1) {
            const previous = efficiencyDp[tripsUsed - 1][spent - costCents];
            if (!Number.isFinite(previous.utility)) continue;

            const candidateUtility = previous.utility + bundle.utility;
            if (candidateUtility > next[tripsUsed][spent].utility) {
              next[tripsUsed][spent] = {
                utility: candidateUtility,
                bundles: [...previous.bundles, bundle]
              };
            }
          }
        }
      }
      efficiencyDp.splice(0, efficiencyDp.length, ...next);
    }

    let bestEfficiency = Number.NEGATIVE_INFINITY;
    for (let tripsUsed = 1; tripsUsed <= settings.maxTrips; tripsUsed += 1) {
      for (let spentCents = 1; spentCents <= budgetCents; spentCents += 1) {
        const candidate = efficiencyDp[tripsUsed][spentCents];
        if (!Number.isFinite(candidate.utility)) continue;

        const candidateEfficiency =
          candidate.utility / Math.max(spentCents / 100, 1);
        if (
          candidateEfficiency > bestEfficiency ||
          (candidateEfficiency === bestEfficiency &&
            candidate.utility > best.utility)
        ) {
          bestEfficiency = candidateEfficiency;
          best = candidate;
        }
      }
    }
  } else {
    const additiveDp = Array.from(
      { length: settings.maxTrips + 1 },
      () =>
        Array.from({ length: budgetCents + 1 }, (): PlanState => ({
          utility: Number.NEGATIVE_INFINITY,
          bundles: []
        }))
    );
    for (let budget = 0; budget <= budgetCents; budget += 1) {
      additiveDp[0][budget] = { utility: 0, bundles: [] };
    }

    for (const merchantBundles of bundlesByMerchant) {
      const next = additiveDp.map((states) =>
        states.map((state) => ({
          utility: state.utility,
          bundles: [...state.bundles]
        }))
      );

      for (const bundle of merchantBundles) {
        const costCents = Math.round(bundle.requiredSpend * 100);
        if (costCents > budgetCents) continue;

        for (
          let tripsUsed = 1;
          tripsUsed <= settings.maxTrips;
          tripsUsed += 1
        ) {
          for (let budget = costCents; budget <= budgetCents; budget += 1) {
            const previous = additiveDp[tripsUsed - 1][budget - costCents];
            if (!Number.isFinite(previous.utility)) continue;

            const candidateUtility = previous.utility + bundle.utility;
            if (candidateUtility > next[tripsUsed][budget].utility) {
              next[tripsUsed][budget] = {
                utility: candidateUtility,
                bundles: [...previous.bundles, bundle]
              };
            }
          }
        }
      }
      additiveDp.splice(0, additiveDp.length, ...next);
    }

    for (let tripsUsed = 1; tripsUsed <= settings.maxTrips; tripsUsed += 1) {
      const candidate = additiveDp[tripsUsed][budgetCents];
      if (
        candidate.utility > best.utility ||
        (candidate.utility === best.utility &&
          candidate.bundles.length < best.bundles.length)
      ) {
        best = candidate;
      }
    }
  }

  const selectedBundles = [...best.bundles].sort((first, second) => {
    if (settings.tripOrder === "distance") {
      const firstDistance = first.distanceMiles ?? Number.POSITIVE_INFINITY;
      const secondDistance = second.distanceMiles ?? Number.POSITIVE_INFINITY;
      if (firstDistance !== secondDistance) return firstDistance - secondDistance;
    }

    if (settings.planObjective === "efficiency") {
      const firstCost =
        first.requiredSpend + (first.estimatedTravelCost ?? 0);
      const secondCost =
        second.requiredSpend + (second.estimatedTravelCost ?? 0);
      const firstEfficiency = first.utility / Math.max(firstCost, 1);
      const secondEfficiency = second.utility / Math.max(secondCost, 1);
      if (secondEfficiency !== firstEfficiency) {
        return secondEfficiency - firstEfficiency;
      }
    }

    if (second.utility !== first.utility) return second.utility - first.utility;
    if (first.merchantKey !== second.merchantKey) {
      return first.merchantKey.localeCompare(second.merchantKey);
    }
    const firstSpend = Math.round(first.requiredSpend * 100);
    const secondSpend = Math.round(second.requiredSpend * 100);
    if (firstSpend !== secondSpend) return firstSpend - secondSpend;
    return first.deals[0].opportunity.id.localeCompare(
      second.deals[0].opportunity.id
    );
  });
  const trips: PlannedTrip[] = selectedBundles.map((bundle) => ({
    id: bundle.merchantKey,
    merchant: bundle.merchant,
    distanceMiles: bundle.distanceMiles,
    distanceConfirmed: bundle.distanceConfirmed,
    hasUnconfirmedLocationDeal: bundle.hasUnconfirmedLocationDeal,
    hasUnconfirmedParticipationDeal: bundle.hasUnconfirmedParticipationDeal,
    requiredSpend: bundle.requiredSpend,
    estimatedSavings: bundle.estimatedSavings,
    calibratedSavings: bundle.calibratedSavings,
    riskAdjustedSavings: bundle.riskAdjustedSavings,
    evidenceConfidence: bundle.evidenceConfidence,
    timingPriority: bundle.timingPriority,
    ...(bundle.estimatedTravelCost !== undefined
      ? { estimatedTravelCost: bundle.estimatedTravelCost }
      : {}),
    ...(bundle.netBenefitAfterTravel !== undefined
      ? { netBenefitAfterTravel: bundle.netBenefitAfterTravel }
      : {}),
    averageScore:
      bundle.deals.reduce((total, deal) => total + deal.opportunity.score, 0) /
      bundle.deals.length,
    utility: bundle.utility,
    deals: bundle.deals.map(({ opportunity, warnings }) => ({
      opportunity,
      warnings
    })),
    warnings: bundle.warnings
  }));
  const selectedIds = new Set(
    trips.flatMap((trip) => trip.deals.map((deal) => deal.opportunity.id))
  );
  const selectedDeals: PlannedDeal[] = trips.flatMap((trip) => trip.deals);
  const requiredSpend = selectedDeals.reduce(
    (total, deal) => total + deal.opportunity.minimumSpend,
    0
  );
  const estimatedSavings = selectedDeals.reduce(
    (total, deal) => total + deal.opportunity.estimatedSavings,
    0
  );
  const calibratedSavings = selectedDeals.reduce(
    (total, deal) =>
      total +
      deal.opportunity.estimatedSavings *
        (outcomeAdjustments[deal.opportunity.id]?.adjustment ?? 1),
    0
  );
  const riskAdjustedSavings = trips.reduce(
    (total, trip) => total + trip.riskAdjustedSavings,
    0
  );
  const totalTravelCost = trips.reduce(
    (total, trip) => total + (trip.estimatedTravelCost ?? 0),
    0
  );

  for (const deal of eligible) {
    if (!selectedIds.has(deal.opportunity.id)) {
      const selectedBundle = selectedBundles.find(
        (bundle) => bundle.merchantKey === merchantKey(deal.planningMerchant)
      );
      let reason = "Outside the strongest plan under current limits";

      if (selectedBundle) {
        const dealCompatibility =
          effectiveStackCompatibility(deal.opportunity) ?? "conditional";
        const sameGroupDeal = selectedBundle.deals.find(
          (selected) =>
            deal.stackGroup &&
            selected.stackGroup === deal.stackGroup
        );
        const selectedHasExclusive = selectedBundle.deals.some(
          (selected) =>
            (effectiveStackCompatibility(selected.opportunity) ?? "conditional") ===
            "exclusive"
        );

        if (sameGroupDeal) {
          reason = "Another offer from its exclusion group was selected.";
        } else if (
          dealCompatibility === "conditional" &&
          selectedBundle.deals.filter((selected) =>
            (effectiveStackCompatibility(selected.opportunity) ??
              "conditional") === "conditional"
          ).length > 0 &&
          !settings.allowConditionalStacking
        ) {
          reason = "Excluded by the conditional-stacking guard.";
        } else if (
          dealCompatibility === "exclusive" ||
          selectedHasExclusive
        ) {
          reason = "Not combinable with the selected exclusive offer.";
        }
      }

      excluded.push({ opportunity: deal.opportunity, reason });
    }
  }

  return {
    trips,
    selectedDeals,
    excluded: excluded.sort(
      (first, second) => {
        if (second.opportunity.score !== first.opportunity.score) {
          return second.opportunity.score - first.opportunity.score;
        }
        if (
          second.opportunity.estimatedSavings !==
          first.opportunity.estimatedSavings
        ) {
          return (
            second.opportunity.estimatedSavings -
            first.opportunity.estimatedSavings
          );
        }
        const firstDistance =
          first.opportunity.distanceMiles ?? Number.POSITIVE_INFINITY;
        const secondDistance =
          second.opportunity.distanceMiles ?? Number.POSITIVE_INFINITY;
        if (firstDistance !== secondDistance) {
          return firstDistance - secondDistance;
        }
        return first.opportunity.id.localeCompare(second.opportunity.id);
      }
    ),
    requiredSpend,
    estimatedSavings,
    calibratedSavings,
    calibrationDelta: calibratedSavings - estimatedSavings,
    evidenceConfidence:
      calibratedSavings > 0
        ? trips.reduce(
            (weightedTotal, trip) =>
              weightedTotal +
              trip.calibratedSavings * trip.evidenceConfidence,
            0
          ) / calibratedSavings
        : 1,
    timingPriority:
      calibratedSavings > 0
        ? trips.reduce(
            (weightedTotal, trip) =>
              weightedTotal + trip.calibratedSavings * trip.timingPriority,
            0
          ) / calibratedSavings
        : 1,
    riskAdjustedSavings,
    totalTravelCost,
    valueEfficiency:
      requiredSpend > 0 ? estimatedSavings / requiredSpend : null,
    planningEfficiency: planningEfficiency({ trips }),
    estimatedNetCost: Math.max(0, requiredSpend - estimatedSavings),
    netBenefitAfterTravel:
      trips.reduce(
        (total, trip) => total + (trip.netBenefitAfterTravel ?? 0),
        0
      ),
    savingsRate:
      requiredSpend > 0 ? (estimatedSavings / requiredSpend) * 100 : 100,
    assumptions: [
      `Verified offers only; planned spend capped at $${settings.weeklyBudget.toFixed(2)}.`,
      `The optimizer selects trips for ${objectiveLabel(settings.planObjective)}.`,
      `At most ${settings.maxTrips} merchants and ${settings.maxDealsPerTrip} deals per merchant.`,
      settings.travelCostPerMile > 0
        ? `Planning utility subtracts your $${settings.travelCostPerMile.toFixed(2)}-per-mile round-trip travel estimate; this is a household assumption, not official pricing.`
        : "Travel is constrained by miles but not assigned a dollar cost.",
      settings.includeUnconfirmedLocations
        ? "Unconfirmed locations are labeled and receive a planning penalty."
        : `Distances beyond ${settings.maxDistanceMiles} miles or unconfirmed are excluded.`,
      settings.requireLocalParticipation
        ? "Only locally captured offers with confirmed distances are eligible."
        : "Offers without user-confirmed local participation are labeled before travel.",
      settings.requireHighPriorityFit
        ? "Only offers matching a high-priority household keyword are eligible."
        : "Household keywords adjust ranking but do not remove general-priority offers.",
      settings.requireMeasuredDollarValue
        ? "Only offers with a measured dollar-value estimate are eligible; unpriced rewards are excluded."
        : "Unpriced free rewards remain eligible but do not add estimated savings.",
      settings.minimumValuePerDollar > 0
        ? `Offers must return at least $${settings.minimumValuePerDollar.toFixed(2)} per $1 of required spend; zero-spend rewards remain eligible.`
        : "No minimum return-per-dollar threshold is applied.",
      settings.planObjective === "balanced"
        ? "Deadline urgency remains part of the balanced evidence score."
        : "Cash- and efficiency-focused planning gives nearer deadlines a bounded priority; official estimates remain unchanged.",
      "Older source or nearby-location evidence and unconfirmed local participation reduce risk-adjusted planning value; official estimates remain unchanged.",
      `Official offers and nearby-location checks must have evidence from the last ${settings.maximumSourceAgeDays} day${settings.maximumSourceAgeDays === 1 ? "" : "s"}.`,
      settings.allowConditionalStacking
        ? "Conditional stacks are allowed only because you turned on the local override; official terms still control."
        : "Only one offer with conditional or undocumented stacking is counted per merchant trip; exclusive offers are planned alone.",
      settings.minimumDaysRemaining > 0
        ? `Offers must remain valid for at least ${settings.minimumDaysRemaining} more day${settings.minimumDaysRemaining === 1 ? "" : "s"}; this is planning math, not an eligibility guarantee.`
        : "Offers expiring today remain eligible for planning; confirm their terms before acting.",
      {
        low: "Only low-effort offers are eligible.",
        medium: "Low and medium effort offers are eligible; high effort is excluded.",
        any: "All verified effort levels are eligible."
      }[settings.maximumFriction],
      "Estimated values are planning aids; confirm app/store terms and buy only planned household items.",
      outcomeAdjustments && Object.keys(outcomeAdjustments).length > 0
        ? "Linked confirmed results locally adjust planning value when evidence exists."
        : "Planning value uses listed estimates until linked confirmed results exist."
    ].concat(
      settings.tripOrder === "distance"
        ? ["Trips are displayed nearest first using approximate location distances."]
        : ["Trips are displayed strongest planning value first."]
    )
  };
}

const constraintCheckDefinitions: Array<{
  key: WeeklyConstraintCheckKey;
  increment: number;
  maximum: number;
  label: string;
}> = [
  {
    key: "weeklyBudget",
    increment: 25,
    maximum: 500,
    label: "A $25 higher weekly budget"
  },
  {
    key: "maxTrips",
    increment: 1,
    maximum: 8,
    label: "one more merchant trip"
  },
  {
    key: "maxDistanceMiles",
    increment: 5,
    maximum: 50,
    label: "five more miles of travel range"
  },
  {
    key: "maxDealsPerTrip",
    increment: 1,
    maximum: 5,
    label: "one more deal per merchant trip"
  }
];

function selectedDealIds(plan: BaseWeeklyPlan): Set<string> {
  return new Set(plan.selectedDeals.map(({ opportunity }) => opportunity.id));
}

function planningEfficiency(plan: { trips: PlannedTrip[] }): number | null {
  const effectiveCost = plan.trips.reduce(
    (total, trip) =>
      total + trip.requiredSpend + (trip.estimatedTravelCost ?? 0),
    0
  );
  if (effectiveCost <= 0) return null;

  return (
    plan.trips.reduce((total, trip) => total + trip.utility, 0) /
    effectiveCost
  );
}

function buildConstraintChecks(
  currentPlan: BaseWeeklyPlan,
  opportunities: ScoredOpportunity[],
  settings: WeeklyPlanSettings,
  today: Date,
  outcomeAdjustments: OfferOutcomeAdjustments
): WeeklyConstraintCheck[] {
  const currentIds = selectedDealIds(currentPlan);

  return constraintCheckDefinitions.flatMap((definition) => {
    const relaxedValue = Math.min(
      settings[definition.key] + definition.increment,
      definition.maximum
    );
    if (relaxedValue <= settings[definition.key]) return [];

    const alternative = buildBaseWeeklyPlan(
      opportunities,
      {
        ...settings,
        [definition.key]: relaxedValue
      },
      today,
      outcomeAdjustments
    );
    const alternativeIds = selectedDealIds(alternative);
    const selectionChanged =
      alternativeIds.size !== currentIds.size ||
      [...currentIds].some((id) => !alternativeIds.has(id));
    const savingsGain =
      alternative.estimatedSavings - currentPlan.estimatedSavings;
    const riskAdjustedGain =
      alternative.riskAdjustedSavings - currentPlan.riskAdjustedSavings;
    const usesEfficiencyObjective = settings.planObjective === "efficiency";
    const currentEfficiency = planningEfficiency(currentPlan);
    const alternativeEfficiency = planningEfficiency(alternative);
    const efficiencyGain =
      currentEfficiency !== null && alternativeEfficiency !== null
        ? alternativeEfficiency - currentEfficiency
        : null;

    const objectiveImprovement = usesEfficiencyObjective
      ? efficiencyGain !== null && efficiencyGain > 0.0001
      : savingsGain >= 0.01 && riskAdjustedGain >= -0.01;

    if (
      !selectionChanged ||
      !objectiveImprovement ||
      alternative.netBenefitAfterTravel <
        currentPlan.netBenefitAfterTravel - 0.01
    ) {
      return [];
    }

    const additionalMerchantTrips = Math.max(
      0,
      alternative.trips.length - currentPlan.trips.length
    );
    const additionalRequiredSpend =
      alternative.requiredSpend - currentPlan.requiredSpend;
    const messageParts = usesEfficiencyObjective
      ? [
          `${definition.label} raises whole-plan planning efficiency from $${currentEfficiency?.toFixed(2)} to $${alternativeEfficiency?.toFixed(2)} per $1 of effective cost for ${formatCurrency(additionalRequiredSpend)} more planned spend.`
        ]
      : [
          `${definition.label} would add ${formatCurrency(savingsGain)} in official estimated savings for ${formatCurrency(additionalRequiredSpend)} more planned spend.`
        ];

    if (usesEfficiencyObjective && savingsGain < -0.01) {
      messageParts.push(
        "Official estimated savings fall, which can be correct when you chose Best per dollar."
      );
    }

    if (additionalMerchantTrips > 0) {
      messageParts.push(
        `It adds ${additionalMerchantTrips} merchant trip${additionalMerchantTrips === 1 ? "" : "s"}.`
      );
    }

    if (settings.travelCostPerMile > 0) {
      messageParts.push(
        "The change does not lower net benefit after your travel-cost assumption."
      );
    }

    if (riskAdjustedGain < savingsGain - 0.01) {
      messageParts.push(
        "Linked local outcomes reduce the risk-adjusted gain, so review those results before acting."
      );
    }

    return [
      {
        key: definition.key,
        label: definition.label,
        relaxedLimitLabel: String(relaxedValue),
        estimatedSavingsGain: savingsGain,
        additionalRequiredSpend,
        additionalMerchantTrips,
        currentPlanningEfficiency: currentEfficiency,
        relaxedPlanningEfficiency: alternativeEfficiency,
        planningEfficiencyGain: efficiencyGain,
        message: messageParts.join(" ")
      }
    ];
  });
}

export function buildWeeklyPlan(
  opportunities: ScoredOpportunity[],
  rawSettings: Partial<WeeklyPlanSettings>,
  today = new Date(),
  outcomeAdjustments: OfferOutcomeAdjustments = {}
): WeeklyPlan {
  const plan = buildBaseWeeklyPlan(
    opportunities,
    rawSettings,
    today,
    outcomeAdjustments
  );
  const settings = normalizeSettings(rawSettings);

  return {
    ...plan,
    constraintChecks: buildConstraintChecks(
      plan,
      opportunities,
      settings,
      today,
      outcomeAdjustments
    )
  };
}









