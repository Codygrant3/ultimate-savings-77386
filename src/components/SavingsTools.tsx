import {
  AlertTriangle,
  Bell,
  BellRing,
  Calculator,
  CalendarClock,
  Check,
  ExternalLink,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingDown
} from "lucide-react";
import { useMemo, useState } from "react";
import comparisonData from "../data/local-grocery-comparisons.json";
import {
  readPriceAlerts,
  readReminderIds,
  toggleStoredId,
  writePriceAlerts
} from "../lib/storage";
import type {
  LocalGroceryComparison,
  Opportunity,
  PriceAlert
} from "../types";

const DEFAULT_ALERTS: PriceAlert[] = [
  {
    id: "regular-gas",
    item: "Regular gas",
    category: "Fuel",
    targetPrice: 2.75,
    latestPrice: null,
    unit: "per gal",
    sourceLabel: "Public fuel-reward sources"
  },
  {
    id: "ground-beef-80-20",
    item: "80/20 ground beef",
    category: "Groceries",
    targetPrice: 5,
    latestPrice: 5.99,
    unit: "per lb",
    sourceLabel: "Official product listings",
    checkedOn: "2026-07-23"
  },
  {
    id: "oil-change",
    item: "Full-service oil change",
    category: "Auto care",
    targetPrice: 40,
    latestPrice: null,
    unit: "total",
    sourceLabel: "Official local coupons"
  },
  {
    id: "teen-school-shoes",
    item: "Teen school shoes",
    category: "Back to school",
    targetPrice: 40,
    latestPrice: null,
    unit: "per pair",
    sourceLabel: "Official retailer ads"
  }
];

