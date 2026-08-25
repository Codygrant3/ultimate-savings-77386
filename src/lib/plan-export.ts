import { formatCurrency, formatDate } from "./scoring";
import type { WeeklyPlan } from "../types";

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
      lines.push(`  - Source: ${opportunity.source.url}`);
      lines.push(`  - Location: ${opportunity.locationNote}`);
      lines.push(
        `  - Effort: ${effortLabel(opportunity.friction)}`
      );
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
