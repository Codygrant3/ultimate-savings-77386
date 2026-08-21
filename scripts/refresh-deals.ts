import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface DiscoverySource {
  id: string;
  name: string;
  url: string;
  category: string;
  priority: number;
  keywords: string[];
}

type DiscoveryStatus = "new" | "improved" | "changed" | "unchanged" | "failed";

interface DiscoveryResult extends DiscoverySource {
  canonicalUrl: string;
  checkedAt: string;
  status: DiscoveryStatus;
  matchedKeywords: string[];
  contentHash?: string;
  title?: string;
  error?: string;
}

interface DiscoveryReport {
  generatedAt: string;
  sourceCount: number;
  successfulCount: number;
  failedCount: number;
  newOrImprovedCount: number;
  results: DiscoveryResult[];
  highValueMatches: DiscoveryResult[];
  limitations: string[];
}

interface GroceryPrice {
  retailer: string;
  unitPrice: number | null;
  unit: string;
  status: "verified-local" | "official-needs-local-check" | "unavailable";
  sourceUrl: string;
  checkedOn?: string;
}

interface GroceryComparison {
  id: string;
  item: string;
  prices: GroceryPrice[];
}

interface GroceryComparisonCatalog {
  checkedOn: string;
  comparisons: GroceryComparison[];
}

interface GroceryWatchlistSnapshot {
  generatedAt: string;
  checkedOn: string;
  items: Array<{
    id: string;
    item: string;
    comparisonId: string;
    targetPrice: number;
    latestPrice: number;
    unit: string;
    retailer: string;
    sourceLabel: string;
    sourceUrl: string;
    checkedOn: string;
    locationStatus: GroceryPrice["status"];
  }>;
}

interface SettlementRecord {
  id: string;
  claimDeadline: string;
  verification: "official-administrator" | "court-authorized-notice";
  checkedOn: string;
  feeRequired: false;
  eligibilityStatus: "user-confirmation-required";
  [key: string]: unknown;
}

interface SettlementSnapshot {
  generatedAt: string;
  checkedOn: string;
  openCount: number;
  settlements: SettlementRecord[];
  excludedRules: string[];
  limitations: string[];
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const sourcePath = resolve(
  projectRoot,
  "src",
  "data",
  "discovery-sources.json",
);
const groceryComparisonPath = resolve(
  projectRoot,
  "src",
  "data",
  "local-grocery-comparisons.json",
);
const settlementCatalogPath = resolve(
  projectRoot,
  "src",
  "data",
  "settlements.json",
);
const discoveryDirectory = resolve(projectRoot, "reports", "discovery");
const publicDirectory = resolve(projectRoot, "public", "reports");
const latestJsonPath = resolve(discoveryDirectory, "latest.json");
const groceryTargetPrices: Record<string, number> = {
  "ground-beef-80-20": 5,
  "roma-tomatoes": 1,
  "whole-milk-gallon": 3,
  "walmart-local-rollbacks": 1.75,
  "walmart-local-fresh-sausage": 3,
  "family-size-cheerios": 0.22,
  "walmart-local-blueberries": 0.3,
  "walmart-local-watermelon": 5,
  "walmart-local-brown-eggs": 0.25,
  "walmart-local-peanut-butter": 0.1,
  "walmart-local-avocados": 0.75,
};

function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function normalizePage(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1].replace(/\s+/g, " ").trim();
}

async function readPriorReport(): Promise<DiscoveryReport | null> {
  try {
    return JSON.parse(
      await readFile(latestJsonPath, "utf8"),
    ) as DiscoveryReport;
  } catch {
    return null;
  }
}

