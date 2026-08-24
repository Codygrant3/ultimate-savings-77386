import {
  AlertTriangle,
  Bookmark,
  CalendarRange,
  CircleDollarSign,
  Check,
  Car,
  ExternalLink,
  MapPin,
  RotateCcw,
  Scale,
  ShieldCheck,
  ShoppingBasket
} from "lucide-react";
import { useMemo, useState } from "react";
import { buildWeeklyPlan, daysUntilExpiration } from "../lib/plan";
import { buildOfferOutcomeAdjustments } from "../lib/outcomes";
import { formatCurrency, formatDate } from "../lib/scoring";
import type {
  ReceiptEntry,
  ScoredOpportunity,
  WeeklyPlanSettings
} from "../types";

export function WeeklyPlanner({
  opportunities,
  settings,
  onSettingsChange,
  savedIds,
  redeemedIds,
  receipts,
  onSave,
  onRedeem
}: {
  opportunities: ScoredOpportunity[];
  settings: WeeklyPlanSettings;
  onSettingsChange: (settings: WeeklyPlanSettings) => void;
  savedIds: string[];
  redeemedIds: string[];
  receipts: ReceiptEntry[];
  onSave: (id: string) => void;
  onRedeem: (id: string) => void;
}) {
  const [showExcluded, setShowExcluded] = useState(false);
  const today = useMemo(() => new Date(), []);
  const outcomeAdjustments = useMemo(
    () => buildOfferOutcomeAdjustments(receipts, today),
    [receipts, today]
  );
  const actionableOpportunities = useMemo(
    () => opportunities.filter((opportunity) => !redeemedIds.includes(opportunity.id)),
    [opportunities, redeemedIds]
  );
  const plan = useMemo(
    () =>
      buildWeeklyPlan(actionableOpportunities, settings, today, outcomeAdjustments),
    [actionableOpportunities, outcomeAdjustments, settings, today]
  );

  function updateSetting<K extends keyof WeeklyPlanSettings>(
    key: K,
    value: WeeklyPlanSettings[K]
  ) {
    onSettingsChange({ ...settings, [key]: value });
  }

  return (
    <section className="planner" aria-labelledby="weekly-planner-title">
      <div className="page-heading planner-heading">
        <span className="eyebrow">Criteria-constrained planning</span>
        <h1 id="weekly-planner-title">Weekly action plan</h1>
        <p>
          Turn verified offers into the strongest trip plan within your spend,
          travel, and effort limits.
        </p>
      </div>

      <section className="planner-controls" aria-label="Weekly plan controls">
        <label>
          <span>Weekly spend budget</span>
          <input
            aria-label="Weekly spend budget"
            type="number"
            min="0"
            max="500"
            step="5"
            value={settings.weeklyBudget}
            onChange={(event) =>
              updateSetting("weeklyBudget", Number(event.target.value || 0))
            }
          />
        </label>
        <label>
          <span>Maximum trips</span>
          <input
            aria-label="Maximum trips"
            type="number"
            min="1"
            max="8"
            step="1"
            value={settings.maxTrips}
            onChange={(event) =>
              updateSetting("maxTrips", Number(event.target.value || 1))
            }
          />
        </label>
        <label>
          <span>Maximum miles</span>
          <input
            aria-label="Maximum miles"
            type="number"
            min="1"
            max="50"
            step="1"
            value={settings.maxDistanceMiles}
            onChange={(event) =>
              updateSetting("maxDistanceMiles", Number(event.target.value || 1))
            }
          />
        </label>
        <label>
          <span>Cost per mile</span>
          <input
            aria-label="Estimated cost per mile"
            type="number"
            min="0"
            max="5"
            step="0.05"
            value={settings.travelCostPerMile}
            onChange={(event) =>
              updateSetting(
                "travelCostPerMile",
                Number(event.target.value || 0)
              )
            }
          />
        </label>
        <label>
          <span>Minimum days valid</span>
          <input
            aria-label="Minimum days valid"
            type="number"
            min="0"
            max="30"
            step="1"
            value={settings.minimumDaysRemaining}
            onChange={(event) =>
              updateSetting(
                "minimumDaysRemaining",
                Number(event.target.value || 0)
              )
            }
          />
        </label>
        <label>
          <span>Maximum source age</span>
          <input
            aria-label="Maximum source age"
            type="number"
            min="1"
            max="90"
            step="1"
            value={settings.maximumSourceAgeDays}
            onChange={(event) =>
              updateSetting(
                "maximumSourceAgeDays",
                Number(event.target.value || 1)
              )
            }
          />
        </label>
        <label>
          <span>Maximum effort</span>
          <select
            aria-label="Maximum effort"
            value={settings.maximumFriction}
            onChange={(event) =>
              updateSetting(
                "maximumFriction",
                event.target.value as WeeklyPlanSettings["maximumFriction"]
              )
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="any">Any</option>
          </select>
        </label>
        <label>
          <span>Deals per merchant</span>
          <input
            aria-label="Deals per merchant"
            type="number"
            min="1"
            max="5"
            step="1"
            value={settings.maxDealsPerTrip}
            onChange={(event) =>
              updateSetting("maxDealsPerTrip", Number(event.target.value || 1))
            }
          />
        </label>
        <label>
          <span>Trip order</span>
          <select
            aria-label="Trip order"
            value={settings.tripOrder}
            onChange={(event) =>
              updateSetting(
                "tripOrder",
                event.target.value as WeeklyPlanSettings["tripOrder"]
              )
            }
          >
            <option value="utility">Strongest value first</option>
            <option value="distance">Nearest trip first</option>
          </select>
        </label>
        <label>
          <span>Planning objective</span>
          <select
            aria-label="Planning objective"
            value={settings.planObjective}
            onChange={(event) =>
              updateSetting(
                "planObjective",
                event.target.value as WeeklyPlanSettings["planObjective"]
              )
            }
          >
            <option value="balanced">Balanced value</option>
            <option value="cash">Maximum cash</option>
            <option value="efficiency">Best per dollar</option>
          </select>
        </label>
        <label className="planner-toggle">
          <input
            type="checkbox"
            checked={settings.allowConditionalStacking}
            onChange={(event) =>
              updateSetting(
                "allowConditionalStacking",
                event.target.checked
              )
            }
          />
          <span>Allow conditional stacks</span>
        </label>
        <label className="planner-toggle">
          <input
            type="checkbox"
            checked={settings.includeUnconfirmedLocations}
            onChange={(event) =>
              updateSetting(
                "includeUnconfirmedLocations",
                event.target.checked
              )
            }
          />
          <span>Include unconfirmed locations</span>
        </label>
        <label className="planner-toggle">
          <input
            type="checkbox"
            checked={settings.requireLocalParticipation}
            onChange={(event) =>
              updateSetting(
                "requireLocalParticipation",
                event.target.checked
              )
            }
          />
          <span>Require confirmed participation</span>
        </label>
        <label className="planner-toggle">
          <input
            type="checkbox"
            checked={settings.requireHighPriorityFit}
            onChange={(event) =>
              updateSetting(
                "requireHighPriorityFit",
                event.target.checked
              )
            }
          />
          <span>High-priority only</span>
        </label>
        <label className="planner-toggle">
          <input
            type="checkbox"
            checked={settings.requireMeasuredDollarValue}
            onChange={(event) =>
              updateSetting(
                "requireMeasuredDollarValue",
                event.target.checked
              )
            }
          />
          <span>Measured cash value only</span>
        </label>
      </section>

      <p className="plan-note">
        Offers marked used are removed from this plan; saving an offer keeps it
        available for a later trip.
      </p>

      <section className="plan-metrics" aria-label="Weekly plan summary">
        <article>
          <CircleDollarSign size={19} aria-hidden="true" />
          <span>Estimated savings</span>
          <strong>{formatCurrency(plan.estimatedSavings)}</strong>
        </article>
        {plan.calibrationDelta !== 0 && (
          <article>
            <Scale size={19} aria-hidden="true" />
            <span>Household-calibrated savings</span>
            <strong>
              {formatCurrency(plan.calibratedSavings)}
              {plan.calibrationDelta > 0 ? " (above estimate)" : " (below estimate)"}
            </strong>
          </article>
        )}
        <article>
          <ShoppingBasket size={19} aria-hidden="true" />
          <span>Planned spend</span>
          <strong>{formatCurrency(plan.requiredSpend)}</strong>
        </article>
        <article>
          <ShieldCheck size={19} aria-hidden="true" />
          <span>Planning confidence</span>
          <strong>{Math.round(plan.evidenceConfidence * 100)}%</strong>
        </article>
        <article>
          <CalendarRange size={19} aria-hidden="true" />
          <span>Merchants</span>
          <strong>{plan.trips.length}</strong>
        </article>
        <article>
          <MapPin size={19} aria-hidden="true" />
          <span>Savings rate</span>
          <strong>{Math.round(plan.savingsRate)}%</strong>
        </article>
        <article>
          <Scale size={19} aria-hidden="true" />
          <span>Value per $1 spent</span>
          <strong>
            {plan.valueEfficiency === null
              ? "No spend"
              : `$${plan.valueEfficiency.toFixed(2)} per $1 spent`}
          </strong>
        </article>
        <article>
          <CircleDollarSign size={19} aria-hidden="true" />
          <span>Estimated net cost</span>
          <strong>{formatCurrency(plan.estimatedNetCost)}</strong>
        </article>
        {plan.totalTravelCost > 0 && (
          <>
            <article>
              <Car size={19} aria-hidden="true" />
              <span>Estimated round-trip travel cost</span>
              <strong>{formatCurrency(plan.totalTravelCost)}</strong>
            </article>
            <article>
              <CircleDollarSign size={19} aria-hidden="true" />
              <span>Net benefit after travel</span>
              <strong>{formatCurrency(plan.netBenefitAfterTravel)}</strong>
            </article>
          </>
        )}
      </section>

      {plan.trips.length === 0 ? (
        <p className="plan-empty">
          No verified offers fit these limits. Raise the budget or include more
          locations to see alternatives.
        </p>
      ) : (
        <ol className="trip-list">
          {plan.trips.map((trip, index) => (
            <li key={trip.id}>
              <article className="trip-card">
                <header>
                  <div>
                    <span className="eyebrow">{`Trip ${index + 1}`}</span>
                    <h2>{trip.merchant}</h2>
                  </div>
                  <div className="trip-score">
                    <strong>{formatCurrency(trip.estimatedSavings)}</strong>
                    <span>official estimate</span>
                  </div>
                </header>
                <div className="trip-meta">
                  <span>
                    <MapPin size={14} aria-hidden="true" />
                    {trip.distanceConfirmed && !trip.hasUnconfirmedLocationDeal
                      ? `${trip.distanceMiles} mi · approximate location distance${
                          trip.hasUnconfirmedParticipationDeal
                            ? " · confirm participation"
                            : ""
                        }`
                      : trip.distanceConfirmed && trip.hasUnconfirmedLocationDeal
                        ? `Nearest confirmed ${trip.distanceMiles} mi · ${
                            trip.deals.filter(
                              (deal) => deal.opportunity.distanceMiles === undefined
                            ).length
                          } deal location unconfirmed${
                            trip.hasUnconfirmedParticipationDeal
                              ? " · confirm participation"
                              : ""
                          }`
                        : "Location unconfirmed"}
                  </span>
                  <span>
                    Spend {formatCurrency(trip.requiredSpend)} · score{" "}
                    {Math.round(trip.averageScore)}
                    · confidence {Math.round(trip.evidenceConfidence * 100)}%
                  </span>
                  {trip.netBenefitAfterTravel != null && (
                    <span>
                      Official estimate{" "}
                      {formatCurrency(trip.estimatedSavings)} · household
                      estimate {formatCurrency(trip.calibratedSavings)} ·
                      risk-adjusted value{" "}
                      {formatCurrency(trip.riskAdjustedSavings)} · travel{" "}
                      {formatCurrency(trip.estimatedTravelCost ?? 0)} · benefit{" "}
                      {formatCurrency(trip.netBenefitAfterTravel)}
                    </span>
                  )}
                </div>
                <ul className="trip-deals">
                  {trip.deals.map(({ opportunity, warnings }) => (
                    <li key={opportunity.id}>
                      <div>
                        <strong>{opportunity.title}</strong>
                        <span>
                          {formatCurrency(opportunity.estimatedSavings)} value
                          {opportunity.minimumSpend > 0
                            ? ` · spend ${formatCurrency(opportunity.minimumSpend)}`
                            : ""}
                          {opportunity.expiresOn
                            ? ` · ends ${formatDate(opportunity.expiresOn)} · ${
                                Math.max(
                                  0,
                                  daysUntilExpiration(opportunity.expiresOn, today)
                                )
                              } days left`
                            : ""}
                        </span>
                        {warnings.map((warning) => (
                          <em key={warning}>
                            <AlertTriangle size={12} aria-hidden="true" />{" "}
                            {warning}
                          </em>
                        ))}
                      </div>
                      <div className="trip-deal-side">
                        <a
                          href={opportunity.source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source <ExternalLink size={13} aria-hidden="true" />
                        </a>
                        <div className="trip-deal-actions">
                          <button
                            type="button"
                            className={
                              savedIds.includes(opportunity.id)
                                ? "icon-button icon-button--active"
                                : "icon-button"
                            }
                            onClick={() => onSave(opportunity.id)}
                            aria-label={
                              savedIds.includes(opportunity.id)
                                ? `Remove ${opportunity.title} from saved`
                                : `Save ${opportunity.title}`
                            }
                            title={
                              savedIds.includes(opportunity.id)
                                ? "Remove from saved"
                                : "Save for later"
                            }
                          >
                            <Bookmark
                              size={15}
                              fill={savedIds.includes(opportunity.id) ? "currentColor" : "none"}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            className={
                              redeemedIds.includes(opportunity.id)
                                ? "icon-button icon-button--success"
                                : "icon-button"
                            }
                            onClick={() => onRedeem(opportunity.id)}
                            aria-label={
                              redeemedIds.includes(opportunity.id)
                                ? `Mark ${opportunity.title} as not used`
                                : `Mark ${opportunity.title} as used`
                            }
                            title={
                              redeemedIds.includes(opportunity.id)
                                ? "Mark as not used"
                                : "Mark as used"
                            }
                          >
                            {redeemedIds.includes(opportunity.id) ? (
                              <RotateCcw size={15} aria-hidden="true" />
                            ) : (
                              <Check size={15} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      )}

      <section className="plan-assumptions" aria-label="Planning assumptions">
        <h2>How this plan was chosen</h2>
        <ul>
          {plan.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>

      <section className="plan-exclusions" aria-label="Offers not selected">
        <button type="button" onClick={() => setShowExcluded(!showExcluded)}>
          {showExcluded ? "Hide" : "Show"} {plan.excluded.length} excluded or
          lower-priority offers
        </button>
        {showExcluded && (
          <ul>
            {plan.excluded.slice(0, 20).map(({ opportunity, reason }) => (
              <li key={`${reason}-${opportunity.id}`}>
                <strong>{opportunity.merchant}</strong>
                <span>{opportunity.title}</span>
                <em>{reason}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
