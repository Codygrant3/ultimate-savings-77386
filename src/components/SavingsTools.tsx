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
import { useEffect, useMemo, useState } from "react";
import comparisonData from "../data/local-grocery-comparisons.json";
import {
  readGroceryWatchlist,
  readPriceAlerts,
  readReminderIds,
  toggleStoredId,
  writeGroceryWatchlist,
  writePriceAlerts
} from "../lib/storage";
import type {
  GroceryWatchItem,
  GroceryWatchlistSnapshot,
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

const comparisonCatalog = comparisonData as {
  checkedOn: string;
  comparisons: LocalGroceryComparison[];
};
const comparisons = comparisonCatalog.comparisons;

const WATCH_TARGETS: Record<string, number> = {
  "ground-beef-80-20": 5,
  "roma-tomatoes": 1,
  "whole-milk-gallon": 3,
  "walmart-local-rollbacks": 1.75
};

function selectWatchPrice(comparison: LocalGroceryComparison) {
  const available = comparison.prices.filter(
    (entry) => entry.unitPrice !== null && entry.status !== "unavailable"
  );
  const locallyVerified = available.filter(
    (entry) => entry.status === "verified-local"
  );
  const eligible = locallyVerified.length > 0 ? locallyVerified : available;
  return [...eligible].sort(
    (first, second) => (first.unitPrice ?? Infinity) - (second.unitPrice ?? Infinity)
  )[0];
}

const DEFAULT_GROCERY_WATCHLIST: GroceryWatchItem[] = comparisons.flatMap(
  (comparison) => {
    const selected = selectWatchPrice(comparison);
    if (!selected) return [];
    return [
      {
        id: `watch-${comparison.id}`,
        item: comparison.item,
        comparisonId: comparison.id,
        targetPrice: WATCH_TARGETS[comparison.id] ?? selected.unitPrice ?? 0,
        latestPrice: selected.unitPrice,
        unit: `per ${selected.unit}`,
        retailer: selected.retailer,
        sourceLabel: `${selected.retailer} official listing`,
        sourceUrl: selected.sourceUrl,
        checkedOn: comparisonCatalog.checkedOn,
        locationStatus: selected.status
      }
    ];
  }
);

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

function mergeWatchlistSnapshot(
  current: GroceryWatchItem[],
  snapshot: GroceryWatchlistSnapshot
): GroceryWatchItem[] {
  const refreshed = new Map(snapshot.items.map((item) => [item.id, item]));
  return current.map((item) => {
    const update = refreshed.get(item.id);
    return update
      ? {
          ...item,
          latestPrice: update.latestPrice,
          retailer: update.retailer,
          sourceLabel: update.sourceLabel,
          sourceUrl: update.sourceUrl,
          checkedOn: update.checkedOn,
          locationStatus: update.locationStatus
        }
      : item;
  });
}

function GroceryWatchlist() {
  const [items, setItems] = useState<GroceryWatchItem[]>(() =>
    readGroceryWatchlist(DEFAULT_GROCERY_WATCHLIST)
  );
  const [itemName, setItemName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("per lb");

  useEffect(() => {
    if (typeof window.fetch !== "function") return;
    let active = true;

    window
      .fetch("/reports/grocery-watchlist.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<GroceryWatchlistSnapshot>;
      })
      .then((snapshot) => {
        if (!active) return;
        setItems((current) =>
          writeGroceryWatchlist(mergeWatchlistSnapshot(current, snapshot))
        );
      })
      .catch(() => {
        // The bundled official-source snapshot remains available offline.
      });

    return () => {
      active = false;
    };
  }, []);

  const matchedCount = items.filter(
    (item) =>
      item.latestPrice !== null && item.latestPrice <= item.targetPrice
  ).length;

  function updateItem(
    id: string,
    field: "targetPrice" | "latestPrice",
    value: string
  ) {
    const parsed = value === "" ? null : Math.max(0, Number(value));
    const next = items.map((item) =>
      item.id === id
        ? {
            ...item,
            [field]: field === "targetPrice" ? (parsed ?? 0) : parsed
          }
        : item
    );
    setItems(writeGroceryWatchlist(next));
  }

  function addItem() {
    const cleanItem = itemName.trim();
    const parsedTarget = Number(target);
    if (!cleanItem || !Number.isFinite(parsedTarget) || parsedTarget <= 0) return;

    const next = [
      ...items,
      {
        id: `grocery-custom-${Date.now()}`,
        item: cleanItem,
        targetPrice: parsedTarget,
        latestPrice: null,
        unit,
        sourceLabel: "Manual staple",
        locationStatus: "manual" as const,
        custom: true
      }
    ];
    setItems(writeGroceryWatchlist(next));
    setItemName("");
    setTarget("");
  }

  function removeItem(id: string) {
    setItems(writeGroceryWatchlist(items.filter((item) => item.id !== id)));
  }

  return (
    <section
      className="tool-card tool-card--wide grocery-watchlist"
      aria-labelledby="grocery-watchlist-title"
    >
      <div className="tool-card__heading grocery-watchlist__heading">
        <div className="tool-icon tool-icon--green">
          <BellRing size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Your weekly circular, upgraded</span>
          <h2 id="grocery-watchlist-title">Staples watchlist</h2>
        </div>
        <div className="watchlist-summary" aria-label="Watchlist status">
          <strong>{items.length}</strong>
          <span>watched</span>
          <strong>{matchedCount}</strong>
          <span>at target</span>
        </div>
      </div>
      <p className="tool-intro">
        Set the unit price worth acting on. Official comparison prices refresh
        from the public-source workflow; custom items and every target stay only
        in this browser.
      </p>

      <div className="grocery-watch-grid">
        {items.map((item) => {
          const matched =
            item.latestPrice !== null && item.latestPrice <= item.targetPrice;
          const locallyVerified = item.locationStatus === "verified-local";
          const state = matched
            ? locallyVerified || item.locationStatus === "manual"
              ? "Target met"
              : "Meets target; confirm locally"
            : "Watching";

          return (
            <article
              className={`grocery-watch-item ${matched ? "grocery-watch-item--matched" : ""}`}
              key={item.id}
            >
              <div className="grocery-watch-item__topline">
                <span className={`watch-state ${matched ? "watch-state--matched" : ""}`}>
                  {matched ? <BellRing size={14} /> : <Bell size={14} />}
                  {state}
                </span>
                <button
                  type="button"
                  className="remove-button"
                  aria-label={`Remove ${item.item} from staples watchlist`}
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
              <strong className="grocery-watch-item__name">{item.item}</strong>
              <div className="grocery-watch-item__prices">
                <label>
                  <span>Target unit price</span>
                  <input
                    aria-label={`${item.item} grocery target price`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.targetPrice}
                    onChange={(event) =>
                      updateItem(item.id, "targetPrice", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Latest unit price</span>
                  <input
                    aria-label={`${item.item} latest unit price`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.latestPrice ?? ""}
                    placeholder="—"
                    onChange={(event) =>
                      updateItem(item.id, "latestPrice", event.target.value)
                    }
                  />
                </label>
                <span className="grocery-watch-item__unit">{item.unit}</span>
              </div>
              <div className="grocery-watch-item__source">
                <span>
                  {item.retailer ? `${item.retailer} · ` : ""}
                  {item.locationStatus === "verified-local"
                    ? "Verified 77386"
                    : item.locationStatus === "official-needs-local-check"
                      ? "Not locally confirmed"
                      : item.locationStatus === "manual"
                        ? "Manual price"
                        : "Price unavailable"}
                </span>
                <small>
                  {item.checkedOn ? `Checked ${item.checkedOn}` : "Awaiting a public price"}
                </small>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    {item.sourceLabel} <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grocery-watch-adder">
        <label>
          <span>Staple to watch</span>
          <input
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="Rice, chicken breast, cereal…"
          />
        </label>
        <label>
          <span>Target unit price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          <span>Compare as</span>
          <select value={unit} onChange={(event) => setUnit(event.target.value)}>
            <option value="per lb">per lb</option>
            <option value="per oz">per oz</option>
            <option value="per gal">per gal</option>
            <option value="per item">per item</option>
            <option value="per package">per package</option>
          </select>
        </label>
        <button type="button" onClick={addItem}>
          <Plus size={16} aria-hidden="true" /> Add staple
        </button>
      </div>

      <div className="grocery-watchlist__privacy">
        <ShieldCheck size={14} aria-hidden="true" />
        Targets and custom staples stay in local browser storage. No retailer
        login, payment data, or private account information is used.
      </div>
    </section>
  );
}

export function GroceryComparisons() {
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
          winner is named. “Not locally confirmed” means the price is official but
          the public page did not bind it to a 77386 store.
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
                              : "Not locally confirmed"}
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

export function GroceryDashboard() {
  return (
    <>
      <section className="page-heading tools-heading">
        <span className="eyebrow">Current public retailer listings</span>
        <h1>Local grocery comparisons</h1>
        <p>
          A weekly circular on steroids: watch your staples, set the unit price
          worth buying, and compare Kroger, Walmart, H-E-B, and Aldi with source
          freshness and 77386 verification shown on every result.
        </p>
      </section>
      <div className="grocery-verification-banner">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Checked July 23, 2026</strong>
          <span>
            Only store-bound evidence earns “Verified 77386.” Official prices
            without local store context remain “Not locally confirmed.”
          </span>
        </div>
      </div>
      <div className="tools-grid">
        <GroceryWatchlist />
        <GroceryComparisons />
      </div>
    </>
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