async function checkSource(
  source: DiscoverySource,
  previous: DiscoveryResult | undefined,
  checkedAt: string,
): Promise<DiscoveryResult> {
  const canonicalUrl = canonicalizeUrl(source.url);

  try {
    const response = await fetch(source.url, {
      headers: {
        "user-agent": "77386-Savings-Desk/0.1 public-source-monitor",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const normalized = normalizePage(html);
    const contentHash = createHash("sha256").update(normalized).digest("hex");
    const matchedKeywords = source.keywords.filter((keyword) =>
      normalized.includes(keyword.toLowerCase()),
    );
    const previousHitCount = previous?.matchedKeywords.length ?? 0;
    const status: DiscoveryStatus = !previous
      ? "new"
      : previous.contentHash === contentHash
        ? "unchanged"
        : matchedKeywords.length > previousHitCount
          ? "improved"
          : "changed";

    return {
      ...source,
      canonicalUrl,
      checkedAt,
      status,
      matchedKeywords,
      contentHash,
      title: extractTitle(html),
    };
  } catch (error) {
    return {
      ...source,
      canonicalUrl,
      checkedAt,
      status: "failed",
      matchedKeywords: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildMarkdown(report: DiscoveryReport): string {
  const matches =
    report.highValueMatches.length > 0
      ? report.highValueMatches
          .map(
            (result) =>
              `- **${result.name}** (${result.category}, ${result.status}) — matched: ${
                result.matchedKeywords.join(", ") || "no configured terms"
              } — [official source](${result.url})`,
          )
          .join("\n")
      : "- No new or improved high-priority public-source matches cleared the filter.";
  const failures = report.results
    .filter((result) => result.status === "failed")
    .map((result) => `- ${result.name}: ${result.error}`)
    .join("\n");

  return `# 77386 Deal Discovery Refresh

**Generated:** ${report.generatedAt}  
**Sources checked:** ${report.sourceCount}  
**Successful:** ${report.successfulCount}  
**Failed:** ${report.failedCount}  
**New or improved high-value matches:** ${report.newOrImprovedCount}

## Review queue

${matches}

## Source failures

${failures || "- None."}

## Boundaries

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}

function buildGroceryWatchlistSnapshot(
  catalog: GroceryComparisonCatalog,
  generatedAt: string,
): GroceryWatchlistSnapshot {
  const items = catalog.comparisons.flatMap((comparison) => {
    const available = comparison.prices.filter(
      (entry) => entry.unitPrice !== null && entry.status !== "unavailable",
    );
    const locallyVerified = available.filter(
      (entry) => entry.status === "verified-local",
    );
    const eligible = locallyVerified.length > 0 ? locallyVerified : available;
    const selected = [...eligible].sort(
      (first, second) =>
        (first.unitPrice ?? Number.POSITIVE_INFINITY) -
        (second.unitPrice ?? Number.POSITIVE_INFINITY),
    )[0];
    if (!selected || selected.unitPrice === null) return [];

    return [
      {
        id: `watch-${comparison.id}`,
        item: comparison.item,
        comparisonId: comparison.id,
        targetPrice: groceryTargetPrices[comparison.id] ?? selected.unitPrice,
        latestPrice: selected.unitPrice,
        unit: `per ${selected.unit}`,
        retailer: selected.retailer,
        sourceLabel: `${selected.retailer} official listing`,
        sourceUrl: selected.sourceUrl,
        checkedOn: selected.checkedOn ?? catalog.checkedOn,
        locationStatus: selected.status,
      },
    ];
  });

  return {
    generatedAt,
    checkedOn: catalog.checkedOn,
    items,
  };
}

function buildSettlementSnapshot(
  settlements: SettlementRecord[],
  generatedAt: string,
): SettlementSnapshot {
  const today = generatedAt.slice(0, 10);
  const openSettlements = settlements
    .filter(
      (settlement) =>
        settlement.claimDeadline >= today &&
        settlement.feeRequired === false &&
        settlement.eligibilityStatus === "user-confirmation-required" &&
        ["official-administrator", "court-authorized-notice"].includes(
          settlement.verification,
        ),
    )
    .sort((first, second) =>
      first.claimDeadline.localeCompare(second.claimDeadline),
    );

  return {
    generatedAt,
    checkedOn:
      openSettlements
        .map((settlement) => settlement.checkedOn)
        .sort()
        .at(-1) ?? today,
    openCount: openSettlements.length,
    settlements: openSettlements,
    excludedRules: [
      "Expired claim deadline",
      "No official court notice or verified settlement-administrator source",
      "Payment requested to file",
      "Lead-generation, unverifiable, or scam-like listing",
    ],
    limitations: [
      "Dashboard ranking is a review aid and never confirms household eligibility.",
      "Official deadlines and benefits can change; recheck the linked notice before acting.",
      "Every claim form, eligibility statement, and legal attestation remains a manual user action.",
      "No Social Security number, bank or payment detail, credential, claim identifier, VIN, or exact household data is stored.",
    ],
  };
}

async function main(): Promise<void> {
  const [sources, groceryCatalog, settlementCatalog] = await Promise.all([
    readFile(sourcePath, "utf8").then(
      (value) => JSON.parse(value) as DiscoverySource[],
    ),
    readFile(groceryComparisonPath, "utf8").then(
      (value) => JSON.parse(value) as GroceryComparisonCatalog,
    ),
    readFile(settlementCatalogPath, "utf8").then(
      (value) => JSON.parse(value) as SettlementRecord[],
    ),
  ]);
  const deduplicatedSources = Array.from(
    new Map(
      sources.map((source) => [canonicalizeUrl(source.url), source]),
    ).values(),
  );
  const prior = await readPriorReport();
  const previousByUrl = new Map(
    prior?.results.map((result) => [result.canonicalUrl, result]) ?? [],
  );
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(
    deduplicatedSources.map((source) =>
      checkSource(
        source,
        previousByUrl.get(canonicalizeUrl(source.url)),
        checkedAt,
      ),
    ),
  );
  const highValueMatches = results.filter(
    (result) =>
      (result.status === "new" || result.status === "improved") &&
      result.priority >= 8 &&
      result.matchedKeywords.length > 0,
  );
  const report: DiscoveryReport = {
    generatedAt: checkedAt,
    sourceCount: results.length,
    successfulCount: results.filter((result) => result.status !== "failed")
      .length,
    failedCount: results.filter((result) => result.status === "failed").length,
    newOrImprovedCount: highValueMatches.length,
    results,
    highValueMatches,
    limitations: [
      "This monitor checks configured public pages; it is not a general web search engine.",
      "JavaScript-only, bot-protected, personalized, or app-only offers can be unavailable.",
      "A changed page is a review lead, not a verified deal. Human review is required before adding value to the dashboard.",
      "No account credentials, cookies, email addresses, or payment information are used or stored.",
    ],
  };
  const groceryWatchlist = buildGroceryWatchlistSnapshot(
    groceryCatalog,
    checkedAt,
  );
  const settlementSnapshot = buildSettlementSnapshot(
    settlementCatalog,
    checkedAt,
  );

  await Promise.all([
    mkdir(discoveryDirectory, { recursive: true }),
    mkdir(publicDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(
      resolve(discoveryDirectory, "latest.md"),
      buildMarkdown(report),
      "utf8",
    ),
    writeFile(
      resolve(publicDirectory, "discovery.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(discoveryDirectory, "grocery-watchlist.json"),
      `${JSON.stringify(groceryWatchlist, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(publicDirectory, "grocery-watchlist.json"),
      `${JSON.stringify(groceryWatchlist, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(discoveryDirectory, "settlements.json"),
      `${JSON.stringify(settlementSnapshot, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(publicDirectory, "settlements.json"),
      `${JSON.stringify(settlementSnapshot, null, 2)}\n`,
      "utf8",
    ),
  ]);

  console.log(`Public sources checked: ${report.sourceCount}`);
  console.log(`Successful: ${report.successfulCount}`);
  console.log(`Failed: ${report.failedCount}`);
  console.log(
    `New or improved high-value matches: ${report.newOrImprovedCount}`,
  );
  console.log(
    `Staples watch prices normalized: ${groceryWatchlist.items.length}`,
  );
  console.log(
    `Verified open settlements staged: ${settlementSnapshot.openCount}`,
  );
  console.log(`Review queue: ${resolve(discoveryDirectory, "latest.md")}`);
}

await main();
