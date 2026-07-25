import {
  AlertTriangle,
  BellRing,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  LockKeyhole,
  Scale,
  Search,
  ShieldCheck
} from "lucide-react";
import { useMemo, useState } from "react";
import settlementsData from "../data/settlements.json";
import { daysUntilDeadline, rankSettlements } from "../lib/settlements";
import {
  readSettlementReminderIds,
  readSettlementSavedIds,
  toggleStoredId
} from "../lib/storage";
import type {
  ClassActionSettlement,
  SettlementProofRequirement
} from "../types";

const settlements = rankSettlements(
  settlementsData as ClassActionSettlement[]
);

const proofLabels: Record<SettlementProofRequirement, string> = {
  "none-stated": "No proof stated for selected benefit",
  "notice-or-records": "Notice or administrator records",
  "purchase-or-subscription-records": "Subscription or purchase records",
  "expense-documentation": "Expense documentation",
  "vehicle-records": "Vehicle records / VIN lookup"
};

function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function SettlementCard({
  settlement,
  saved,
  reminder,
  onSave,
  onReminder
}: {
  settlement: ClassActionSettlement;
  saved: boolean;
  reminder: boolean;
  onSave: () => void;
  onReminder: () => void;
}) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const remainingDays = daysUntilDeadline(
    settlement.claimDeadline
  );
  const checklist = [
    "Read the official notice and exact class definition.",
    "Confirm the product, service, dates, and geography truthfully.",
    "Gather only the proof the official administrator requests.",
    "Review privacy, release, payment, and attestation terms yourself.",
    "Open the official form and submit it manually only if eligible."
  ];

  function toggleStep(index: number) {
    setCompletedSteps((current) =>
      current.includes(index)
        ? current.filter((step) => step !== index)
        : [...current, index]
    );
  }

  return (
    <article className="settlement-card">
      <div className="settlement-card__header">
        <div className="settlement-card__mark">
          <Scale size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="settlement-card__case">{settlement.caseName}</span>
          <h3>{settlement.shortTitle}</h3>
        </div>
        <div className="settlement-score" aria-label={`${settlement.relevanceScore} relevance score`}>
          <strong>{settlement.relevanceScore}</strong>
          <span>possible fit</span>
        </div>
      </div>

      <div className="settlement-badges">
        <span className="evidence-badge evidence-badge--verified">
          <ShieldCheck size={13} aria-hidden="true" />
          Official source checked
        </span>
        <span className="settlement-unknown">
          <AlertTriangle size={13} aria-hidden="true" />
          Eligibility not confirmed
        </span>
        <span className={remainingDays <= 60 ? "deadline-badge deadline-badge--soon" : "deadline-badge"}>
          <CalendarClock size={13} aria-hidden="true" />
          {formatDeadline(settlement.claimDeadline)}
        </span>
      </div>

      <p className="settlement-summary">{settlement.summary}</p>
      <p className="settlement-fit"><strong>Why it ranked here:</strong> {settlement.relevanceReason}</p>

      <dl className="settlement-facts">
        <div>
          <dt>Potential benefit</dt>
          <dd>{settlement.estimatedBenefit}</dd>
        </div>
        <div>
          <dt>Geography</dt>
          <dd>{settlement.geography}</dd>
        </div>
        <div>
          <dt>Proof signal</dt>
          <dd>{proofLabels[settlement.proofRequirement]}</dd>
        </div>
        <div>
          <dt>Freshness</dt>
          <dd>Checked {settlement.checkedOn} · {settlement.freshness}</dd>
        </div>
      </dl>

      <details className="settlement-details">
        <summary>
          Eligibility and proof details
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div>
          <p><strong>Potential class definition:</strong> {settlement.eligibilitySummary}</p>
          <p><strong>Proof:</strong> {settlement.proofSummary}</p>
          <p><strong>Court:</strong> {settlement.court}</p>
          <p><strong>Administrator:</strong> {settlement.administrator}</p>
        </div>
      </details>

      <details className="settlement-checklist">
        <summary>
          <FileCheck2 size={16} aria-hidden="true" />
          Manual claim checklist
          <span>{completedSteps.length}/5</span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className="settlement-checklist__body">
          <p>This checklist stays in this browser session. It does not prove eligibility.</p>
          {checklist.map((step, index) => (
            <label key={step}>
              <input
                type="checkbox"
                checked={completedSteps.includes(index)}
                onChange={() => toggleStep(index)}
              />
              <span className="check-box"><Check size={13} aria-hidden="true" /></span>
              <span>{step}</span>
            </label>
          ))}
        </div>
      </details>

      <div className="settlement-card__actions">
        <a href={settlement.sourceUrl} target="_blank" rel="noreferrer" className="text-link">
          Read official notice
          <ExternalLink size={14} aria-hidden="true" />
        </a>
        <button
          type="button"
          className={`settlement-action ${saved ? "settlement-action--active" : ""}`}
          onClick={onSave}
          aria-label={saved ? `Remove ${settlement.shortTitle} from saved` : `Save ${settlement.shortTitle}`}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          className={`settlement-action ${reminder ? "settlement-action--active" : ""}`}
          onClick={onReminder}
          aria-label={reminder ? `Disable reminder for ${settlement.shortTitle}` : `Enable reminder for ${settlement.shortTitle}`}
        >
          <BellRing size={16} aria-hidden="true" />
          {reminder ? "Reminder on" : "Remind me"}
        </button>
        <a
          href={settlement.claimFormUrl}
          target="_blank"
          rel="noreferrer"
          className="official-form-link"
        >
          Open official claim form
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export function SettlementsDashboard() {
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(readSettlementSavedIds);
  const [reminderIds, setReminderIds] = useState<string[]>(
    readSettlementReminderIds
  );

  const visibleSettlements = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return settlements.filter((settlement) => {
      const matchesSaved = !savedOnly || savedIds.includes(settlement.id);
      const matchesQuery =
        normalized.length === 0 ||
        `${settlement.shortTitle} ${settlement.caseName} ${settlement.summary} ${settlement.geography}`
          .toLowerCase()
          .includes(normalized);
      return matchesSaved && matchesQuery;
    });
  }, [query, savedIds, savedOnly]);

  return (
    <>
      <section className="page-heading settlements-heading">
        <span className="eyebrow">Official notices, manual decisions</span>
        <h1>Class action settlements</h1>
        <p>
          Current U.S. opportunities ranked for review—not a claim of household
          eligibility. Every claim remains a manual, truthful, user-reviewed action.
        </p>
      </section>

      <section className="legal-boundary" aria-label="Class action safety boundaries">
        <LockKeyhole size={22} aria-hidden="true" />
        <div>
          <strong>Informational only — not legal advice</strong>
          <p>
            This dashboard never files claims, signs attestations, invents purchases, or
            stores Social Security numbers, bank details, credentials, claim IDs, VINs,
            or exact household data. Never pay to file a settlement claim.
          </p>
        </div>
      </section>

      <section className="settlement-controls" aria-label="Settlement filters">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search settlements</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search case, product, or geography"
          />
        </label>
        <button
          type="button"
          className={savedOnly ? "filter-chip filter-chip--active" : "filter-chip"}
          onClick={() => setSavedOnly((current) => !current)}
        >
          <Bookmark size={14} aria-hidden="true" />
          Saved only
        </button>
        <div className="settlement-controls__stats">
          <strong>{settlements.length}</strong>
          <span>verified open examples</span>
        </div>
      </section>

      <div className="settlement-results">
        <span>{visibleSettlements.length} opportunities</span>
        <span>Possible relevance first · eligibility always unconfirmed</span>
      </div>

      <section className="settlement-grid">
        {visibleSettlements.map((settlement) => (
          <SettlementCard
            key={settlement.id}
            settlement={settlement}
            saved={savedIds.includes(settlement.id)}
            reminder={reminderIds.includes(settlement.id)}
            onSave={() =>
              setSavedIds(toggleStoredId("settlement-saved", settlement.id))
            }
            onReminder={() =>
              setReminderIds(
                toggleStoredId("settlement-reminder", settlement.id)
              )
            }
          />
        ))}
      </section>

      {visibleSettlements.length === 0 && (
        <div className="empty-state">
          <Search size={28} aria-hidden="true" />
          <h3>No matching settlements</h3>
          <p>Clear the search or turn off “Saved only.”</p>
        </div>
      )}

      <section className="settlement-source-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Strict source filter</strong>
          <p>
            Expired, unverifiable, pay-to-file, lead-generation, and scam-like listings
            are excluded. Official sites can still change deadlines or benefits, so
            recheck the source before acting.
          </p>
        </div>
      </section>
    </>
  );
}
