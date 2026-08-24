import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCurrency, rankOpportunities, startOfWeek } from "../src/lib/scoring.ts";
import { rankSettlements } from "../src/lib/settlements.ts";
import type {
  ClassActionSettlement,
  LocalMerchantInventory,
  Opportunity,
  WeeklyReport
} from "../src/types.ts";

import localMerchantInventoryData from "../src/data/local-merchant-inventory.json";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const dataPath = resolve(projectRoot, "src", "data", "opportunities.json");
const settlementDataPath = resolve(
  projectRoot,
  "src",
  "data",
  "settlements.json"
);
const merchantInventory = localMerchantInventoryData as LocalMerchantInventory;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildMarkdown(
  report: WeeklyReport,
  settlements: ClassActionSettlement[]
): string {
  const verifiedLines =
    report.opportunities.length > 0
      ? report.opportunities
          .map((opportunity, index) => {
            const expiration = opportunity.expiresOn
              ? ` Ends ${opportunity.expiresOn}.`
              : "";
            const value =
              opportunity.estimatedSavings > 0
                ? ` Estimated value: ${formatCurrency(opportunity.estimatedSavings)}.`
                : "";
            const distance =
              opportunity.distanceMiles !== undefined
                ? ` Reference distance: ${opportunity.distanceMiles} miles; promotion participation is not confirmed.`
                : "";
            const availability =
              opportunity.availability === "waitlist"
                ? " Availability: waitlist."
                : "";
            return [
              `${index + 1}. **${opportunity.merchant}: ${opportunity.title}**`,
              `   - Score: ${opportunity.score}/100 (${opportunity.scoreLabel}).${value}${expiration}${distance}${availability}`,
              `   - ${opportunity.summary}`,
              ...(opportunity.stackNote ? [`   - Stack: ${opportunity.stackNote}`] : []),
              ...(opportunity.finePrint ? [`   - Fine print: ${opportunity.finePrint}`] : []),
              `   - Source: [${opportunity.source.label}](${opportunity.source.url}) — checked ${opportunity.source.checkedOn}.`
            ].join("\n");
          })
          .join("\n\n")
      : "No active, source-checked opportunities are in the tracker.";

  const watchlistLines =
    report.watchlist.length > 0
      ? report.watchlist
          .map(
            (opportunity) =>
              `- **${opportunity.merchant}:** ${opportunity.title} — [check source](${opportunity.source.url}).`
          )
          .join("\n")
      : "No program or research leads are on the watchlist.";

  const settlementLines =
    settlements.length > 0
      ? settlements
          .slice(0, 4)
          .map(
            (settlement, index) =>
              `${index + 1}. **${settlement.shortTitle}** — claim deadline ${settlement.claimDeadline}; ${settlement.estimatedBenefit}\n` +
              `   - Possible relevance: ${settlement.relevanceReason}\n` +
              `   - Eligibility: **not confirmed**. ${settlement.eligibilitySummary}\n` +
              `   - Proof signal: ${settlement.proofSummary}\n` +
              `   - [Official source](${settlement.sourceUrl}) — checked ${settlement.checkedOn}.`
          )
          .join("\n\n")
      : "No open, source-checked settlement examples cleared the safety filter.";

  return `# 77386 Weekly Savings Brief

**Week of:** ${report.weekOf}  
**Generated:** ${report.generatedAt}  
**Source-checked opportunities:** ${report.verifiedCount}  
**Potential savings identified:** ${formatCurrency(report.totalPotentialSavings)}

> Confirm offer eligibility in the merchant app or site before making a special trip. Personalized offers can vary by account and location.

## Act this week

${verifiedLines}

## Rewards-program watchlist

These are official programs or research leads, not assumed current freebies.

${watchlistLines}

## Class action settlement watch

These are official, open examples ranked only for review. The report does not
confirm household eligibility and cannot file a claim.

${settlementLines}

> Informational only, not legal advice. Read the official notice, confirm every
> eligibility fact truthfully, and submit any form yourself. Never pay to file.

## Savings filter

This report intentionally excludes expired offers, unsourced social posts, generic "up to" claims, and promotions that do not have enough evidence to support an action.

## Safe account practice

The tracker stores no email address, password, payment information, rewards-account
credential, Social Security number, bank detail, claim identifier, VIN, or exact
household data. Settlement attestations and submissions are always manual.
`;
}

async function main(): Promise<void> {
  const [rawData, rawSettlementData] = await Promise.all([
    readFile(dataPath, "utf8"),
    readFile(settlementDataPath, "utf8")
  ]);
  const opportunities = JSON.parse(rawData) as Opportunity[];
  const settlementCatalog = JSON.parse(
    rawSettlementData
  ) as ClassActionSettlement[];
  const now = new Date();
  const ranked = rankOpportunities(
    opportunities,
    now,
    undefined,
    merchantInventory
  );
  const verified = ranked.filter((opportunity) => opportunity.verification === "verified");
  const watchlist = ranked.filter((opportunity) => opportunity.verification !== "verified");
  const settlements = rankSettlements(settlementCatalog, now);
  const weekOf = toIsoDate(startOfWeek(now));

  const report: WeeklyReport = {
    generatedAt: now.toISOString(),
    weekOf,
    zipCode: "77386",
    totalPotentialSavings: verified.reduce(
      (total, opportunity) => total + opportunity.estimatedSavings,
      0
    ),
    verifiedCount: verified.length,
    expiringCount: verified.filter((opportunity) => opportunity.expiresOn).length,
    opportunities: verified,
    watchlist
  };

  const weeklyDirectory = resolve(projectRoot, "reports", "weekly");
  const publicDirectory = resolve(projectRoot, "public", "reports");
  await Promise.all([
    mkdir(weeklyDirectory, { recursive: true }),
    mkdir(publicDirectory, { recursive: true })
  ]);

  const markdown = buildMarkdown(report, settlements);
  const datedMarkdownPath = resolve(weeklyDirectory, `${weekOf}.md`);
  const latestMarkdownPath = resolve(weeklyDirectory, "latest.md");
  const latestJsonPath = resolve(publicDirectory, "latest.json");

  await Promise.all([
    writeFile(datedMarkdownPath, markdown, "utf8"),
    writeFile(latestMarkdownPath, markdown, "utf8"),
    writeFile(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  ]);

  console.log(`Weekly report written for ${weekOf}.`);
  console.log(`Verified opportunities: ${report.verifiedCount}`);
  console.log(`Potential savings: ${formatCurrency(report.totalPotentialSavings)}`);
  console.log(`Open settlement examples: ${settlements.length}`);
  console.log(`Markdown: ${datedMarkdownPath}`);
  console.log(`Dashboard data: ${latestJsonPath}`);
}

await main();
