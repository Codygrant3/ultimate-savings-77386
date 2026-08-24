import type {
  PlannedDeal,
  PlannedTrip,
  ScoredOpportunity,
  WeeklyPlan,
  WeeklyPlanSettings
} from "../types";
import type { OfferOutcomeAdjustments } from "./outcomes";
import { effectiveStackCompatibility } from "./scoring";

export const DEFAULT_WEEKLY_PLAN_SETTINGS: WeeklyPlanSettings = {
  weeklyBudget: 100,
  maxTrips: 3,
  maxDistanceMiles: 10,
  maximumSourceAgeDays: 14,
  minimumDaysRemaining: 0,
  maximumFriction: "medium",
  includeUnconfirmedLocations: true,
  allowConditionalStacking: false,
  maxDealsPerTrip: 3
};

interface DealCandidate {
  opportunity: ScoredOpportunity;
  warnings: string[];
  planningMerchant: string;
  newCustomerOffer: boolean;
  stackGroup?: string;
  outcomeAdjustment: number;
}

interface TripBundle {
  merchantKey: string;
  merchant: string;
  distanceMiles?: number;
  distanceConfirmed: boolean;
  hasUnconfirmedLocationDeal: boolean;
  requiredSpend: number;
  estimatedSavings: number;
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
    maximumSourceAgeDays: Math.round(
      bounded(
        settings.maximumSourceAgeDays,
        DEFAULT_WEEKLY_PLAN_SETTINGS.maximumSourceAgeDays,
        1,
        90
      )
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
    )
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

function makeBundle(group: DealCandidate[]): TripBundle {
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
  const distanceMiles =
    distances.length > 0 ? Math.min(...distances) : undefined;
  const distancePenalty = distanceConfirmed
    ? (distanceMiles ?? 0) * 3
    : 12;
  const utility =
    group.reduce(
      (total, deal) =>
        total +
        deal.opportunity.score +
        deal.opportunity.estimatedSavings * deal.outcomeAdjustment * 2 -
        deal.opportunity.minimumSpend * 0.15,
      0
    ) - distancePenalty;
  const warnings = Array.from(
    new Set(group.flatMap((deal) => deal.warnings))
  );

  return {
    merchantKey: merchantKey(group[0].planningMerchant),
    merchant: group[0].planningMerchant,
    distanceMiles,
    distanceConfirmed,
    hasUnconfirmedLocationDeal,
    requiredSpend,
    estimatedSavings,
    utility,
    deals: group,
    warnings
  };
}

export function buildWeeklyPlan(
  opportunities: ScoredOpportunity[],
  rawSettings: Partial<WeeklyPlanSettings>,
  today = new Date(),
  outcomeAdjustments: OfferOutcomeAdjustments = {}
): WeeklyPlan {
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
      !opportunity.isFree
    ) {
      excluded.push({
        opportunity,
        reason: "No captured dollar value"
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

    const warnings: string[] = [];
    const stackCompatibility =
      effectiveStackCompatibility(opportunity) ?? "conditional";
    const outcomeAdjustment =
      outcomeAdjustments[opportunity.id]?.adjustment ?? 1;
    if (stackCompatibility === "exclusive") {
      warnings.push("Official terms require this offer to be redeemed by itself.");
    } else if (stackCompatibility === "conditional") {
      warnings.push("Stacking requires confirmation.");
    } else if (opportunity.distanceMiles === undefined) {
      warnings.push("Distance and local participation are unconfirmed");
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
      outcomeAdjustment
    });
  }

  const groups = new Map<string, DealCandidate[]>();
  for (const deal of eligible) {
    const key = merchantKey(deal.planningMerchant);
    groups.set(key, [...(groups.get(key) ?? []), deal]);
  }

  const budgetCents = Math.round(settings.weeklyBudget * 100);
  let dp = Array.from(
    { length: settings.maxTrips + 1 },
    () =>
      Array.from({ length: budgetCents + 1 }, () => ({
        utility: Number.NEGATIVE_INFINITY,
        bundles: [] as TripBundle[]
      }))
  );
  for (let budget = 0; budget <= budgetCents; budget += 1) {
    dp[0][budget] = { utility: 0, bundles: [] };
  }

  for (const merchant of [...groups.keys()].sort((first, second) =>
    first.localeCompare(second)
  )) {
    const group = groups.get(merchant);
    if (!group) continue;
    const bundles: TripBundle[] = [];
    for (const combination of combinations(group, settings.maxDealsPerTrip)) {
      if (combination.length === 0) continue;
      if (
        combination.filter((deal) => deal.newCustomerOffer).length > 1
      ) {
        continue;
      }
      if (hasExclusiveStackConflict(combination)) continue;
      if (
        combination.length > 1 &&
        combination.some(
          (deal) => effectiveStackCompatibility(deal.opportunity) === "exclusive"
        )
      ) {
        continue;
      }
      if (
        hasUnconfirmedStackConflict(
          combination,
          settings.allowConditionalStacking
        )
      ) {
        continue;
      }
      bundles.push(makeBundle(combination));
    }

    const merchantBundles = bundles
      .filter((bundle) => Math.round(bundle.requiredSpend * 100) <= budgetCents)
      .sort((first, second) => second.utility - first.utility);
    if (merchantBundles.length === 0) continue;

    const next: typeof dp = [];
    for (let tripsUsed = 0; tripsUsed <= settings.maxTrips; tripsUsed += 1) {
      next[tripsUsed] = dp[tripsUsed].map((state) => ({
        utility: state.utility,
        bundles: [...state.bundles]
      }));
    }

    for (const bundle of merchantBundles) {
      const costCents = Math.round(bundle.requiredSpend * 100);
      for (let tripsUsed = 1; tripsUsed <= settings.maxTrips; tripsUsed += 1) {
        for (let budget = costCents; budget <= budgetCents; budget += 1) {
          const previous = dp[tripsUsed - 1][budget - costCents];
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
    dp = next;
  }

  let best = dp[0][budgetCents];
  for (let tripsUsed = 1; tripsUsed <= settings.maxTrips; tripsUsed += 1) {
    const candidate = dp[tripsUsed][budgetCents];
    if (
      candidate.utility > best.utility ||
      (candidate.utility === best.utility &&
        candidate.bundles.length < best.bundles.length)
    ) {
      best = candidate;
    }
  }

  const selectedBundles = [...best.bundles].sort((first, second) => {
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
    requiredSpend: bundle.requiredSpend,
    estimatedSavings: bundle.estimatedSavings,
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
    savingsRate:
      requiredSpend > 0 ? (estimatedSavings / requiredSpend) * 100 : 100,
    assumptions: [
      `Verified offers only; planned spend capped at $${settings.weeklyBudget.toFixed(2)}.`,
      `At most ${settings.maxTrips} merchants and ${settings.maxDealsPerTrip} deals per merchant.`,
      settings.includeUnconfirmedLocations
        ? "Unconfirmed locations are labeled and receive a planning penalty."
        : `Distances beyond ${settings.maxDistanceMiles} miles or unconfirmed are excluded.`,
      `Only offers whose official source was checked within the last ${settings.maximumSourceAgeDays} day${settings.maximumSourceAgeDays === 1 ? "" : "s"} are eligible.`,
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
    ]
  };
}









