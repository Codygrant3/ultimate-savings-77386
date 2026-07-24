import {
  AlertTriangle,
  BellRing,
  Bookmark,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clapperboard,
  Coffee,
  ExternalLink,
  Fuel,
  House,
  Landmark,
  LayoutDashboard,
  MapPin,
  Menu,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Store,
  Ticket,
  Utensils,
  X,
  type LucideIcon
} from "lucide-react";
import { useMemo, useState } from "react";
import opportunitiesData from "./data/opportunities.json";
import { GroceryDashboard, SavingsTools } from "./components/SavingsTools";
import { formatCurrency, rankOpportunities } from "./lib/scoring";
import { readRedeemedIds, readSavedIds, toggleStoredId } from "./lib/storage";
import type {
  Category,
  Opportunity,
  ScoredOpportunity,
  VerificationStatus
} from "./types";

type View = "overview" | "deals" | "grocery" | "programs" | "weekly" | "tools";
type CategoryFilter = "all" | Category;

const opportunities = opportunitiesData as Opportunity[];
const currentOpportunities = rankOpportunities(opportunities);
const activeCategories = Array.from(
  new Set(currentOpportunities.map((opportunity) => opportunity.category))
);

const CATEGORY_META: Record<
  Category,
  { label: string; icon: LucideIcon; color: string }
> = {
  restaurants: { label: "Food", icon: Utensils, color: "#d85f35" },
  grocery: { label: "Grocery", icon: ShoppingBasket, color: "#24856b" },
  fuel: { label: "Fuel", icon: Fuel, color: "#2a6f97" },
  coffee: { label: "Coffee", icon: Coffee, color: "#8a5a44" },
  convenience: { label: "Convenience", icon: Store, color: "#5e6d76" },
  local: { label: "Local", icon: MapPin, color: "#8c6b2f" },
  auto: { label: "Auto care", icon: Car, color: "#356c7d" },
  movies: { label: "Movies", icon: Clapperboard, color: "#8c4f7d" },
  sports: { label: "Sports", icon: Ticket, color: "#b65f34" },
  "tax-free": { label: "Tax-free", icon: ShoppingBag, color: "#3d7c50" },
  shopping: { label: "Shopping", icon: ShoppingBag, color: "#7557a8" },
  financial: { label: "Financial", icon: Landmark, color: "#23758c" },
  entertainment: { label: "Fun", icon: Clapperboard, color: "#b66588" },
  home: { label: "Home", icon: House, color: "#a56b24" }
};

const NAV_ITEMS: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "deals", label: "Deal feed", icon: Sparkles },
  { id: "grocery", label: "Grocery", icon: ShoppingBasket },
  { id: "tools", label: "Savings tools", icon: BellRing },
  { id: "weekly", label: "Monday report", icon: CalendarDays },
  { id: "programs", label: "Rewards", icon: ShieldCheck }
];

function formatDate(date?: string): string {
  if (!date) return "Ongoing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function verificationLabel(status: VerificationStatus): string {
  if (status === "verified") return "Source checked";
  if (status === "program") return "Official program";
  return "Needs verification";
}

function dealTypeLabel(dealType: Opportunity["dealType"]): string | null {
  if (!dealType) return null;
  return {
    "digital-coupon": "Digital coupon",
    "loyalty-reward": "Loyalty reward",
    "free-food": "Food or drink reward",
    "fuel-reward": "Fuel reward",
    "convenience-reward": "Convenience reward",
    "stacking-strategy": "Stacking play",
    "grand-opening": "Grand opening",
    "promotion-event": "Promo event",
    "vehicle-maintenance": "Vehicle care",
    "movie-discount": "Movie deal",
    "sports-ticket": "Sports offer",
    "tax-holiday": "Tax holiday"
  }[dealType];
}

