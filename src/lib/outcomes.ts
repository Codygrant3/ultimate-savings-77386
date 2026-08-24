import type { ReceiptEntry } from "../types";

export interface OfferOutcomeAdjustment {
  ratio: number;
  samples: number;
  adjustment: number;
}

export type OfferOutcomeAdjustments = Record<string, OfferOutcomeAdjustment>;

const HALF_LIFE_DAYS = 60;
const CONFIDENCE_TARGET = 3;

function recencyWeight(occurredOn: string, today: Date): number {
  const occurred = new Date(`${occurredOn}T12:00:00`);
  if (!Number.isFinite(occurred.getTime()) || occurred > today) return 0;

  const ageDays = Math.max(
    0,
    Math.floor((today.getTime() - occurred.getTime()) / 86_400_000)
  );
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function buildOfferOutcomeAdjustments(
  receipts: ReceiptEntry[],
  today = new Date()
): OfferOutcomeAdjustments {
  const evidence = new Map<
    string,
    { actual: number; listed: number; weight: number }
  >();

  for (const receipt of receipts) {
    if (
      !receipt.opportunityId ||
      typeof receipt.listedValue !== "number" ||
      !Number.isFinite(receipt.listedValue) ||
      receipt.listedValue <= 0 ||
      !Number.isFinite(receipt.actualSavings) ||
      receipt.actualSavings < 0
    ) {
      continue;
    }

    const weight = recencyWeight(receipt.occurredOn, today);
    if (weight === 0) continue;

    const current = evidence.get(receipt.opportunityId) ?? {
      actual: 0,
      listed: 0,
      weight: 0
    };
    current.actual += Math.max(0, receipt.actualSavings) * weight;
    current.listed += receipt.listedValue * weight;
    current.weight += weight;
    evidence.set(receipt.opportunityId, current);
  }

  return Object.fromEntries(
    Array.from(evidence.entries()).map(([offerId, item]) => {
      const rawRatio = item.actual / item.listed;
      const boundedRatio = Math.min(1.5, Math.max(0.5, rawRatio));
      const confidence = Math.min(item.weight / CONFIDENCE_TARGET, 1);
      const adjustment = Math.min(
        1.25,
        Math.max(0.75, 1 + (boundedRatio - 1) * confidence)
      );

      return [
        offerId,
        {
          ratio: Number(boundedRatio.toFixed(3)),
          samples: Number(item.weight.toFixed(3)),
          adjustment: Number(adjustment.toFixed(3))
        }
      ];
    })
  );
}
