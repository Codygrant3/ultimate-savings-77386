import { RotateCcw, Users } from "lucide-react";
import {
  DEFAULT_HOUSEHOLD_PROFILE,
  normalizeHouseholdProfile
} from "../lib/scoring";
import type { HouseholdProfile } from "../types";

const FIELDS = [
  {
    key: "highPriorityKeywords",
    label: "High priority",
    placeholder: "teen, school supplies, sports gear"
  },
  {
    key: "preferredKeywords",
    label: "Preferred",
    placeholder: "groceries, coffee, fuel, oil change"
  },
  {
    key: "excludedKeywords",
    label: "Exclude",
    placeholder: "baby, infant, unrelated activities"
  }
] as const;

export function HouseholdProfileControls({
  profile,
  onProfileChange
}: {
  profile: HouseholdProfile;
  onProfileChange: (profile: HouseholdProfile) => void;
}) {
  const normalized = normalizeHouseholdProfile(profile);

  function updateField(
    key: keyof HouseholdProfile,
    value: string
  ) {
    onProfileChange(
      normalizeHouseholdProfile({
        ...profile,
        [key]: value.split(/[,\n]/)
      })
    );
  }

  return (
    <section
      className="criteria-panel household-panel"
      aria-labelledby="household-profile-title"
    >
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--blue">
          <Users size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Fit controls</span>
          <h2 id="household-profile-title">Household priorities</h2>
        </div>
        <button
          type="button"
          className="criteria-reset"
          onClick={() => onProfileChange(DEFAULT_HOUSEHOLD_PROFILE)}
        >
          <RotateCcw size={13} aria-hidden="true" /> Reset
        </button>
      </div>

      <div className="household-grid">
        {FIELDS.map(({ key, label, placeholder }) => (
          <label key={key}>
            <span>{label}</span>
            <textarea
              aria-label={`${label} keywords`}
              rows={3}
              maxLength={600}
              placeholder={placeholder}
              value={normalized[key].join(", ")}
              onChange={(event) => updateField(key, event.target.value)}
            />
            <small>
              {normalized[key].length}
              {" keyword"}
              {normalized[key].length === 1 ? "" : "s"}
            </small>
          </label>
        ))}
      </div>

      <p className="criteria-note">
        Separate terms with commas or new lines. Keywords and exclusions stay on
        this device.
      </p>
    </section>
  );
}
