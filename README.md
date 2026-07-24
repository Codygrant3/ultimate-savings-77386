# 77386 Savings Desk

A local, evidence-first savings dashboard for Spring / The Woodlands, Texas. It is the first working slice of the personalized “Chief Savings Officer” described in the project brief.

## What works now

- Ranks offers by evidence, value, urgency, required spend, and effort.
- Separates verified offers from official rewards programs and unverified research leads.
- Filters and searches the opportunity list.
- Saves opportunities and tracks estimated realized savings in browser storage.
- Generates a dated Markdown briefing and dashboard-ready JSON.
- Includes a Windows Task Scheduler installer for Monday reports.
- Checks a curated set of public sources for new or improved high-value matches.
- Prioritizes grocery, coffee, fuel, convenience, auto care, movies, sports, and tax-free events.
- Tracks user-defined price targets for staples and preferred categories in local browser storage.
- Includes a transparent sale + coupon + loyalty + cashback stacking calculator.
- Stores opt-in expiration reminders locally without email, SMS, or push access.
- Compares public grocery prices for Kroger, Walmart, H-E-B, and Aldi while distinguishing store-verified prices from location-gated listings.
- Stores no email address, password, payment information, or rewards-account credentials.

## Run the dashboard

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

## Use the savings tools

Open **Savings tools** in the top navigation.

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
- `public/reports/discovery.json`

Register the daily 7:00 AM refresh:

```powershell
.\scripts\Register-DealDiscoveryTask.ps1 -WhatIf
.\scripts\Register-DealDiscoveryTask.ps1
```

The scheduled task uses no browser session or account credentials.

## Update opportunity data

Edit `src/data/opportunities.json`. Every record must include a source URL and a `checkedOn` date. Use:

- `verified` for a currently supported offer.
- `program` for an official ongoing rewards program without a guaranteed current deal.
- `needs-check` for a lead that still requires confirmation.

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

## Next build phases

1. Add merchant-specific structured parsers for the highest-value public sources.
2. Add a local merchant inventory and distance calculations.
3. Add receipt-based savings history and preference learning.
4. Add alert delivery only when an opportunity clears a user-defined value threshold.
