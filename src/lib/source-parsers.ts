import type { DiscoverySource } from "./source-parsers-types";

export interface ParsedOfferCandidate {
  id: string;
  sourceId: string;
  merchant: string;
  title: string;
  detail?: string;
  url: string;
  amountText?: string;
  minimumSpend?: number;
  expirationText?: string;
  candidateScore?: number;
  candidateReasons?: string[];
}

interface ParserContext {
  source: DiscoverySource;
  pageUrl: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;|’/gi, "'")
    .replace(/&quot;|"/gi, '"')
    .replace(/[ \t]+/g, " ")
    .trim();
}

function absoluteUrl(pageUrl: string, value: string): string {
  return new URL(value, pageUrl).toString();
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72)}`;
}

function amountFromTitle(title: string): string | undefined {
  if (/\bfree\b/i.test(title)) return "Free";
  const earnedBack = title.match(/(?:earn|get|receive)\s+\$(\d+(?:\.\d{2})?)\s+back/i);
  if (earnedBack) return `$${earnedBack[1]} back`;
  const dollar = title.match(/\$\d+(?:\.\d{2})?(?:\s*(?:off|back))?/i);
  if (dollar) return dollar[0];
  const percentage = title.match(/\d+(?:\.\d+)?%\s*off/i);
  return percentage?.[0];
}

function minimumSpendFromTitle(title: string): number | undefined {
  const match = title.match(
    /\$\d+(?:\.\d{2})?\s*\+|spend\s+\$(\d+(?:\.\d{2})?)\+?|\bw\/\s*\$(\d+(?:\.\d{2})?)\b|\bwith\s+\$(\d+(?:\.\d{2})?)\b/i
  );
  if (!match) return undefined;
  const value = match[1] ?? match[2] ?? match[3] ?? match[0].replace(/[^0-9.]/g, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function expirationFromDetail(detail: string): string | undefined {
  return (
    detail.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/i)?.[0] ??
    detail.match(/\d+\s*-?\s*day expiration/i)?.[0]
  );
}

function dedupeCandidates(candidates: ParsedOfferCandidate[]): ParsedOfferCandidate[] {
  const bySemanticKey = new Map<string, ParsedOfferCandidate>();
  for (const candidate of candidates) {
    const key = semanticOfferKey(candidate);
    const existing = bySemanticKey.get(key);
    if (!existing) {
      bySemanticKey.set(key, candidate);
      continue;
    }

    const specificity = (candidate: ParsedOfferCandidate) =>
      (candidate.minimumSpend !== undefined ? 2 : 0) +
      (candidate.expirationText ? 2 : 0) +
      (candidate.detail ? 1 : 0);
    const candidateScore = specificity(candidate);
    const existingScore = specificity(existing);
    const preferred =
      candidateScore > existingScore ||
      (candidateScore === existingScore &&
        candidate.title.length < existing.title.length)
        ? candidate
        : existing;
    bySemanticKey.set(key, {
      ...preferred,
      minimumSpend: preferred.minimumSpend ?? existing.minimumSpend,
      expirationText: preferred.expirationText ?? existing.expirationText,
      detail: preferred.detail ?? existing.detail
    });
  }
  return Array.from(bySemanticKey.values());
}

export function semanticOfferKey(candidate: ParsedOfferCandidate): string {
  const stopWords = new Set([
    "a",
    "and",
    "app",
    "at",
    "back",
    "card",
    "that",
    "earn",
    "for",
    "future",
    "in",
    "money",
    "on",
    "order",
    "another",
    "paze",
    "per",
    "that's",
    "the",
    "times",
    "to",
    "up",
    "use",
    "users",
    "who",
    "wendy's",
    "will",
    "with",
    "you"
  ]);
  const normalized = candidate.title
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/[’]/g, "'")
    .replace(/w\//g, " ")
    .replace(/\$(\d+(?:\.\d{2})?)\+?/g, " dollars$1 ")
    .replace(/wendy'?s wednesday/g, " ")
    .replace(/\b(?:friday|fryday)\b/g, " ")
    .replace(/\bqualifying\b/g, " ")
    .replace(/crispy chicken sandwich or/g, "crispy chicken or")
    .replace(/[^a-z0-9$+]+/g, " ")
    .trim();
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => {
      if (token.length <= 1 || stopWords.has(token)) return false;
      if (/^dollars\d/.test(token)) return false;
      const numbers = new Set([
        candidate.minimumSpend?.toString(),
        candidate.amountText?.match(/\d+(?:\.\d{2})?/)?.[0]
      ]);
      const tokenNumber = token.replace(/[^0-9.]/g, "");
      return !((tokenNumber && numbers.has(tokenNumber)) || numbers.has(token));
    })
    .sort()
    .filter((token, index, allTokens) => token !== allTokens[index - 1]);

  return [
    candidate.amountText?.toLowerCase() ?? "unknown-amount",
    ...tokens
  ].join("|");
}

function parseWendys({ source, pageUrl }: ParserContext, html: string): ParsedOfferCandidate[] {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  );
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const offerLines = lines.filter((line) =>
    /\$|free/i.test(line) &&
    /(offer|nugg|fry|sandwich|combo|purchase|back)/i.test(line)
  );

  return dedupeCandidates(
    offerLines.map((line) => {
      const lineIndex = lines.indexOf(line);
      const nearbyDetail = lines
        .slice(lineIndex + 1, lineIndex + 6)
        .find((detail) => /(?:offer|valid)\s+(?:runs?\s+)?through|ends?\s+\d/i.test(detail));

      return {
        id: stableId(source.id, line),
        sourceId: source.id,
        merchant: "Wendy's",
        title: line,
        url: absoluteUrl(pageUrl, "/offers-coupons"),
        amountText: amountFromTitle(line),
        minimumSpend: minimumSpendFromTitle(line),
        expirationText: nearbyDetail ? expirationFromDetail(nearbyDetail) : undefined,
        detail: nearbyDetail && /terms|account|app/i.test(nearbyDetail) ? nearbyDetail : undefined
      };
    })
  );
}

function parseDutchBros({ source, pageUrl }: ParserContext, html: string): ParsedOfferCandidate[] {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  );
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const candidates: ParsedOfferCandidate[] = [];

  lines.forEach((line, index) => {
    const pointsMatch = line.match(/^(\d+)\s*points\s*=\s*free\s+(?:medium\s+)?drink$/i);
    if (pointsMatch) {
      candidates.push({
        id: stableId(source.id, line),
        sourceId: source.id,
        merchant: "Dutch Bros",
        title: line,
        url: pageUrl,
        amountText: "Free",
        detail: "Official Dutch Rewards redemption example; confirm current app terms."
      });
    }

    if (!/^free medium drink$/i.test(line)) return;
    const context = lines.slice(index + 1, index + 5);
    const download = context.find((detail) => /download the app|join dutch rewards/i.test(detail));
    if (!download) return;
    const terms = lines
      .slice(index + 1, index + 9)
      .find((detail) => /offer valid|expiration|terms apply/i.test(detail));

    candidates.push({
      id: stableId(source.id, `welcome-${download}`),
      sourceId: source.id,
      merchant: "Dutch Bros",
      title: "Free medium drink when you download the app and join Dutch Rewards",
      url: pageUrl,
      amountText: "Free",
      expirationText: terms ? expirationFromDetail(terms) : undefined,
      detail: terms
    });
  });

  return dedupeCandidates(candidates);
}

function parseTake5({ source, pageUrl }: ParserContext, html: string): ParsedOfferCandidate[] {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  );
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  let couponIndex = -1;
  lines.forEach((line, index) => {
    if (/oil change coupons/i.test(line)) couponIndex = index;
  });
  const couponLines = couponIndex >= 0 ? lines.slice(couponIndex, couponIndex + 12) : lines;
  const candidates = couponLines
    .map((line, index): ParsedOfferCandidate | null => {
      const amountMatch = line.match(/\$\d+(?:\.\d{2})?\s+off/i);
      if (!amountMatch) return null;

      const serviceLine =
        [couponLines[index - 1], couponLines[index + 1]].find((context) =>
          /oil change/i.test(context ?? "")
        ) ?? "";
      const title = /oil change/i.test(line)
        ? line
        : [line, serviceLine].filter(Boolean).join(" ");

      if (!/oil change/i.test(title)) return null;

      return {
      id: stableId(source.id, title),
      sourceId: source.id,
      merchant: "Take 5 Oil Change",
      title,
      url: pageUrl,
      amountText: amountMatch[0],
      detail:
        couponLines.find((detail) => /coupons have no cash value/i.test(detail)) ??
        "Confirm the official coupon and marketing-enrollment terms before redemption."
      };
    })
    .filter((candidate): candidate is ParsedOfferCandidate => candidate !== null);

  return dedupeCandidates(candidates);
}

function parseCostaOil({ source, pageUrl }: ParserContext, html: string): ParsedOfferCandidate[] {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  );
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const candidates: ParsedOfferCandidate[] = [];

  const percentIndex = lines.findIndex(
    (line) => /^30%(\s+off)?$/i.test(line)
  );
  if (percentIndex >= 0) {
    const context = lines.slice(Math.max(0, percentIndex - 5), percentIndex + 12);
    if (context.some((detail) => /any oil change/i.test(detail))) {
      const expirationText = context
        .map((line) => expirationFromDetail(line))
        .find((value): value is string => value !== undefined);
      const eligibility = context.find((line) =>
        /proof of service|military id/i.test(line)
      );
      const stackLimit = context.find((line) =>
        /cannot be combined/i.test(line)
      );
      const location = context.find((line) => /rayford/i.test(line));

      candidates.push({
        id: stableId(source.id, "30-percent-any-oil-change"),
        sourceId: source.id,
        merchant: "Costa Oil Spring Rayford",
        title:
          "30% off any oil change for veterans, military, and first responders",
        url: pageUrl,
        amountText: "30% off",
        expirationText,
        detail: [eligibility, stackLimit, location].filter(Boolean).join(" ")
      });
    }
  }

  lines.forEach((line, index) => {
    const amountMatch = line.match(/^\$(\d+)\s+off$/i);
    if (!amountMatch) return;

    const context = lines.slice(index + 1, index + 13);
    const isDiesel = context.some((detail) => /^diesel$/i.test(detail));
    const isFullSynthetic = context.some((detail) =>
      /full synthetic/i.test(detail)
    );
    if (!isFullSynthetic) return;

    const service = isDiesel ? "diesel full synthetic" : "full synthetic";
    const expirationText = context
      .map((detail) => expirationFromDetail(detail))
      .find((value): value is string => value !== undefined);
    const location = context.find((detail) => /rayford/i.test(detail));
    const stackLimit = context.find((detail) =>
      /cannot be combined/i.test(detail)
    );

    candidates.push({
      id: stableId(source.id, `${amountMatch[1]}-off-${service}`),
      sourceId: source.id,
      merchant: "Costa Oil Spring Rayford",
      title: `$${amountMatch[1]} off any ${service} oil change`,
      url: pageUrl,
      amountText: amountMatch[0],
      expirationText,
      detail: [location, stackLimit].filter(Boolean).join(" ")
    });
  });

  return dedupeCandidates(candidates);
}

function parseRainbowCarCare({ source, pageUrl }: ParserContext, html: string): ParsedOfferCandidate[] {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  );
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const location = lines.find((line) => /318 sawdust rd/i.test(line));
  const phone = lines.find((line) => /\(281\)\s*363-0021/.test(line));
  const restrictions = lines.find((line) =>
    /some restrictions apply/i.test(line)
  );
  const candidates: ParsedOfferCandidate[] = [];

  if (lines.some((line) => /^free full service car wash on your birthday!?$/i.test(line))) {
    candidates.push({
      id: stableId(source.id, "birthday-full-service-wash"),
      sourceId: source.id,
      merchant: "Rainbow Car Care",
      title: "Free full-service car wash on your birthday",
      url: pageUrl,
      amountText: "Free",
      detail: [restrictions, location, phone].filter(Boolean).join(" ")
    });
  }

  lines.forEach((line) => {
    const loyaltyMatch = line.match(/^Every 11th (.+?) is FREE(?:\s*\*)?$/i);
    if (!loyaltyMatch) return;

    candidates.push({
      id: stableId(source.id, `every-eleventh-${loyaltyMatch[1]}`),
      sourceId: source.id,
      merchant: "Rainbow Car Care",
      title: `Every 11th ${loyaltyMatch[1]} is free`,
      url: pageUrl,
      amountText: "Free",
      detail: [restrictions, location, phone].filter(Boolean).join(" ")
    });
  });

  return dedupeCandidates(candidates);
}

const PARSERS: Record<string, (context: ParserContext, html: string) => ParsedOfferCandidate[]> = {
  "dutch-bros-rewards": parseDutchBros,
  "costa-oil-rayford": parseCostaOil,
  "rainbow-car-care": parseRainbowCarCare,
  "wendys-offers": parseWendys,
  "take5-rayford": parseTake5
};

function candidateAmountValue(candidate: ParsedOfferCandidate): number {
  if (candidate.amountText?.toLowerCase() === "free") return 12;
  const dollar = candidate.amountText?.match(/\$(\d+(?:\.\d{2})?)/i);
  if (dollar) return Math.min(30, Number(dollar[1]) * 1.2);
  const percentage = candidate.amountText?.match(/(\d+(?:\.\d+)?)%/i);
  if (percentage) return Math.min(20, Number(percentage[1]) * 0.3);
  return 0;
}

export function rankOfferCandidates(
  candidates: ParsedOfferCandidate[],
  sourcePriorities: Record<string, number> = {},
  today = new Date()
): ParsedOfferCandidate[] {
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  function expirationRemaining(candidate: ParsedOfferCandidate): number | null {
    const dayWindow = candidate.expirationText?.match(/(\d+)\s*-?\s*day/i)?.[1];
    if (dayWindow) return Number(dayWindow);
    if (!candidate.expirationText?.includes("/")) return null;

    const expiration = new Date(candidate.expirationText);
    if (!Number.isFinite(expiration.getTime())) return null;

    return Math.ceil(
      (expiration.getTime() - endOfToday.getTime()) / 86_400_000
    );
  }

  return candidates
    .map((candidate) => {
      const reasons: string[] = [];
      const valuePoints = candidateAmountValue(candidate);
      if (valuePoints > 0) {
        reasons.push(
          candidate.amountText?.toLowerCase() === "free"
            ? "Free reward"
            : `${candidate.amountText} value`
        );
      }

      const spendRatio =
        candidate.minimumSpend && valuePoints > 0
          ? candidate.minimumSpend / Math.max(valuePoints / 1.2, 1)
          : null;
      const spendPoints =
        spendRatio === null
          ? 8
          : spendRatio <= 1
            ? 18
            : spendRatio <= 3
              ? 12
              : spendRatio <= 8
                ? 6
                : 2;
      if (candidate.minimumSpend) {
        reasons.push(`Requires ${candidate.minimumSpend} spend`);
      } else {
        reasons.push("No minimum captured");
      }

      const remaining = expirationRemaining(candidate);
      const isExpired = remaining !== null && remaining < 0;
      let timingPoints = 8;
      if (isExpired) {
        timingPoints = -100;
        reasons.push("Expired date");
      } else if (remaining !== null) {
        timingPoints = remaining <= 7 ? 18 : remaining <= 30 ? 13 : 8;
        reasons.push(
          typeof candidate.expirationText === "string" &&
            candidate.expirationText.includes("/")
            ? `Expires ${candidate.expirationText}`
            : `${remaining}-day window`
        );
      } else {
        reasons.push(
          candidate.expirationText ? "Expiration signal" : "No expiration captured"
        );
      }

      const sourcePriority = sourcePriorities[candidate.sourceId] ?? 5;
      const sourcePoints = Math.min(14, sourcePriority * 1.4);
      reasons.push(`Source priority ${sourcePriority}`);

      const titleQuality =
        candidate.title.length <= 90 ? 6 : candidate.title.length <= 160 ? 3 : 0;
      if (titleQuality === 0) reasons.push("Long title needs cleanup");

      const score = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            valuePoints +
              spendPoints +
              timingPoints +
              sourcePoints +
              titleQuality
          )
        )
      );

      return {
        ...candidate,
        candidateScore: score,
        candidateReasons: reasons
      };
    })
    .sort((first, second) => {
      if (second.candidateScore !== first.candidateScore) {
        return (second.candidateScore ?? 0) - (first.candidateScore ?? 0);
      }
      return `${first.merchant} ${first.title}`.localeCompare(
        `${second.merchant} ${second.title}`
      );
    });
}

export function parseSourceOffers(
  source: DiscoverySource,
  pageUrl: string,
  html: string
): ParsedOfferCandidate[] {
  const parser = PARSERS[source.id];
  if (!parser) return [];
  try {
    return parser({ source, pageUrl }, html);
  } catch {
    return [];
  }
}
