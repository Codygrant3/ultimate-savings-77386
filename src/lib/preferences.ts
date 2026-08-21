import type {
  Category,
  LearnedPreferences,
  PreferenceEvidence,
  ReceiptEntry
} from "../types";

const CATEGORIES: Category[] = [
  "restaurants",
  "grocery",
  "fuel",
  "coffee",
  "convenience",
  "local",
  "auto",
  "movies",
  "sports",
  "tax-free",
  "shopping",
  "financial",
  "entertainment",
  "home"
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function recencyWeight(occurredOn: string, today: Date): number {
  const occurred = new Date(`${occurredOn}T12:00:00`);
  if (Number.isNaN(occurred.getTime()) || occurred.getTime() > today.getTime()) {
    return 0;
  }
  const ageDays = Math.floor(
    (today.getTime() - occurred.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.pow(0.5, ageDays / 60);
}

function emptyEvidence(): Record<Category, PreferenceEvidence> {
  return Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      { count: 0, confirmedSavings: 0 }
    ])
  ) as Record<Category, PreferenceEvidence>;
}

function affinity(
  rate: number,
  baselineRate: number,
  weightedCount: number,
  confidenceTarget: number,
  confirmedSavings = 0
): number {
  const lift = rate / Math.max(baselineRate, 1);
  const raw = clamp((lift - 1) / 2, -0.75, 0.75);
  const confidence = Math.min(weightedCount, confidenceTarget) / confidenceTarget;
  const participation =
    confirmedSavings > 0 ? Math.min(weightedCount / 3, 1) * 0.15 : 0;
  const value = clamp(raw * confidence + participation * confidence, -0.75, 0.75);

  if (weightedCount < 1 || (rate === 0 && weightedCount < 2)) return 0;
  return Number(value.toFixed(3));
}

export function buildLearnedPreferences(
  receipts: ReceiptEntry[],
  today = new Date()
): LearnedPreferences {
  const categoryEvidence = emptyEvidence();
  const merchantEvidence: Record<string, PreferenceEvidence> = {};
  let totalWeight = 0;
  let totalSavings = 0;

  for (const receipt of receipts) {
    const weight = recencyWeight(receipt.occurredOn, today);
    if (weight === 0) continue;

    const savings = Math.max(0, receipt.actualSavings);
    const category = categoryEvidence[receipt.category];
    if (!category) continue;

    category.count += weight;
    category.confirmedSavings += savings;
    totalWeight += weight;
    totalSavings += savings;

    const merchantKey = receipt.merchant.trim().toLowerCase();
    if (merchantKey) {
      merchantEvidence[merchantKey] ??= { count: 0, confirmedSavings: 0 };
      merchantEvidence[merchantKey].count += weight;
      merchantEvidence[merchantKey].confirmedSavings += savings;
    }
  }

  const categoryAffinity = Object.fromEntries(
    CATEGORIES.map((category) => {
      const evidence = categoryEvidence[category];
      const rate = evidence.count > 0 ? evidence.confirmedSavings / evidence.count : 0;
      return [
        category,
        affinity(
          rate,
          totalSavings / Math.max(totalWeight, 1),
          evidence.count,
          3,
          evidence.confirmedSavings
        )
      ];
    })
  ) as Record<Category, number>;

  const merchantAffinity = Object.fromEntries(
    Object.entries(merchantEvidence).map(([merchant, evidence]) => {
      const rate = evidence.count > 0 ? evidence.confirmedSavings / evidence.count : 0;
      return [
        merchant,
        affinity(
          rate,
          totalSavings / Math.max(totalWeight, 1),
          evidence.count,
          2,
          evidence.confirmedSavings
        )
      ];
    })
  );

  return {
    categoryAffinity,
    merchantAffinity,
    categoryEvidence,
    merchantEvidence
  };
}
