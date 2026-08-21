import { ExternalLink, FlaskConical, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  readCandidateReviews,
  writeCandidateReviews
} from "../lib/storage";
import type {
  CandidateReviewStatus,
  CandidateReviews,
  OfferCandidate
} from "../types";

interface DiscoverySnapshot {
  generatedAt: string;
  parsedOfferCandidates: OfferCandidate[];
}

export function CandidateReviewQueue() {
  const [candidates, setCandidates] = useState<OfferCandidate[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [loadError, setLoadError] = useState(false);
  const [reviews, setReviews] = useState<CandidateReviews>(readCandidateReviews);
  const [filter, setFilter] = useState<CandidateReviewStatus | "pending">("pending");

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
      if (filter === "pending") return !status;
      return status === filter;
    });
  }, [candidates, filter, reviews]);

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
        {generatedAt && <span className="review-generated">Checked {generatedAt.slice(0, 10)}</span>}
      </div>

      {loadError ? (
        <p className="history-empty">Discovery candidates are unavailable.</p>
      ) : visibleCandidates.length === 0 ? (
        <p className="history-empty">No candidates in this view.</p>
      ) : (
        <ul className="candidate-list">
          {visibleCandidates.map((candidate) => {
            const status = reviews[candidate.id];
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
                </div>
                <div className="candidate-actions">
                  <a href={candidate.url} target="_blank" rel="noreferrer">
                    Source <ExternalLink size={13} aria-hidden="true" />
                  </a>
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
    </section>
  );
}
