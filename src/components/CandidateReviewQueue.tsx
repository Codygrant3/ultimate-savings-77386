import {
  BadgeCheck,
  ExternalLink,
  FlaskConical,
  ThumbsDown,
  Trash2,
  ThumbsUp,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { daysUntilExpiration } from "../lib/plan";
import {
  readCandidateReviews,
  writeCandidateReviews
} from "../lib/storage";
import {
  buildCandidateReviewContext,
  createLocallyVerifiedOffer,
  findLocalOfferConflict,
  LOCAL_OFFER_CATEGORIES,
  type LocalVerifiedOfferDraft
} from "../lib/candidate-review";
import {
  formatCurrency,
  formatDate
} from "../lib/scoring";
import type {
  CandidateReviewStatus,
  CandidateReviews,
  Category,
  Friction,
  OfferCandidate,
  Opportunity
} from "../types";

interface DiscoverySnapshot {
  generatedAt: string;
  sourceCount?: number;
  successfulCount?: number;
  failedCount?: number;
  results?: Array<{
    id?: string;
    name?: string;
    status?: string;
    error?: string;
  }>;
  parsedOfferCandidates: OfferCandidate[];
}

interface SourceHealth {
  total: number;
  successful: number;
  blocked: number;
  blockedNames: string[];
}

export function CandidateReviewQueue({
  opportunities,
  onAddVerifiedOffer,
  onDeleteVerifiedOffer
}: {
  opportunities: Opportunity[];
  onAddVerifiedOffer: (offer: Opportunity) => void;
  onDeleteVerifiedOffer: (id: string) => void;
}) {
  const [candidates, setCandidates] = useState<OfferCandidate[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [sourceHealth, setSourceHealth] = useState<SourceHealth>();
  const [loadError, setLoadError] = useState(false);
  const [reviews, setReviews] = useState<CandidateReviews>(readCandidateReviews);
  const [filter, setFilter] = useState<CandidateReviewStatus | "pending">("pending");
  const [draftCandidateId, setDraftCandidateId] = useState<string | null>(null);
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [draft, setDraft] = useState<LocalVerifiedOfferDraft>({
    category: "restaurants",
    estimatedSavings: 0,
    minimumSpend: 0,
    isFree: false,
    expiresOn: undefined,
    friction: "low",
    stackNote: "",
    stackGroup: "",
    savingsRate: undefined,
    distanceMiles: undefined,
    stackStatus: "conditional",
    localParticipationConfirmed: false,
    officialTermsConfirmed: false
  });

  useEffect(() => {
    let active = true;
    async function loadCandidates() {
      try {
        const response = await fetch("/reports/discovery.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const snapshot = (await response.json()) as DiscoverySnapshot;
        if (!active) return;
        setCandidates(snapshot.parsedOfferCandidates ?? []);
        setGeneratedAt(snapshot.generatedAt);
        if (
          typeof snapshot.sourceCount === "number" &&
          typeof snapshot.successfulCount === "number" &&
          typeof snapshot.failedCount === "number"
        ) {
          setSourceHealth({
            total: snapshot.sourceCount,
            successful: snapshot.successfulCount,
            blocked: snapshot.failedCount,
            blockedNames: (snapshot.results ?? [])
              .filter((result) => result.status === "failed")
              .map((result) => result.name ?? result.id ?? "Unnamed source")
          });
        }
      } catch {
        if (active) setLoadError(true);
      }
    }

    void loadCandidates();
    return () => {
      active = false;
    };
  }, []);

  const visibleCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const status = reviews[candidate.id];
      if (filter === "pending") {
        const localId = `local-${candidate.id}`;
        return (
          !status ||
          opportunities.some(
            (opportunity) =>
              opportunity.id === localId && opportunity.localRecord === true
          )
        );
      }
      return status === filter;
    });
  }, [candidates, filter, opportunities, reviews]);

  const reviewContexts = useMemo(() => {
    return new Map(
      candidates.map((candidate) => [
        candidate.id,
        buildCandidateReviewContext(candidate, opportunities)
      ])
    );
  }, [candidates, opportunities]);

  const trackedCount = Array.from(reviewContexts.values()).filter(
    (context) => context.status === "existing"
  ).length;

  const localOffers = useMemo(
    () => opportunities.filter((opportunity) => opportunity.localRecord === true),
    [opportunities]
  );

  function evidenceWarnings(
    context: ReturnType<typeof buildCandidateReviewContext> | undefined
  ) {
    if (!context || context.status !== "existing") return [];
    const { match } = context;
    const warnings: string[] = [];
    if (!match.amountMatches) {
      warnings.push("Candidate value differs from the current dashboard value");
    }
    if (!match.minimumSpendMatches) {
      warnings.push("Candidate minimum spend differs from the current record");
    }
    if (!match.expirationMatches) {
      warnings.push("Candidate expiration differs from the current end date");
    }
    return warnings;
  }

  function reviewCandidate(id: string, status: CandidateReviewStatus) {
    const current = reviews[id];
    const next = { ...reviews };
    if (current === status) {
      delete next[id];
    } else {
      next[id] = status;
    }
    setReviews(writeCandidateReviews(next));
  }

  function openVerificationForm(candidate: OfferCandidate) {
    setDraftCandidateId(candidate.id);
    setDraftErrors([]);
    const conflict = findLocalOfferConflict(candidate, opportunities);
    const existing =
      conflict.status === "replace" ? conflict.opportunity : undefined;
    setDraft({
      category:
        existing?.category ??
        (candidate.sourceId.includes("heb") ||
        candidate.sourceId.includes("target") ||
        candidate.sourceId.includes("kroger")
          ? "grocery"
          : candidate.sourceId.includes("take5") ||
              candidate.sourceId.includes("costa") ||
              candidate.sourceId.includes("rainbow")
            ? "auto"
            : "restaurants"),
      estimatedSavings: existing?.estimatedSavings ?? 0,
      minimumSpend: existing?.minimumSpend ?? candidate.minimumSpend ?? 0,
      isFree: existing?.isFree ?? false,
      expiresOn: existing?.expiresOn,
      friction: existing?.friction ?? "low",
      stackNote: existing?.stackNote ?? "",
      stackGroup: existing?.stackGroup ?? "",
      stackStatus: existing?.stackStatus ?? "conditional",
      savingsRate: existing?.savingsRate,
      distanceMiles: existing?.distanceMiles,
      localParticipationConfirmed: existing?.localRecord === true,
      officialTermsConfirmed: false
    });
  }

  function updateDraft<K extends keyof LocalVerifiedOfferDraft>(
    key: K,
    value: LocalVerifiedOfferDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submitVerification() {
    const candidate = candidates.find(({ id }) => id === draftCandidateId);
    if (!candidate) return;

    const conflict = findLocalOfferConflict(candidate, opportunities);
    if (conflict.status === "blocked") {
      setDraftErrors([
        `Already tracked as ${conflict.opportunity.title}. Remove the existing record before capturing a replacement.`
      ]);
      return;
    }

    const result = createLocallyVerifiedOffer(candidate, {
      ...draft,
      stackNote: (draft.stackNote ?? "").trim() || undefined,
      stackGroup: (draft.stackGroup ?? "").trim() || undefined
    });
    if (result.status === "invalid") {
      setDraftErrors(result.errors);
      return;
    }

    onAddVerifiedOffer(result.offer);
    setDraftCandidateId(null);
    setDraftErrors([]);
  }

  return (
    <section
      className="tool-card tool-card--wide candidate-review"
      aria-labelledby="candidate-review-title"
    >
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--blue">
          <FlaskConical size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Human-review leads</span>
          <h2 id="candidate-review-title">Discovery review queue</h2>
        </div>
      </div>

      <p className="review-boundary">
        Ranked official-source candidates only. Confirm every term before treating
        one as a deal.
      </p>

      {sourceHealth && (
        <section className="source-health" aria-label="Discovery source health">
          <div>
            <span>Readable sources</span>
            <strong>
              {sourceHealth.successful} of {sourceHealth.total}
            </strong>
          </div>
          <div>
            <span>Unavailable checks</span>
            <strong>{sourceHealth.blocked}</strong>
          </div>
          <p>
            {sourceHealth.blockedNames.length > 0
              ? `Not machine-readable this run: ${sourceHealth.blockedNames.join(", ")}.`
              : "All configured public sources were readable on the latest run."}
          </p>
        </section>
      )}

      <div className="review-controls" role="group" aria-label="Candidate review filter">
        {(["pending", "keep", "dismissed"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={filter === option ? "review-filter review-filter--active" : "review-filter"}
            onClick={() => setFilter(option)}
          >
            {option === "pending" ? "Pending" : option === "keep" ? "Keep" : "Dismissed"}
          </button>
        ))}
        <span className="review-counts">
          {candidates.length - trackedCount} new · {trackedCount} already tracked
        </span>
        {generatedAt && <span className="review-generated">Checked {generatedAt.slice(0, 10)}</span>}
      </div>

      <section className="local-offer-manager" aria-labelledby="local-offer-manager-title">
        <h3 id="local-offer-manager-title">
          Locally recorded deals
          <span>{localOffers.length}</span>
        </h3>
        {localOffers.length === 0 ? (
          <p className="history-empty">No locally recorded deals.</p>
        ) : (
          <ul>
            {localOffers.map((offer) => (
              <li key={offer.id}>
                <div>
                  <strong>{offer.title}</strong>
                  <span>
                    {[
                      offer.merchant,
                      formatCurrency(offer.estimatedSavings),
                      offer.stackGroup ? `group ${offer.stackGroup}` : null,
                      offer.distanceMiles !== undefined ? `${offer.distanceMiles} mi` : null,
                      offer.expiresOn
                        ? `ends ${formatDate(offer.expiresOn)} · ${
                            Math.max(0, daysUntilExpiration(offer.expiresOn))
                          } days left`
                        : "no end date"
                    ].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <button
                  type="button"
                  className="review-action review-action--dismiss"
                  onClick={() => onDeleteVerifiedOffer(offer.id)}
                  aria-label={`Remove locally recorded deal ${offer.title}`}
                >
                  <Trash2 size={13} aria-hidden="true" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {loadError ? (
        <p className="history-empty">Discovery candidates are unavailable.</p>
      ) : visibleCandidates.length === 0 ? (
        <p className="history-empty">No candidates in this view.</p>
      ) : (
        <ul className="candidate-list">
          {visibleCandidates.map((candidate) => {
            const status = reviews[candidate.id];
            const context = reviewContexts.get(candidate.id);
            const isTracked = context?.status === "existing";
            const currentOffer = isTracked ? context.match.opportunity : null;
            const warnings = evidenceWarnings(context);
            return (
              <li key={candidate.id}>
                <div className="candidate-main">
                  <div className="candidate-heading">
                    <strong>{candidate.merchant}</strong>
                    {candidate.candidateScore !== undefined && (
                      <output aria-label={`${candidate.merchant} candidate score`}>
                        {candidate.candidateScore}/100
                      </output>
                    )}
                  </div>
                  <span>{candidate.title}</span>
                  <small>
                    {[
                      candidate.amountText,
                      candidate.minimumSpend ? `spend $${candidate.minimumSpend}` : null,
                      candidate.expirationText ? `through ${candidate.expirationText}` : null
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  {candidate.candidateReasons && (
                    <em>{candidate.candidateReasons.join(" · ")}</em>
                  )}
                  <div
                    className={`candidate-overlap ${
                      isTracked ? "candidate-overlap--tracked" : "candidate-overlap--new"
                    }`}
                  >
                    <strong>{isTracked ? "Already tracked" : "New lead"}</strong>
                    {currentOffer && (
                      <span>
                        Current: {formatCurrency(currentOffer.estimatedSavings)}
                        {currentOffer.minimumSpend > 0
                          ? ` after ${formatCurrency(currentOffer.minimumSpend)} spend`
                          : " · no minimum captured"}
                        {" · ends "}
                        {formatDate(currentOffer.expiresOn)}
                      </span>
                    )}
                    {warnings.length > 0 && (
                      <small>{warnings.join(" · ")}</small>
                    )}
                  </div>
                </div>
                <div className="candidate-actions">
                  <a href={candidate.url} target="_blank" rel="noreferrer">
                    Source <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    className="review-action"
                    onClick={() =>
                      draftCandidateId === candidate.id
                        ? setDraftCandidateId(null)
                        : openVerificationForm(candidate)
                    }
                    aria-label={`Capture terms for ${candidate.title}`}
                  >
                    <BadgeCheck size={14} aria-hidden="true" />
                    {draftCandidateId === candidate.id ? "Close" : "Capture"}
                  </button>
                  <button
                    type="button"
                    className={status === "keep" ? "review-action review-action--keep" : "review-action"}
                    onClick={() => reviewCandidate(candidate.id, "keep")}
                    aria-label={`${status === "keep" ? "Unmark" : "Keep"} ${candidate.title}`}
                  >
                    <ThumbsUp size={14} aria-hidden="true" /> Keep
                  </button>
                  <button
                    type="button"
                    className={status === "dismissed" ? "review-action review-action--dismiss" : "review-action"}
                    onClick={() => reviewCandidate(candidate.id, "dismissed")}
                    aria-label={`${status === "dismissed" ? "Restore" : "Dismiss"} ${candidate.title}`}
                  >
                    <ThumbsDown size={14} aria-hidden="true" /> Dismiss
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draftCandidateId && (
        <form
          className="candidate-verify-form"
          aria-label="Capture verified offer terms"
          onSubmit={(event) => {
            event.preventDefault();
            submitVerification();
          }}
        >
          <div className="candidate-verify-header">
            <div>
              <span className="eyebrow">Manual confirmation</span>
              <h3>{candidates.find(({ id }) => id === draftCandidateId)?.title}</h3>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setDraftCandidateId(null)}
              aria-label="Close offer capture"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          {draftErrors.length > 0 && (
            <ul className="candidate-verify-errors">
              {draftErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          <div className="candidate-verify-grid">
            <label>
              <span>Category</span>
              <select
                value={draft.category}
                onChange={(event) =>
                  updateDraft("category", event.target.value as Category)
                }
              >
                {LOCAL_OFFER_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Dollar estimate</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.estimatedSavings}
                onChange={(event) =>
                  updateDraft("estimatedSavings", Number(event.target.value || 0))
                }
              />
            </label>
            <label>
              <span>Savings rate %</span>
              <input
                aria-label="Savings rate percent"
                type="number"
                min="1"
                max="100"
                step="0.1"
                value={draft.savingsRate ?? ""}
                onChange={(event) =>
                  updateDraft(
                    "savingsRate",
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value)
                  )
                }
              />
            </label>
            <label>
              <span>Minimum spend</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.minimumSpend}
                onChange={(event) =>
                  updateDraft("minimumSpend", Number(event.target.value || 0))
                }
              />
            </label>
            <label>
              <span>Expires on</span>
              <input
                type="date"
                value={draft.expiresOn ?? ""}
                onChange={(event) =>
                  updateDraft("expiresOn", event.target.value || undefined)
                }
              />
            </label>
            <label>
              <span>Redemption effort</span>
              <select
                value={draft.friction}
                onChange={(event) =>
                  updateDraft("friction", event.target.value as Friction)
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              <span>Stack note</span>
              <input
                type="text"
                maxLength={160}
                placeholder="Optional official stack rule"
                value={draft.stackNote}
                onChange={(event) => updateDraft("stackNote", event.target.value)}
              />
            </label>
            <label>
              <span>Exclusion group</span>
              <input
                aria-label="Official exclusion group"
                type="text"
                maxLength={60}
                placeholder="Optional same-merchant key"
                value={draft.stackGroup}
                onChange={(event) => updateDraft("stackGroup", event.target.value)}
              />
              </label>
            <label>
              <span>Stack compatibility</span>
              <select
                aria-label="Stack compatibility"
                value={draft.stackStatus}
                onChange={(event) =>
                  updateDraft(
                    "stackStatus",
                    event.target.value as LocalVerifiedOfferDraft["stackStatus"]
                  )
                }
              >
                <option value="compatible">Compatible</option>
                <option value="conditional">Confirm first</option>
                <option value="exclusive">Cannot combine</option>
              </select>
            </label>
            <label>
              <span>Confirmed miles</span>
              <input
                aria-label="Confirmed distance in miles"
                type="number"
                min="0"
                max="50"
                step="0.1"
                disabled={!draft.localParticipationConfirmed}
                value={draft.distanceMiles ?? ""}
                onChange={(event) =>
                  updateDraft(
                    "distanceMiles",
                    event.target.value === "" ? undefined : Number(event.target.value)
                  )
                }
              />
            </label>
          </div>

          <div className="candidate-verify-checks">
            <label>
              <input
                type="checkbox"
                checked={draft.isFree}
                onChange={(event) => updateDraft("isFree", event.target.checked)}
              />
              <span>Free reward</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.officialTermsConfirmed}
                onChange={(event) =>
                  updateDraft("officialTermsConfirmed", event.target.checked)
                }
              />
              <span>I confirmed the linked official terms</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.localParticipationConfirmed}
                onChange={(event) =>
                  updateDraft("localParticipationConfirmed", event.target.checked)
                }
              />
              <span>Local participation confirmed</span>
            </label>
          </div>

          <button type="submit" className="review-action review-action--keep">
            <BadgeCheck size={14} aria-hidden="true" />
            {(() => {
              const candidate = candidates.find(({ id }) => id === draftCandidateId);
              const conflict =
                candidate && findLocalOfferConflict(candidate, opportunities);
              return conflict?.status === "replace"
                ? "Update locally recorded deal"
                : "Add locally recorded deal";
            })()}
          </button>
        </form>
      )}
    </section>
  );
}
