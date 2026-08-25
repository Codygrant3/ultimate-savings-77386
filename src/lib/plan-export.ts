import {
  effectiveStackCompatibility,
  formatCurrency,
  formatDate
} from "./scoring";
import type { ScoredOpportunity, WeeklyPlan } from "../types";

function checklistDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function effortLabel(friction: "low" | "medium" | "high"): string {
  return {
    low: "Low",
    medium: "Medium",
    high: "High"
  }[friction];
}

function stackTerms(opportunity: ScoredOpportunity): string {
  switch (effectiveStackCompatibility(opportunity)) {
    case "compatible":
      return "Compatible stack documented";
    case "exclusive":
      return "Official terms restrict combining offers";
    default:
      return "Stack terms require confirmation";
  }
}

function redemptionDays(opportunity: ScoredOpportunity): string | null {
  const days = opportunity.availableDaysOfWeek;
  if (!Array.isArray(days) || days.length === 0) return null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC"
  });
  const labels = [...new Set(days)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((first, second) => first - second)
    .map((day) =>
      formatter.format(new Date(Date.UTC(2026, 0, 4 + day)))
    );
  return labels.length > 0 ? labels.join(", ") : null;
}

export function buildWeeklyPlanChecklist(
  plan: WeeklyPlan,
  generatedOn = new Date()
): string {
  const lines: string[] = [
    "# Weekly savings action plan",
    "",
    `Generated ${checklistDate(generatedOn)}`,
    "",
    `**Official estimated savings:** ${formatCurrency(plan.estimatedSavings)}`,
    `**Planned spend:** ${formatCurrency(plan.requiredSpend)}`,
    `**Estimated net cost:** ${formatCurrency(plan.estimatedNetCost)}`,
    ""
  ];

  if (plan.trips.length === 0) {
    lines.push("No verified offers fit the selected limits.", "");
    return lines.join("\n");
  }

  plan.trips.forEach((trip, index) => {
    const distance = trip.distanceConfirmed
      ? `${trip.distanceMiles} mi (approximate)`
      : "location unconfirmed";
    lines.push(
      `## Trip ${index + 1}: ${trip.merchant}`,
      "",
      `- Spend: ${formatCurrency(trip.requiredSpend)}`
    );
    if (trip.netBenefitAfterTravel != null) {
      lines.push(
        `- Risk-adjusted benefit after travel: ${formatCurrency(trip.netBenefitAfterTravel)}`
      );
    }
    lines.push(
      `- Distance: ${distance}`,
      `- Planning confidence: ${Math.round(trip.evidenceConfidence * 100)}%`,
      ""
    );

    for (const { opportunity, warnings } of trip.deals) {
      lines.push(
        `- [ ] ${opportunity.title} — ${formatCurrency(opportunity.estimatedSavings)} value${
          opportunity.minimumSpend > 0
            ? `; spend ${formatCurrency(opportunity.minimumSpend)}`
            : "; no required spend"
        }${opportunity.expiresOn ? `; ends ${formatDate(opportunity.expiresOn)}` : ""}`
      );
      const days = redemptionDays(opportunity);
      if (days) {
        lines.push(`  - Official day window: ${days}`);
      }
      lines.push(`  - Source: ${opportunity.source.url}`);
      lines.push(`  - Location: ${opportunity.locationNote}`);
      lines.push(
        `  - Effort: ${effortLabel(opportunity.friction)}`
      );
      lines.push(`  - Stack terms: ${stackTerms(opportunity)}`);
      lines.push(
        `  - Source checked: ${formatDate(opportunity.source.checkedOn)}`
      );
      for (const warning of warnings) {
        lines.push(`  - Confirm: ${warning}`);
      }
    }
    lines.push("");
  });

  lines.push(
    "## Before you shop",
    "",
    ...plan.assumptions.map((assumption) => `- ${assumption}`),
    "- Confirm current terms at each official source and in-store before purchase.",
    ""
  );

  return lines.join("\n");
}

export function weeklyPlanChecklistFileName(generatedOn = new Date()): string {
  return `savings-action-plan-${checklistDate(generatedOn)}.md`;
}
