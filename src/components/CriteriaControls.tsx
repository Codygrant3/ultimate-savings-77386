import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_SCORING_WEIGHTS,
  effectiveScoringWeights
} from "../lib/scoring";
import type { ScoringWeights } from "../types";

const CRITERIA = [
  { key: "evidence", label: "Evidence" },
  { key: "dollarValue", label: "Dollar value" },
  { key: "savingsRate", label: "Savings rate" },
  { key: "householdFit", label: "Household fit" },
  { key: "localRelevance", label: "Local relevance" },
  { key: "timing", label: "Timing" },
  { key: "effort", label: "Effort" },
  { key: "requiredSpend", label: "Required spend" },
  { key: "stackability", label: "Stackability" }
] as const;

export function CriteriaControls({
  weights,
  onWeightsChange
}: {
  weights: ScoringWeights;
  onWeightsChange: (weights: ScoringWeights) => void;
}) {
  const effective = effectiveScoringWeights(weights);

  function updateWeight(key: keyof ScoringWeights, value: number) {
    onWeightsChange({ ...weights, [key]: value });
  }

  return (
    <section className="criteria-panel" aria-labelledby="criteria-panel-title">
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--green">
          <SlidersHorizontal size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Ranking contract</span>
          <h2 id="criteria-panel-title">Your ranking criteria</h2>
        </div>
        <button
          type="button"
          className="criteria-reset"
          onClick={() => onWeightsChange(DEFAULT_SCORING_WEIGHTS)}
        >
          <RotateCcw size={13} aria-hidden="true" /> Reset
        </button>
      </div>

      <div className="criteria-grid">
        {CRITERIA.map(({ key, label }) => (
          <label key={key} className="criteria-item">
            <span>{label}</span>
            <input
              aria-label={`${label} priority`}
              type="range"
              min="0"
              max="50"
              step="1"
              value={weights[key]}
              onChange={(event) =>
                updateWeight(key, Number(event.target.value || 0))
              }
            />
            <output aria-label={`${label} effective weight`}>
              {effective[key]}%
            </output>
          </label>
        ))}
      </div>

      <p className="criteria-note">
        Relative priorities are normalized to a 100-point ranking and stay on
        this device.
      </p>
    </section>
  );
}
