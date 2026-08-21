import { formatCurrency } from "./scoring";
import type { ScoredOpportunity, ValueAlert, ValueAlertSettings } from "../types";

export const DEFAULT_VALUE_ALERT_SETTINGS: ValueAlertSettings = {
  minimumValue: 10,
  includeFreeRewards: true,
  maximumFriction: "medium"
};

const FRICTION_RANK = {
  low: 1,
  medium: 2,
  high: 3
};

function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VALUE_ALERT_SETTINGS.minimumValue;
  return Math.min(500, Math.max(0, value));
}

export function normalizeValueAlertSettings(
  settings: Partial<ValueAlertSettings> | null | undefined
): ValueAlertSettings {
  const maximumFriction =
    settings?.maximumFriction === "low" ||
    settings?.maximumFriction === "medium" ||
    settings?.maximumFriction === "any"
      ? settings.maximumFriction
      : DEFAULT_VALUE_ALERT_SETTINGS.maximumFriction;

  return {
    minimumValue: clampThreshold(settings?.minimumValue ?? DEFAULT_VALUE_ALERT_SETTINGS.minimumValue),
    includeFreeRewards:
      typeof settings?.includeFreeRewards === "boolean"
        ? settings.includeFreeRewards
        : DEFAULT_VALUE_ALERT_SETTINGS.includeFreeRewards,
    maximumFriction
  };
}

export function buildValueAlerts(
  opportunities: ScoredOpportunity[],
  rawSettings: ValueAlertSettings,
  acknowledgedIds: string[]
): ValueAlert[] {
  const settings = normalizeValueAlertSettings(rawSettings);
  const acknowledged = new Set(acknowledgedIds);

  return opportunities
    .filter((opportunity) => opportunity.verification === "verified")
    .filter((opportunity) => !acknowledged.has(opportunity.id))
    .filter(
      (opportunity) =>
        FRICTION_RANK[opportunity.friction] <=
        (settings.maximumFriction === "any"
          ? FRICTION_RANK.high
          : FRICTION_RANK[settings.maximumFriction])
    )
    .filter(
      (opportunity) =>
        opportunity.estimatedSavings >= settings.minimumValue ||
        (settings.includeFreeRewards && opportunity.isFree)
    )
    .map((opportunity) => ({
      id: opportunity.id,
      merchant: opportunity.merchant,
      title: opportunity.title,
      estimatedSavings: opportunity.estimatedSavings,
      expiresOn: opportunity.expiresOn,
      sourceUrl: opportunity.source.url,
      reason:
        opportunity.estimatedSavings >= settings.minimumValue
          ? `${formatCurrency(opportunity.estimatedSavings)} clears the ${formatCurrency(
              settings.minimumValue
            )} threshold`
          : "Included free reward"
    }))
    .sort((first, second) => {
      if (second.estimatedSavings !== first.estimatedSavings) {
        return second.estimatedSavings - first.estimatedSavings;
      }
      return (first.expiresOn ?? "9999-12-31").localeCompare(
        second.expiresOn ?? "9999-12-31"
      );
    });
}