const comparisons = comparisonData.comparisons as LocalGroceryComparison[];

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${date}T12:00:00`);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

function PriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() =>
    readPriceAlerts(DEFAULT_ALERTS)
  );
  const [item, setItem] = useState("");
  const [target, setTarget] = useState("");

  function updateAlert(id: string, field: "targetPrice" | "latestPrice", value: string) {
    const parsed = value === "" ? null : Math.max(0, Number(value));
    const next = alerts.map((alert) =>
      alert.id === id
        ? {
            ...alert,
            [field]: field === "targetPrice" ? (parsed ?? 0) : parsed
          }
        : alert
    );
    setAlerts(writePriceAlerts(next));
  }

  function addAlert() {
    const cleanItem = item.trim();
    const parsedTarget = Number(target);
    if (!cleanItem || !Number.isFinite(parsedTarget) || parsedTarget <= 0) return;
    const next = [
      ...alerts,
      {
        id: `custom-${Date.now()}`,
        item: cleanItem,
        category: "Custom",
        targetPrice: parsedTarget,
        latestPrice: null,
        unit: "target",
        sourceLabel: "Manual tracking"
      }
    ];
    setAlerts(writePriceAlerts(next));
    setItem("");
    setTarget("");
  }

  function removeAlert(id: string) {
    setAlerts(writePriceAlerts(alerts.filter((alert) => alert.id !== id)));
  }

  return (
    <section className="tool-card tool-card--wide" aria-labelledby="price-alerts-title">
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--green">
          <TrendingDown size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Watch the staples</span>
          <h2 id="price-alerts-title">Price-drop alerts</h2>
        </div>
      </div>
      <p className="tool-intro">
        Track a target price without connecting a retailer account. Enter the latest
        public price when a source is refreshed; matched targets turn green.
      </p>

      <div className="alert-list">
        {alerts.map((alert) => {
          const matched =
            alert.latestPrice !== null && alert.latestPrice <= alert.targetPrice;
          return (
            <div className={`price-alert ${matched ? "price-alert--matched" : ""}`} key={alert.id}>
              <div className="price-alert__name">
                {matched ? <BellRing size={17} /> : <Bell size={17} />}
                <div>
                  <strong>{alert.item}</strong>
                  <span>{alert.category} · {alert.sourceLabel}</span>
                </div>
              </div>
              <label>
                <span>Target</span>
                <input
                  aria-label={`${alert.item} target price`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={alert.targetPrice}
                  onChange={(event) =>
                    updateAlert(alert.id, "targetPrice", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Latest</span>
                <input
                  aria-label={`${alert.item} latest price`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={alert.latestPrice ?? ""}
                  placeholder="—"
                  onChange={(event) =>
                    updateAlert(alert.id, "latestPrice", event.target.value)
                  }
                />
              </label>
              <span className="price-alert__unit">{alert.unit}</span>
              <span className={`match-state ${matched ? "match-state--yes" : ""}`}>
                {matched ? <><Check size={13} /> Target met</> : "Watching"}
              </span>
              <button
                type="button"
                className="remove-button"
                aria-label={`Remove ${alert.item} price alert`}
                onClick={() => removeAlert(alert.id)}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="alert-adder">
        <label>
          <span>Item to watch</span>
          <input
            value={item}
            onChange={(event) => setItem(event.target.value)}
            placeholder="Coffee beans, movie ticket…"
          />
        </label>
        <label>
          <span>Target price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="0.00"
          />
        </label>
        <button type="button" onClick={addAlert}>
          <Plus size={16} aria-hidden="true" /> Add alert
        </button>
      </div>
    </section>
  );
}

function StackingCalculator() {
  const [regularPrice, setRegularPrice] = useState(50);
  const [salePrice, setSalePrice] = useState(40);
  const [coupon, setCoupon] = useState(5);
  const [loyalty, setLoyalty] = useState(3);
  const [cashbackRate, setCashbackRate] = useState(5);

  const math = useMemo(() => {
    const original = Math.max(0, regularPrice);
    const sale = Math.min(original, Math.max(0, salePrice));
    const afterCoupon = Math.max(0, sale - Math.max(0, coupon));
    const afterLoyalty = Math.max(0, afterCoupon - Math.max(0, loyalty));
    const cashback = afterLoyalty * Math.min(100, Math.max(0, cashbackRate)) / 100;
    const finalCost = Math.max(0, afterLoyalty - cashback);
    return {
      saleDiscount: original - sale,
      afterCoupon,
      afterLoyalty,
      cashback,
      finalCost,
      totalSavings: original - finalCost
    };
  }, [cashbackRate, coupon, loyalty, regularPrice, salePrice]);

  return (
    <section className="tool-card" aria-labelledby="stacking-title">
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--orange">
          <Calculator size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Show every layer</span>
          <h2 id="stacking-title">Deal-stacking calculator</h2>
        </div>
      </div>
      <p className="tool-intro">
        Cashback is calculated last, on the remaining eligible purchase amount.
        Confirm each program permits the combination.
      </p>
      <div className="calculator-grid">
        {[
          ["Regular price", regularPrice, setRegularPrice],
          ["Store sale price", salePrice, setSalePrice],
          ["Digital coupon", coupon, setCoupon],
          ["Loyalty reward", loyalty, setLoyalty],
          ["Cashback %", cashbackRate, setCashbackRate]
        ].map(([label, value, setter]) => (
          <label key={label as string}>
            <span>{label as string}</span>
            <input
              aria-label={label as string}
              type="number"
              min="0"
              max={label === "Cashback %" ? 100 : undefined}
              step="0.01"
              value={value as number}
              onChange={(event) =>
                (setter as (next: number) => void)(Number(event.target.value))
              }
            />
          </label>
        ))}
      </div>
      <ol className="stack-breakdown">
        <li><span>Store sale</span><strong>−{money(math.saleDiscount)}</strong></li>
        <li><span>After digital coupon</span><strong>{money(math.afterCoupon)}</strong></li>
        <li><span>After loyalty reward</span><strong>{money(math.afterLoyalty)}</strong></li>
        <li><span>Cashback earned</span><strong>−{money(math.cashback)}</strong></li>
      </ol>
      <div className="stack-total">
        <div><span>Final cost</span><strong>{money(math.finalCost)}</strong></div>
        <div><span>Total saved</span><strong>{money(math.totalSavings)}</strong></div>
      </div>
    </section>
  );
}

function ExpirationReminders({ opportunities }: { opportunities: Opportunity[] }) {
  const [reminderIds, setReminderIds] = useState<string[]>(readReminderIds);
  const expiring = [...opportunities]
    .filter((opportunity) => opportunity.expiresOn)
    .sort((a, b) => (a.expiresOn ?? "").localeCompare(b.expiresOn ?? ""));

  function toggleReminder(id: string) {
    setReminderIds(toggleStoredId("reminder", id));
  }

  return (
    <section className="tool-card" aria-labelledby="reminders-title">
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--purple">
          <CalendarClock size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Do not lose the value</span>
          <h2 id="reminders-title">Expiration reminders</h2>
        </div>
      </div>
      <p className="tool-intro">
        Reminder choices stay in this browser. They do not send email, text, or
        push notifications.
      </p>
      <div className="reminder-list">
        {expiring.map((opportunity) => {
          const enabled = reminderIds.includes(opportunity.id);
          const remaining = daysUntil(opportunity.expiresOn!);
          return (
            <div className="reminder-row" key={opportunity.id}>
              <div>
                <strong>{opportunity.merchant}</strong>
                <span>{opportunity.title}</span>
              </div>
              <span className={remaining <= 7 ? "days-left days-left--urgent" : "days-left"}>
                {remaining < 0 ? "Expired" : `${remaining} days`}
              </span>
              <button
                type="button"
                className={enabled ? "reminder-toggle reminder-toggle--on" : "reminder-toggle"}
                onClick={() => toggleReminder(opportunity.id)}
                aria-label={`${enabled ? "Disable" : "Enable"} reminder for ${opportunity.title}`}
              >
                {enabled ? <BellRing size={15} /> : <Bell size={15} />}
                {enabled ? "On" : "Remind me"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GroceryComparisons() {
  const [openId, setOpenId] = useState(comparisons[0]?.id ?? "");

  return (
    <section className="tool-card tool-card--wide grocery-research" aria-labelledby="grocery-title">
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--blue">
          <ShieldCheck size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Official-source comparison</span>
          <h2 id="grocery-title">77386 local grocery check</h2>
        </div>
      </div>
      <div className="research-summary">
        <p>
          Checked July 23, 2026. Store-specific proof is required before a local
          winner is named. “Needs local check” means the price is official but the
          public page did not bind it to a 77386 store.
        </p>
        <span><ShieldCheck size={14} /> Local proof</span>
        <span><AlertTriangle size={14} /> Recheck location</span>
      </div>

      <div className="comparison-tabs" role="tablist" aria-label="Grocery comparisons">
        {comparisons.map((comparison) => (
          <button
            type="button"
            role="tab"
            aria-selected={openId === comparison.id}
            key={comparison.id}
            onClick={() => setOpenId(comparison.id)}
          >
            {comparison.item}
          </button>
        ))}
      </div>

      {comparisons
        .filter((comparison) => comparison.id === openId)
        .map((comparison) => (
          <div className="comparison-panel" key={comparison.id}>
            <div className="comparison-panel__note">
              <strong>{comparison.winner ?? "No verified local winner"}</strong>
              <p>{comparison.comparisonNote}</p>
            </div>
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Product / size</th>
                    <th>Price</th>
                    <th>Local status</th>
                    <th>Date / source</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.prices.map((entry) => (
                    <tr key={`${comparison.id}-${entry.retailer}`}>
                      <td><strong>{entry.retailer}</strong></td>
                      <td>
                        {entry.product}
                        <small>{entry.packageSize}</small>
                      </td>
                      <td>
                        {entry.unitPrice === null
                          ? "Unavailable"
                          : `${money(entry.unitPrice)}/${entry.unit}`}
                        {entry.price !== null && entry.price !== entry.unitPrice && (
                          <small>{money(entry.price)} package</small>
                        )}
                      </td>
                      <td>
                        <span className={`source-status source-status--${entry.status}`}>
                          {entry.status === "verified-local"
                            ? "Verified 77386"
                            : entry.status === "unavailable"
                              ? "Unavailable"
                              : "Needs local check"}
                        </span>
                        <small>{entry.locationNote}</small>
                      </td>
                      <td>
                        <span>{entry.dateLabel}</span>
                        <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
                          Official source <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </section>
  );
}

export function SavingsTools({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <>
      <section className="page-heading tools-heading">
        <span className="eyebrow">Personal savings controls</span>
        <h1>Savings tools</h1>
        <p>
          Track targets, test legitimate stacks, and protect expiring value—all
          locally, without account credentials or payment information.
        </p>
      </section>
      <div className="privacy-banner">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          <strong>Private by design.</strong> Only deal preferences and reminder
          choices are saved in this browser.
        </span>
      </div>
      <div className="tools-grid">
        <PriceAlerts />
        <StackingCalculator />
        <ExpirationReminders opportunities={opportunities} />
        <GroceryComparisons />
      </div>
    </>
  );
}