function OpportunityCard({
  opportunity,
  saved,
  redeemed,
  onSave,
  onRedeem
}: {
  opportunity: ScoredOpportunity;
  saved: boolean;
  redeemed: boolean;
  onSave: () => void;
  onRedeem: () => void;
}) {
  const meta = CATEGORY_META[opportunity.category];
  const CategoryIcon = meta.icon;

  return (
    <article className={`deal-card ${redeemed ? "deal-card--redeemed" : ""}`}>
      <div className="deal-card__topline">
        <div className="merchant-mark" style={{ "--mark-color": meta.color } as React.CSSProperties}>
          <CategoryIcon size={18} aria-hidden="true" />
        </div>
        <div className="deal-card__merchant">
          <strong>{opportunity.merchant}</strong>
          <span>{meta.label}</span>
        </div>
        <div className={`score score--${opportunity.scoreLabel.toLowerCase().replaceAll(" ", "-")}`}>
          <strong>{opportunity.score}</strong>
          <span>{opportunity.scoreLabel}</span>
        </div>
      </div>

      <div className="deal-card__body">
        <div className="deal-card__badges">
          {opportunity.freshness && opportunity.freshness !== "current" && (
            <span className={`freshness-badge freshness-badge--${opportunity.freshness}`}>
              {opportunity.freshness === "new"
                ? "New"
                : opportunity.freshness === "improved"
                  ? "Improved"
                  : "Monitoring"}
            </span>
          )}
          {opportunity.tier && (
            <span className={`tier-badge tier-badge--${opportunity.tier.toLowerCase()}`}>
              Tier {opportunity.tier}
            </span>
          )}
          <span className={`evidence-badge evidence-badge--${opportunity.verification}`}>
            {opportunity.verification === "needs-check" ? (
              <AlertTriangle size={13} aria-hidden="true" />
            ) : (
              <ShieldCheck size={13} aria-hidden="true" />
            )}
            {verificationLabel(opportunity.verification)}
          </span>
          {dealTypeLabel(opportunity.dealType) && (
            <span className="deal-type-badge">{dealTypeLabel(opportunity.dealType)}</span>
          )}
          {(opportunity.expiresOn || opportunity.expirationLabel) && (
            <span className="quiet-badge">
              <CalendarDays size={13} aria-hidden="true" />
              {opportunity.expirationLabel ?? `Ends ${formatDate(opportunity.expiresOn)}`}
            </span>
          )}
          {opportunity.availability === "waitlist" && (
            <span className="waitlist-badge">
              <AlertTriangle size={13} aria-hidden="true" />
              Waitlist
            </span>
          )}
        </div>
        <h3>{opportunity.title}</h3>
        <p>{opportunity.summary}</p>

        {opportunity.estimatedSavings > 0 && (
          <div className="deal-math">
            <div>
              <span>Estimated value</span>
              <strong>{formatCurrency(opportunity.estimatedSavings)}</strong>
            </div>
            <div>
              <span>Minimum spend</span>
              <strong>
                {opportunity.minimumSpend > 0
                  ? formatCurrency(opportunity.minimumSpend)
                  : "None"}
              </strong>
            </div>
          </div>
        )}

        <div className="location-note">
          <MapPin size={15} aria-hidden="true" />
          <span>
            {opportunity.distanceMiles ? `${opportunity.distanceMiles} mi · ` : ""}
            {opportunity.locationNote}
          </span>
        </div>
        {opportunity.stackNote && (
          <div className="stack-note">
            <Sparkles size={14} aria-hidden="true" />
            <span><strong>Stack:</strong> {opportunity.stackNote}</span>
          </div>
        )}
        {opportunity.finePrint && (
          <details className="fine-print">
            <summary>Eligibility and fine print</summary>
            <p>{opportunity.finePrint}</p>
          </details>
        )}
      </div>

      <div className="deal-card__actions">
        <a
          className="text-link"
          href={opportunity.source.url}
          target="_blank"
          rel="noreferrer"
        >
          {opportunity.actionLabel}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
        <div className="icon-actions">
          <button
            type="button"
            className={`icon-button ${saved ? "icon-button--active" : ""}`}
            onClick={onSave}
            aria-label={saved ? `Remove ${opportunity.title} from saved` : `Save ${opportunity.title}`}
            title={saved ? "Remove from saved" : "Save for later"}
          >
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`icon-button ${redeemed ? "icon-button--success" : ""}`}
            onClick={onRedeem}
            aria-label={
              redeemed
                ? `Mark ${opportunity.title} as not used`
                : `Mark ${opportunity.title} as used`
            }
            title={redeemed ? "Mark as not used" : "Mark as used"}
          >
            {redeemed ? <RotateCcw size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Search size={28} aria-hidden="true" />
      <h3>No matching opportunities</h3>
      <p>Clear a filter or try a broader search.</p>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>(readSavedIds);
  const [redeemedIds, setRedeemedIds] = useState<string[]>(readRedeemedIds);

  const verifiedDeals = currentOpportunities.filter(
    (opportunity) => opportunity.verification === "verified"
  );
  const programs = currentOpportunities.filter(
    (opportunity) => opportunity.verification !== "verified"
  );
  const expiringDeals = verifiedDeals.filter((opportunity) => opportunity.expiresOn);
  const freeFoodOffers = verifiedDeals.filter(
    (opportunity) =>
      opportunity.isFree &&
      ["restaurants", "coffee", "convenience"].includes(opportunity.category)
  );
  const tierAOffers = verifiedDeals.filter((opportunity) => opportunity.tier === "A");
  const potentialSavings = verifiedDeals.reduce(
    (total, opportunity) => total + opportunity.estimatedSavings,
    0
  );
  const realizedSavings = currentOpportunities
    .filter((opportunity) => redeemedIds.includes(opportunity.id))
    .reduce((total, opportunity) => total + opportunity.estimatedSavings, 0);

  const filteredDeals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return currentOpportunities.filter((opportunity) => {
      const categoryMatches = category === "all" || opportunity.category === category;
      const queryMatches =
        normalizedQuery.length === 0 ||
        `${opportunity.merchant} ${opportunity.title} ${opportunity.summary} ${opportunity.tags.join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery);
      return categoryMatches && queryMatches;
    });
  }, [category, query]);

  const displayedDeals =
    view === "programs"
      ? filteredDeals.filter((opportunity) => opportunity.verification !== "verified")
      : filteredDeals;

  function changeView(nextView: View) {
    setView(nextView);
    setMobileNavOpen(false);
    if (nextView !== "deals" && nextView !== "programs") {
      setCategory("all");
      setQuery("");
    }
  }

  function toggleSaved(id: string) {
    setSavedIds(toggleStoredId("saved", id));
  }

  function toggleRedeemed(id: string) {
    setRedeemedIds(toggleStoredId("redeemed", id));
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar--open" : ""}`}>
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            <CircleDollarSign size={25} />
          </div>
          <div>
            <strong>Ultimate Savings</strong>
            <span>Spring · The Woodlands</span>
          </div>
          <button
            type="button"
            className="mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={view === item.id ? "nav-item nav-item--active" : "nav-item"}
                onClick={() => changeView(item.id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span className="status-dot" />
          <div>
            <strong>Tracking area</strong>
            <span>77386 · 10 mi</span>
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} aria-hidden="true" />
          </button>
          <div className="location-pill">
            <MapPin size={15} aria-hidden="true" />
            Spring / The Woodlands
          </div>
          <div className="topbar__meta">
            <span>Thursday, July 23</span>
            <div className="avatar" aria-label="Personal workspace">
              CS
            </div>
          </div>
        </header>

        <div className="content-wrap">
          {view === "overview" && (
            <>
              <section className="hero">
                <div className="hero__copy">
                  <span className="eyebrow">Monday deal intelligence</span>
                  <h1>
                    Spend less.
                    <em>Keep the good stuff.</em>
                  </h1>
                  <p>
                    A personalized look at food, coffee, fuel, auto care,
                    entertainment, sports, and timely household savings—ranked
                    by value, evidence, and effort.
                  </p>
                  <div className="hero__actions">
                    <button type="button" className="hero-action" onClick={() => changeView("deals")}>
                      Browse this week
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="hero-action hero-action--secondary"
                      onClick={() => changeView("weekly")}
                    >
                      View Monday report
                    </button>
                  </div>
                </div>
                <div className="opportunity-stack" aria-label="This week's savings opportunity">
                  <div className="opportunity-card">
                    <div className="opportunity-card__status">
                      <span>This week’s opportunity</span>
                      <strong><i /> Live</strong>
                    </div>
                    <strong className="opportunity-card__value">
                      {formatCurrency(potentialSavings)}
                    </strong>
                    <p>estimated value across {verifiedDeals.length} vetted offers</p>
                    <div className="opportunity-card__stats">
                      <div>
                        <strong>{freeFoodOffers.length}</strong>
                        <span>Free food reward</span>
                      </div>
                      <div>
                        <strong>{tierAOffers.length}</strong>
                        <span>Tier A deals</span>
                      </div>
                      <div>
                        <strong>10 mi</strong>
                        <span>Search radius</span>
                      </div>
                    </div>
                    <small>Last source review · Jul 23, 2026</small>
                  </div>
                </div>
              </section>

              <section className="trust-strip" aria-label="Savings standards">
                <div>
                  <span>01</span>
                  <p><strong>No junk promos</strong>Low-value noise is demoted</p>
                </div>
                <div>
                  <span>02</span>
                  <p><strong>Official sources first</strong>Terms linked on every deal</p>
                </div>
                <div>
                  <span>03</span>
                  <p><strong>Stack-aware</strong>Extra savings called out</p>
                </div>
              </section>

              <section className="notice" aria-label="Data status">
                <ShieldCheck size={19} aria-hidden="true" />
                <div>
                  <strong>Priority mode: household-fit, high-value savings</strong>
                  <span>
                    Built for an adult-and-teen household: groceries, teen
                    back-to-school needs, coffee, fuel, auto care, movies,
                    sports, and verified stacks lead. Baby, infant, and unrelated
                    local-activity offers are excluded.
                  </span>
                </div>
              </section>

              <section className="metrics-grid" aria-label="Savings summary">
                <article className="metric-card">
                  <div className="metric-card__icon metric-card__icon--green">
                    <CircleDollarSign size={20} aria-hidden="true" />
                  </div>
                  <span>Vetted potential</span>
                  <strong>{formatCurrency(potentialSavings)}</strong>
                  <small>
                    Across {verifiedDeals.length} checked offers · {freeFoodOffers.length} free food reward
                  </small>
                </article>
                <article className="metric-card">
                  <div className="metric-card__icon metric-card__icon--orange">
                    <CalendarDays size={20} aria-hidden="true" />
                  </div>
                  <span>Ending soon</span>
                  <strong>{expiringDeals.length}</strong>
                  <small>Review before making a trip</small>
                </article>
                <article className="metric-card">
                  <div className="metric-card__icon metric-card__icon--purple">
                    <Bookmark size={20} aria-hidden="true" />
                  </div>
                  <span>Saved for later</span>
                  <strong>{savedIds.length}</strong>
                  <small>Stored on this device</small>
                </article>
                <article className="metric-card">
                  <div className="metric-card__icon metric-card__icon--blue">
                    <Check size={20} aria-hidden="true" />
                  </div>
                  <span>Realized savings</span>
                  <strong>{formatCurrency(realizedSavings)}</strong>
                  <small>Based on offers marked used</small>
                </article>
              </section>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Highest-value first</span>
                    <h2>This week’s short list</h2>
                  </div>
                  <button type="button" className="view-all" onClick={() => changeView("deals")}>
                    View all <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="deal-grid">
                  {verifiedDeals.slice(0, 3).map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      saved={savedIds.includes(opportunity.id)}
                      redeemed={redeemedIds.includes(opportunity.id)}
                      onSave={() => toggleSaved(opportunity.id)}
                      onRedeem={() => toggleRedeemed(opportunity.id)}
                    />
                  ))}
                </div>
              </section>

              <section className="briefing-preview">
                <div className="briefing-preview__copy">
                  <span className="eyebrow eyebrow--light">Monday briefing</span>
                  <h2>Seven minutes. The week’s best moves.</h2>
                  <p>
                    The report separates checked offers, official programs, and unverified
                    leads so you always know what is worth acting on.
                  </p>
                  <button type="button" className="button-light" onClick={() => changeView("weekly")}>
                    Preview the briefing
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
                <div className="briefing-preview__list">
                  <div>
                    <span>01</span>
                    <p><strong>Act now</strong> Expiring, high-value offers</p>
                  </div>
                  <div>
                    <span>02</span>
                    <p><strong>Stack it</strong> Compatible savings layers</p>
                  </div>
                  <div>
                    <span>03</span>
                    <p><strong>Ignore it</strong> Low-value or unverified noise</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {(view === "deals" || view === "programs") && (
            <>
              <section className="page-heading">
                <span className="eyebrow">
                  {view === "deals" ? "Savings intelligence" : "Account watchlist"}
                </span>
                <h1>{view === "deals" ? "All opportunities" : "Rewards programs"}</h1>
                <p>
                  {view === "deals"
                    ? "Ranked by value, evidence quality, urgency, and effort."
                    : "Official programs and research leads. No passwords or account credentials are stored here."}
                </p>
              </section>

              <section className="filter-bar" aria-label="Deal filters">
                <label className="search-field">
                  <Search size={17} aria-hidden="true" />
                  <span className="sr-only">Search opportunities</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search merchant or offer"
                  />
                </label>
                <div className="category-filters">
                  <button
                    type="button"
                    className={category === "all" ? "filter-chip filter-chip--active" : "filter-chip"}
                    onClick={() => setCategory("all")}
                  >
                    All
                  </button>
                  {activeCategories.map((key) => {
                    const meta = CATEGORY_META[key];
                    return (
                    <button
                      type="button"
                      key={key}
                      className={category === key ? "filter-chip filter-chip--active" : "filter-chip"}
                      onClick={() => setCategory(key)}
                    >
                      {meta.label}
                    </button>
                    );
                  })}
                </div>
              </section>

              <div className="results-line">
                <span>
                  {displayedDeals.length} {displayedDeals.length === 1 ? "result" : "results"}
                </span>
                <span>Highest score first</span>
              </div>

              {displayedDeals.length > 0 ? (
                <section className="deal-grid deal-grid--full">
                  {displayedDeals.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      saved={savedIds.includes(opportunity.id)}
                      redeemed={redeemedIds.includes(opportunity.id)}
                      onSave={() => toggleSaved(opportunity.id)}
                      onRedeem={() => toggleRedeemed(opportunity.id)}
                    />
                  ))}
                </section>
              ) : (
                <EmptyState />
              )}
            </>
          )}

          {view === "weekly" && (
            <>
              <section className="page-heading">
                <span className="eyebrow">Week of July 20</span>
                <h1>Your Monday briefing</h1>
                <p>A calm, prioritized plan for the week ahead.</p>
              </section>

              <section className="weekly-layout">
                <article className="weekly-main">
                  <div className="weekly-main__header">
                    <div>
                      <span>77386 savings brief</span>
                      <strong>{formatCurrency(potentialSavings)} identified</strong>
                    </div>
                    <span className="report-status">
                      <ShieldCheck size={14} aria-hidden="true" />
                      Sources checked
                    </span>
                  </div>

                  <div className="weekly-section">
                    <div className="weekly-section__number">01</div>
                    <div>
                      <span className="eyebrow">Act this week</span>
                      <h2>Use only if it fits the shopping list</h2>
                      {verifiedDeals.map((opportunity) => (
                        <div className="brief-row" key={opportunity.id}>
                          <div className="brief-row__rank">{opportunity.score}</div>
                          <div>
                            <strong>{opportunity.merchant}: {opportunity.title}</strong>
                            <span>
                              {opportunity.estimatedSavings > 0
                                ? `${formatCurrency(opportunity.estimatedSavings)} estimated value`
                                : "Program benefit"}
                              {opportunity.expiresOn
                                ? ` · ends ${formatDate(opportunity.expiresOn)}`
                                : ""}
                            </span>
                          </div>
                          <a href={opportunity.source.url} target="_blank" rel="noreferrer">
                            <ExternalLink size={16} aria-label="Open source" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="weekly-section">
                    <div className="weekly-section__number">02</div>
                    <div>
                      <span className="eyebrow">Watchlist</span>
                      <h2>Programs worth checking, without assumed freebies</h2>
                      <div className="program-pills">
                        {programs.map((program) => (
                          <span key={program.id}>{program.merchant}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="weekly-section">
                    <div className="weekly-section__number">03</div>
                    <div>
                      <span className="eyebrow">The filter</span>
                      <h2>What this report intentionally excluded</h2>
                      <p className="weekly-copy">
                        Expired offers, unsourced social posts, generic “up to” claims, and any
                        deal that requires buying something you did not already need.
                      </p>
                    </div>
                  </div>
                </article>

                <aside className="weekly-aside">
                  <div className="weekly-aside__card">
                    <span className="eyebrow">Report cadence</span>
                    <h3>Every Monday at 8:00 AM</h3>
                    <p>
                    The local scheduled task is installed and set to refresh the report every
                    Monday morning.
                    </p>
                  </div>
                  <div className="weekly-aside__card">
                    <span className="eyebrow">Scoring contract</span>
                    <ul>
                      <li><ShieldCheck size={15} /> Official evidence</li>
                      <li><CircleDollarSign size={15} /> Real dollar value</li>
                      <li><CalendarDays size={15} /> Time sensitivity</li>
                      <li><Sparkles size={15} /> Low effort to redeem</li>
                    </ul>
                  </div>
                  <div className="weekly-aside__card weekly-aside__card--warning">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <div>
                      <strong>Personal offers vary</strong>
                      <p>Always confirm an app offer before making a special trip.</p>
                    </div>
                  </div>
                </aside>
              </section>
            </>
          )}

          {view === "tools" && (
            <SavingsTools opportunities={verifiedDeals} />
          )}

          {view === "grocery" && (
            <GroceryDashboard />
          )}
        </div>
      </main>
    </div>
  );
}
