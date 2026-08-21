import { BellRing, Check, ExternalLink } from "lucide-react";
import { formatDate, formatCurrency } from "../lib/scoring";
import type { ValueAlert, ValueAlertSettings } from "../types";

export function ValueAlerts({
  alerts,
  settings,
  onAcknowledge,
  onUpdateSettings
}: {
  alerts: ValueAlert[];
  settings: ValueAlertSettings;
  onAcknowledge: (id: string) => void;
  onUpdateSettings: (settings: ValueAlertSettings) => void;
}) {
  const alertValue = alerts.reduce(
    (total, alert) => total + Math.max(0, alert.estimatedSavings),
    0
  );

  return (
    <section className="tool-card tool-card--wide value-alerts" aria-labelledby="value-alerts-title">
      <div className="tool-card__heading">
        <div className="tool-icon tool-icon--orange">
          <BellRing size={20} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">Dashboard delivery</span>
          <h2 id="value-alerts-title">High-value alerts</h2>
        </div>
      </div>

      <div className="value-alert-summary">
        <div>
          <span>Ready</span>
          <strong>{alerts.length}</strong>
        </div>
        <div>
          <span>Listed value</span>
          <strong>{formatCurrency(alertValue)}</strong>
        </div>
      </div>

      <div className="value-alert-controls">
        <label>
          <span>Minimum dollar savings</span>
          <input
            aria-label="Minimum dollar savings"
            type="number"
            min="0"
            max="500"
            step="1"
            value={settings.minimumValue}
            onChange={(event) =>
              onUpdateSettings({
                ...settings,
                minimumValue: Number(event.target.value || 0)
              })
            }
          />
        </label>
        <label className="value-alert-toggle">
          <input
            type="checkbox"
            checked={settings.includeFreeRewards}
            onChange={(event) =>
              onUpdateSettings({
                ...settings,
                includeFreeRewards: event.target.checked
              })
            }
          />
          <span>Include free rewards</span>
        </label>
        <label>
          <span>Maximum effort</span>
          <select
            value={settings.maximumFriction}
            onChange={(event) =>
              onUpdateSettings({
                ...settings,
                maximumFriction: event.target.value as ValueAlertSettings["maximumFriction"]
              })
            }
          >
            <option value="low">Low only</option>
            <option value="medium">Medium or lower</option>
            <option value="any">Any effort</option>
          </select>
        </label>
      </div>

      {alerts.length > 0 ? (
        <ul className="value-alert-list">
          {alerts.slice(0, 8).map((alert) => (
            <li key={alert.id}>
              <div>
                <strong>{alert.merchant}</strong>
                <span>{alert.title}</span>
                <small>{alert.reason}</small>
              </div>
              <div className="value-alert-actions">
                {alert.expiresOn && (
                  <em>Ends {formatDate(alert.expiresOn)}</em>
                )}
                <a href={alert.sourceUrl} target="_blank" rel="noreferrer">
                  Open source <ExternalLink size={13} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onAcknowledge(alert.id)}
                  aria-label={`Dismiss ${alert.title}`}
                >
                  <Check size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="history-empty">No opportunities clear this threshold.</p>
      )}
    </section>
  );
}
