# 77386 Savings Desk

A local, evidence-first savings dashboard for Spring / The Woodlands, Texas. It is the first working slice of the personalized “Chief Savings Officer” described in the project brief.

## What works now

- Ranks offers by evidence, value, urgency, required spend, and effort.
- Separates verified offers from official rewards programs and unverified research leads.
- Filters and searches the opportunity list.
- Saves opportunities and tracks estimated realized savings in browser storage.
- Logs confirmed receipt results locally and uses recency-weighted category and merchant outcomes to adjust household-fit ranking.
- Generates a dated Markdown briefing and dashboard-ready JSON.
- Includes a Windows Task Scheduler installer for Monday reports.
- Checks a curated set of public sources for new or improved high-value matches.
- Prioritizes grocery, coffee, fuel, convenience, auto care, movies, sports, and tax-free events.
- Tracks user-defined price targets for staples and preferred categories in local browser storage.
- Includes a transparent sale + coupon + loyalty + cashback stacking calculator.
- Stores opt-in expiration reminders locally without email, SMS, or push access.
- Compares public grocery prices for Kroger, Walmart, H-E-B, and Aldi while distinguishing store-verified prices from location-gated listings.
- Adds a customizable staples watchlist to the Grocery tab with normalized unit prices, local target-price settings, and clear target-met alerts.
- Adds a Class Action Settlements workspace using only official court notices or verified administrator sites, with relevance ranking, local saved items, deadline reminders, and a manual claim-review checklist.
- Applies a privacy-safe adult-and-teen household profile. Baby and infant offers are excluded; teen and back-to-school matches receive an additional ranking boost.
- Stores no email address, password, payment information, or rewards-account credentials.
- Stores no receipt images, bank data, card numbers, account numbers, or itemized personal purchase records. The local history contains only date, merchant, category, amount spent, confirmed savings, and an optional dashboard-offer link.
- Never files claims or stores legal attestations, Social Security numbers, bank details, claim identifiers, VINs, or exact household data.

## Run the dashboard

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

## Use the savings tools

Open **Savings tools** in the top navigation.

- Savings history is a private, manual confirmation ledger. Enter only the
  summary facts you want this browser to remember. Positive and zero-value
  outcomes adjust future household-fit scores; official evidence and household
  exclusions still take precedence.

- Price-drop alerts store the item, target, and latest public price only in this
  browser. Update the latest price after a public-source refresh.
- The stacking calculator applies a store sale first, then fixed digital
  coupons, then loyalty rewards, and finally percentage cashback to the
  remaining eligible amount. It is planning math, not a guarantee that merchant
  terms allow every combination.
- Expiration reminders are an in-dashboard checklist. They do not send external
  notifications.
- The local grocery comparison is sourced from public retailer pages. A price is
  called a local winner only when the source is bound to a 77386 store.

Open **Grocery** to use the staples watchlist. Built-in watched items receive
their latest normalized unit price from the public comparison snapshot. You can
change targets, enter a manual latest unit price, add custom staples, or remove
items. These choices stay in this browser under
`savings-desk:grocery-watchlist`; they are not published or sent to a retailer.

## Generate the weekly report

```powershell
npm run report:weekly
```

The command writes:

- `reports/weekly/YYYY-MM-DD.md`
- `reports/weekly/latest.md`
- `public/reports/latest.json`

The date in the filename is the Monday that starts the report week.

## Register the Monday schedule

The scheduling script defaults to Mondays at 8:00 AM local time:

```powershell
.\scripts\Register-WeeklySavingsTask.ps1 -WhatIf
.\scripts\Register-WeeklySavingsTask.ps1
```

The first command previews the system change. The second registers or updates the task named `77386 Savings Weekly Report`. The task is not installed automatically by the project.

## Refresh public deal sources

The discovery workflow checks only the official public pages listed in
`src/data/discovery-sources.json`. It normalizes and deduplicates URLs, records
source freshness and failures, compares page fingerprints with the prior run,
and surfaces only new or improved high-priority matches for human review.

```powershell
npm run refresh:deals
```

Outputs:

- `reports/discovery/latest.json`
- `reports/discovery/latest.md`
- `reports/discovery/grocery-watchlist.json`
- `reports/discovery/settlements.json`
- `public/reports/discovery.json`
- `public/reports/grocery-watchlist.json`
- `public/reports/settlements.json`

The grocery-watchlist snapshot normalizes the best available official listing
for each configured comparison. It prefers a 77386-verified price when one is
available and otherwise labels the result as not locally confirmed. The public
deployment receives a new snapshot when the validated site is republished; the
local scheduled refresh does not publish by itself.

Register the daily 7:00 AM refresh:

```powershell
.\scripts\Register-DealDiscoveryTask.ps1 -WhatIf
.\scripts\Register-DealDiscoveryTask.ps1
```

The scheduled task uses no browser session or account credentials.

## Review class action settlements

Open **Settlements** in the dashboard. The feature:

- keeps only open examples backed by an official court notice or a verified
  settlement-administrator site;
- shows the source, claim deadline, possible class definition, proof signal,
  stated benefit, geography, and source-check date;
- ranks possible relevance without asserting household eligibility;
- stores only saved-item and reminder IDs in local browser storage; and
- provides a checklist that opens the administrator's official form in a new
  tab for manual review.

The dashboard does not fill, submit, or sign a form. The user must read the
official notice, confirm every fact truthfully, decide whether to release legal
rights, and manually submit. Never pay a listing service to file a settlement
claim. This feature is informational and is not legal advice.

`npm run refresh:deals` checks configured official settlement pages for content
changes and republishes a filtered `settlements.json` snapshot. A page change is
only a review signal: it does not automatically rewrite eligibility, benefits,
or deadlines in the curated catalog.

## Update opportunity data

Edit `src/data/opportunities.json`. Every record must include a source URL and a `checkedOn` date. Use:

- `verified` for a currently supported offer.
- `program` for an official ongoing rewards program without a guaranteed current deal.
- `needs-check` for a lead that still requires confirmation.

Household fit is configured in `src/data/preferences.json`. The exclusion filter
checks merchant, title, summary, tags, and imported preference signals before
ranking. High-priority teen and back-to-school keywords receive an additional
score boost. Keep baby and infant exclusions in place unless the household
profile changes. Exact household details belong only in the ignored
`src/data/household-preferences.local.json` file and are never bundled or
published.

Then run:

```powershell
npm run report:weekly
npm run check
```

## Current limitation

This is a curated public-source monitor, not a general live-search engine. It
cannot reliably read JavaScript-only, bot-protected, personalized, app-only, or
login-required offers. A new or changed page enters a review queue and does not
become a verified dashboard offer automatically. The system stores no account
credentials, cookies, email addresses, or payment information.

For settlements, the dashboard is not a complete registry of every U.S. case.
Official sites can change, claim periods can be extended, and administrator
forms may require sensitive data. Recheck the official notice immediately
before any manual submission; do not copy sensitive claim-form data into this
project.

## Next build phases

1. Add merchant-specific structured parsers for the highest-value public sources.
2. Add a local merchant inventory and distance calculations.
3. Add alert delivery only when an opportunity clears a user-defined value threshold.
