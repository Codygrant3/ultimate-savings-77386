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
  const dollar = title.match(/\$\d+(?:\.\d{2})?(?:\s*(?:off|back))?/i);
  if (dollar) return dollar[0];
  const percentage = title.match(/\d+(?:\.\d+)?%\s*off/i);
  return percentage?.[0];
}

function minimumSpendFromTitle(title: string): number | undefined {
  const match = title.match(
    /\$\d+(?:\.\d{2})?\s*\+|\bw\/\s*\$(\d+(?:\.\d{2})?)\b|\bwith\s+\$(\d+(?:\.\d{2})?)\b/i
  );
  if (!match) return undefined;
  const value = match[1] ?? match[2] ?? match[0].replace(/[^0-9.]/g, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function expirationFromDetail(detail: string): string | undefined {
  return detail.match(
    /\d{1,2}\/\d{1,2}\/\d{2,4}/i
  )?.[0];
}

function dedupeCandidates(candidates: ParsedOfferCandidate[]): ParsedOfferCandidate[] {
  return Array.from(
    new Map(candidates.map((candidate) => [candidate.title.toLowerCase(), candidate])).values()
  );
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

const PARSERS: Record<string, (context: ParserContext, html: string) => ParsedOfferCandidate[]> = {
  "wendys-offers": parseWendys,
  "take5-rayford": parseTake5
};

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
