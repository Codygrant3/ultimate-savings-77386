# 77386 Savings Desk

A local, evidence-first savings dashboard for Spring / The Woodlands, Texas. It is the first working slice of the personalized “Chief Savings Officer” described in the project brief.

## What works now

- Ranks offers by evidence, value, urgency, required spend, and effort.
- Shows each offer's official savings rate and estimated dollar return per $1 of required spend when both figures are evidence-backed enough to display.
- Lets the household tune relative ranking priorities for evidence, dollar value, percentage savings, fit, proximity, timing, effort, spend efficiency, and stackability. Custom weights are normalized to the bounded 100-point model and stay in local browser storage.
- Tunes household fit with local high-priority, preferred, and exclusion keywords. Exclusions are removed before ranking; matching terms raise fit without changing official evidence or offer terms.
- Separates verified offers from official rewards programs and unverified research leads.
- Shows each offer's official-source check age in the deal feed, lets the household restrict results to checks from the last 7 or 14 days, and remembers that freshness limit locally.
- Filters and searches the opportunity list.
- Saves opportunities and tracks estimated realized savings in browser storage.
- Logs confirmed receipt results locally and uses recency-weighted category and merchant outcomes to adjust household-fit ranking.
- Uses linked local receipt outcomes to adjust weekly planning value and explain when past confirmed results differ from the listed estimate, without changing official offer evidence or promised terms.
- Separates the official estimate from household-calibrated planning value in weekly results, and uses calibrated value for net benefit after travel so confirmed local outcomes are visible in the cash decision rather than hidden in scoring alone.
- Shows evidence-discounted risk-adjusted planning value alongside official estimates, and preserves negative trip-level net benefit after travel so an overly expensive trip cannot be hidden by a zero floor.
- Delivers dashboard-only high-value alerts when an offer clears a user-defined dollar threshold, free-reward preference, and maximum redemption effort.
- Maintains a checked local merchant inventory and uses great-circle distance calculations for nearby branches. A merchant-location distance is clearly marked as approximate and never claims that a specific promotion is confirmed at that branch.
- Includes officially sourced Shell, Exxon Mobil Rewards+, and 7-Eleven locations near 77386 so fuel rewards can be compared and planned by nearby branch instead of remaining location-blind.
- Carries checked merchant-location distances into both explainable ranking and the constrained weekly planner, so nearby stores affect trip selection without implying that every promotion runs at that branch.
- Uses merchant-specific structured parsers for Wendy's, Dutch Bros, the local Take 5 and Costa Oil pages, and the local Rainbow Car Care rewards page to stage official offer candidates with amounts, minimum spend, eligibility caveats, or expiration signals. Every parsed candidate remains a human-review lead, never an automatic dashboard deal.
- Uses semantic candidate keys to collapse repeated page variants while preserving the most complete spend, expiration, or terms evidence.
- Ranks discovery candidates by captured value, spend efficiency, expiration timing, source priority, and title quality, then exposes them in a dashboard review queue. Keep/dismiss choices stay in the local browser and never convert a lead into a verified deal.
- Demotes discovery candidates with parsed expired dates below every currently valid candidate, keeping stale evidence visible for review without letting it crowd out actionable deals.
- Compares parsed candidates with tracked offers by normalized merchant and offer language, then flags differences in captured value, minimum spend, or expiration so review time focuses on evidence changes rather than duplicates.
- Shows how many configured public sources were readable on the latest discovery run and names unavailable checks, so ranked results carry an explicit coverage boundary.
- Provides a gated local path from a reviewed candidate to an actionable offer: the linked official terms must be explicitly confirmed, and value, percentage savings, minimum spend, expiration, effort, stack rule, exclusion group, confirmed local distance, and participation status are recorded on this device before the offer enters ranking and planning. Semantic matching blocks a second record for an already tracked deal, allows an explicit update of the same local record, and removing that record also removes its saved or used links.
- Classifies stack evidence as compatible, conditional, or exclusive instead of rewarding exclusionary terms as stackability, and validates locally captured offers when browser storage is read or written, filtering malformed categories, values, dates, distances, effort levels, source links, and exclusivity keys before they can affect ranking or planning.
- Builds a constrained weekly action plan from verified offers using the local spend budget, merchant-trip limit, distance limit, minimum-validity window, maximum redemption effort, official exclusion groups and exclusive stack terms, deals-per-merchant limit, and unconfirmed-location preference. By default it counts only one conditional or undocumented stack per merchant; a local override can allow conditional stacks after explicit review. Offers that share an exclusion group are never summed on the same merchant trip, and offers with exclusive stack terms are planned alone. The planner is optimization math only: it does not confirm eligibility, local participation, or guaranteed savings, and personal app offers still require in-app confirmation.
- Lets the household display the optimized trip set strongest-value first or nearest-location first, so the same evidence-based selection can support either review priority or errand routing.
- Lets the household choose the weekly optimizer's objective among balanced value, maximum measured cash, or best whole-plan blended return per dollar while retaining every evidence, freshness, effort, distance, travel-cost, stacking, and participation guard.
- Gives nearer expiration deadlines a bounded priority in cash- and efficiency-focused planning so limited-time opportunities are not silently deferred behind similar ongoing offers.
- Shows weighted deadline priority alongside planning confidence, making timing pressure visible without changing the official offer estimate.
- Applies explicit evidence-confidence discounts for older source checks and unconfirmed local participation in cash-focused planning, and shows the resulting planning confidence without changing official offer estimates.
- Separately decays nearby-location evidence in cash-focused planning so a recently checked official offer cannot borrow confidence from an older store check.
- Keeps store-distance evidence separate from promotion-participation evidence in weekly trips, adding an explicit confirmation warning when a checked nearby branch does not prove that a specific offer runs there.
- Offers an opt-in weekly-plan gate that admits only locally captured offers with user-confirmed distances and participation.
- Provides an opt-in high-priority planning gate so coupon-driven spend can be restricted to offers matching the household's configured high-priority keywords.
- Adds an opt-in measured-cash-value gate that excludes unpriced free rewards from the weekly optimizer when the household wants planning based only on captured dollar estimates.
- Enforces a user-defined minimum return per $1 of required spend in weekly planning, with a clear exclusion reason and an exemption for genuine zero-spend rewards.
- Lets the household enter its own cost per mile so weekly planning can compare estimated savings against explicit round-trip travel cost and show net benefit after travel; the figure remains a local planning assumption.
- Shows the weekly plan's blended dollar return per $1 of planned spend and its estimated net cash requirement, while keeping those figures separate from guaranteed eligibility or local price evidence.
- Tests bounded budget, trip, distance, and deals-per-merchant relaxations and reports only changes that add official estimated value without lowering risk-adjusted or travel-adjusted household results; linked local outcomes can reduce the reported gain, and every evidence and stacking guard remains active.
- Aligns constraint checks with the selected planning objective: Best-per-dollar recommendations use the optimizer's whole-plan efficiency metric—including travel cost and bounded deadline priority—and explicitly flag any reduction in official estimated savings.
- Exposes the Best-per-dollar optimizer's whole-plan efficiency metric, so households can see the same evidence-, deadline-, outcome-, and travel-adjusted rate used to select trips rather than only the gross offer-value ratio.
- Enforces a user-defined maximum source-check age in the weekly action plan, with a 14-day default, so stale evidence cannot silently become an action recommendation.
- Applies that same freshness gate to checked nearby-location evidence as well as official offer sources, so old store checks cannot masquerade as current proximity.
- Shows the age and source of checked proximity evidence, and decays merchant-location ranking value when a nearby-store check becomes stale.
- Explains stacking-related omissions separately from ordinary lower-priority results, including exclusion-group limits, exclusive-offer conflicts, and the conservative conditional-stacking guard.
- Connects the weekly action plan to local execution tracking: save planned offers for later or mark them used. Marking an offer used removes it from the next optimized plan and feeds the existing recency-weighted preference history.
- Exports the selected weekly trips as a Markdown shopping checklist with deadlines, official links, local caveats, and confirmation warnings—without exporting household data.
- Keeps redemption effort and official-source check dates visible on planned deals and their exported checklist, so freshness and effort remain decision inputs at the store rather than hidden filter settings.
- Shows household-fit matches in planned deals while keeping those local profile details out of exported checklists; classified stack terms remain visible both on screen and in exports so official redemption limits travel with the plan.
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

- High-value alerts appear only inside this dashboard. There is no email, SMS,
  or push delivery. Dismissal is local, so each browser controls its own alert
  queue.
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

Open **Action plan** to turn verified offers into a bounded weekly trip plan.
Planning limits are stored only in this browser under
`savings-desk:weekly-plan-settings`. A selected offer still requires review of
its official terms and confirmation at the merchant before purchase.

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
deployment receives a new snapshot only after the refreshed public report is
committed and the site is rebuilt before packaging; the local scheduled refresh
does not publish by itself.

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

1. Expand merchant-specific structured parsers beyond Costa Oil, Dutch Bros, Rainbow Car Care, Take 5, and Wendy's to more accessible high-value sources.
2. Expand the local merchant inventory with more official store-location sources and coordinates.
3. Add alert delivery only when an opportunity clears a user-defined value threshold. (Complete as a dashboard-local alert queue; external delivery remains intentionally unavailable.)
