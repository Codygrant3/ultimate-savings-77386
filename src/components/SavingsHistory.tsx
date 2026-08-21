import { Plus, Trash2, TrendingDown } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "../lib/scoring";
import type { Category, Opportunity, ReceiptEntry } from "../types";

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: "grocery", label: "Grocery" },
  { value: "restaurants", label: "Food" },
  { value: "coffee", label: "Coffee" },
  { value: "fuel", label: "Fuel" },
  { value: "convenience", label: "Convenience" },
  { value: "auto", label: "Auto care" },
  { value: "movies", label: "Movies" },
  { value: "sports", label: "Sports" },
  { value: "tax-free", label: "Tax-free" },
  { value: "shopping", label: "Shopping" }
];

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `receipt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SavingsHistory({
  opportunities,
  receipts,
  onAdd,
  onDelete
}: {
  opportunities: Opportunity[];
  receipts: ReceiptEntry[];
  onAdd: (entry: ReceiptEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [occurredOn, setOccurredOn] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<Category>("grocery");
  const [amountSpent, setAmountSpent] = useState("");
  const [actualSavings, setActualSavings] = useState("");
  const [opportunityId, setOpportunityId] = useState("");

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const confirmedTotal = receipts.reduce(
    (total, receipt) => total + Math.max(0, receipt.actualSavings),
    0
  );
  const monthTotal = receipts
    .filter((receipt) => receipt.occurredOn.startsWith(monthPrefix))
    .reduce((total, receipt) => total + Math.max(0, receipt.actualSavings), 0);
  const recentReceipts = [...receipts]
    .sort((first, second) => second.occurredOn.localeCompare(first.occurredOn))
    .slice(0, 8);
  const canSave = Boolean(merchant.trim()) && actualSavings !== "";

  function addReceipt() {
    const cleanMerchant = merchant.trim();
    const spent = Number(amountSpent || 0);
    const saved = Number(actualSavings);
    if (!cleanMerchant || !occurredOn || !Number.isFinite(saved) || saved < 0) {
      return;
    }
    if (!Number.isFinite(spent) || spent < 0) return;

    const linked = opportunities.find((item) => item.id === opportunityId);
    onAdd({
      id: createId(),
      opportunityId: linked?.id,
      merchant: cleanMerchant,
      category,
      occurredOn,
      amountSpent: spent,
      actualSavings: saved,
      listedValue: linked?.estimatedSavings
    });
    setMerchant("");
    setAmountSpent("");
    setActualSavings("");
    setOpportunityId("");
  }

  return (
    <section
      className="tool-card tool-card--wide savings-history"
      aria-labelledby="savings-history-title"
    >
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--green">
          <TrendingDown size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Confirmed results</span>
          <h2 id="savings-history-title">Savings history</h2>
        </div>
      </div>

      <div className="history-summary">
        <div>
          <span>Confirmed</span>
          <strong>{formatCurrency(confirmedTotal)}</strong>
        </div>
        <div>
          <span>This month</span>
          <strong>{formatCurrency(monthTotal)}</strong>
        </div>
        <div>
          <span>Entries</span>
          <strong>{receipts.length}</strong>
        </div>
      </div>

      <div className="history-form">
        <label>
          <span>Date</span>
          <input
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </label>
        <label>
          <span>Merchant</span>
          <input
            value={merchant}
            placeholder="H-E-B"
            onChange={(event) => setMerchant(event.target.value)}
          />
        </label>
        <label>
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount spent</span>
          <input
            aria-label="Amount spent"
            type="number"
            min="0"
            step="0.01"
            value={amountSpent}
            onChange={(event) => setAmountSpent(event.target.value)}
          />
        </label>
        <label>
          <span>Actual savings</span>
          <input
            aria-label="Actual savings"
            type="number"
            min="0"
            step="0.01"
            value={actualSavings}
            onChange={(event) => setActualSavings(event.target.value)}
          />
        </label>
        <label>
          <span>Linked offer</span>
          <select
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.target.value)}
          >
            <option value="">None</option>
            {opportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>
                {opportunity.merchant}: {opportunity.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addReceipt} disabled={!canSave}>
          <Plus size={16} aria-hidden="true" /> Log savings
        </button>
      </div>

      {recentReceipts.length > 0 ? (
        <ul className="history-list">
          {recentReceipts.map((receipt) => (
            <li key={receipt.id}>
              <div>
                <strong>{receipt.merchant}</strong>
                <span>
                  {receipt.occurredOn} · {formatCurrency(receipt.amountSpent)} spent ·{" "}
                  {formatCurrency(receipt.actualSavings)} saved
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => onDelete(receipt.id)}
                aria-label={`Delete ${receipt.merchant} savings entry`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="history-empty">No confirmed entries yet.</p>
      )}
    </section>
  );
}
