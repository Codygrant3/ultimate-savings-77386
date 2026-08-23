import type { OfferCandidate, Opportunity } from "../types";

export interface CandidateOfferMatch {
  opportunity: Opportunity;
  tokenOverlap: number;
  amountMatches: boolean;
  minimumSpendMatches: boolean;
  expirationMatches: boolean;
}

export type CandidateReviewContext =
  | { status: "new" }
  | { status: "existing"; match: CandidateOfferMatch };

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "eligible",
  "for",
  "off",
  "on",
  "or",
  "purchase",
  "the",
  "toward",
  "with",
  "w"
]);

function normalizedMerchant(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:rewards|reward|fuel|spring|rayford|road|rd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9$%]+/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/^[$%]+|[$%]+$/g, ""))
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
}

type Amount =
  | { kind: "unknown" }
  | { kind: "free" }
  | { kind: "dollar"; value: number }
  | { kind: "percent"; value: number };

function parseAmount(value: string | undefined): Amount {
  if (!value) return { kind: "unknown" };
  const text = value.toLowerCase();
  if (/\bfree\b/.test(text)) return { kind: "free" };

  const dollar = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (dollar) return { kind: "dollar", value: Number(dollar[1]) };

  const percent = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) return { kind: "percent", value: Number(percent[1]) };

  return { kind: "unknown" };
}

function amountsMatch(first: Amount, second: Amount): boolean {
  if (first.kind === "unknown") return true;
  if (second.kind === "unknown") return false;
  if (first.kind !== second.kind) return false;
  if (first.kind === "free" && second.kind === "free") return true;
  if (first.kind === "dollar" && second.kind === "dollar") {
    return Math.abs(first.value - second.value) < 0.01;
  }
  if (first.kind === "percent" && second.kind === "percent") {
    return Math.abs(first.value - second.value) < 0.01;
  }
  return false;
}

function expirationDate(value: string | undefined): string | null {
  if (!value) return null;

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const numeric = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!numeric) return null;

  const month = numeric[1].padStart(2, "0");
  const day = numeric[2].padStart(2, "0");
  const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
  return `${year}-${month}-${day}`;
}

function merchantsMatch(candidate: OfferCandidate, opportunity: Opportunity): boolean {
  const left = normalizedMerchant(candidate.merchant);
  const right = normalizedMerchant(opportunity.merchant);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function tokenOverlap(candidate: OfferCandidate, opportunity: Opportunity): number {
  const left = titleTokens(
    [candidate.title, candidate.detail].filter(Boolean).join(" ")
  );
  const right = titleTokens(
    [
      opportunity.title,
      opportunity.summary,
      opportunity.tags.join(" "),
      opportunity.finePrint
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.min(left.size, right.size);
}

export function findCandidateMatch(
  candidate: OfferCandidate,
  opportunities: Opportunity[]
): CandidateOfferMatch | null {
  const candidateAmount = parseAmount(candidate.amountText);
  const matches: CandidateOfferMatch[] = [];

  for (const opportunity of opportunities) {
    if (!merchantsMatch(candidate, opportunity)) continue;

    const overlap = tokenOverlap(candidate, opportunity);
    if (overlap < 0.34) continue;

    const opportunityAmount: Amount = opportunity.isFree
      ? { kind: "free" }
      : opportunity.savingsRate !== undefined
        ? { kind: "percent", value: opportunity.savingsRate }
      : opportunity.estimatedSavings > 0
        ? { kind: "dollar", value: opportunity.estimatedSavings }
        : { kind: "unknown" };
    const candidateExpiration = expirationDate(candidate.expirationText);
    const opportunityExpiration = expirationDate(opportunity.expiresOn);

    matches.push({
      opportunity,
      tokenOverlap: overlap,
      amountMatches: amountsMatch(candidateAmount, opportunityAmount),
      minimumSpendMatches:
        candidate.minimumSpend === undefined ||
        Math.abs(candidate.minimumSpend - opportunity.minimumSpend) < 0.01,
      expirationMatches:
        candidateExpiration === null ||
        (opportunityExpiration !== null &&
          candidateExpiration === opportunityExpiration)
    });
  }

  return matches.sort((first, second) => {
    if (second.tokenOverlap !== first.tokenOverlap) {
      return second.tokenOverlap - first.tokenOverlap;
    }
    const firstEvidence =
      Number(first.amountMatches) +
      Number(first.minimumSpendMatches) +
      Number(first.expirationMatches);
    const secondEvidence =
      Number(second.amountMatches) +
      Number(second.minimumSpendMatches) +
      Number(second.expirationMatches);
    if (secondEvidence !== firstEvidence) return secondEvidence - firstEvidence;
    return first.opportunity.id.localeCompare(second.opportunity.id);
  })[0] ?? null;
}

export function buildCandidateReviewContext(
  candidate: OfferCandidate,
  opportunities: Opportunity[]
): CandidateReviewContext {
  const match = findCandidateMatch(candidate, opportunities);
  return match ? { status: "existing", match } : { status: "new" };
}
