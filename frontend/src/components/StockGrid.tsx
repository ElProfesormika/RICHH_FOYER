import { StockOverview } from "../api";
import { RiskBadge } from "./RiskBadge";

function stockPercent(item: StockOverview) {
  const besoin = item.demande_prevue_7j + item.stock_securite;
  if (besoin <= 0) return 100;
  return Math.min(100, Math.round((item.stock_actuel / besoin) * 100));
}

export function StockGrid({
  items,
  compact = false,
  title = "Vue stocks",
  emptyLabel = "Aucun produit",
}: {
  items: StockOverview[];
  compact?: boolean;
  title?: string;
  emptyLabel?: string;
}) {
  const list = compact ? items.slice(0, 12) : items;

  return (
    <div className="panel">
      <h2>{title}</h2>
      {!compact && (
        <p className="panel-desc">
          Couverture estimée sur 7 jours, mise à jour à chaque vente enregistrée.
        </p>
      )}
      {list.length === 0 ? (
        <p className="empty-label">{emptyLabel}</p>
      ) : (
        <div className="stock-grid">
          {list.map((item) => {
            const pct = stockPercent(item);
            const barClass =
              item.risque_rupture === "critique" ||
              item.risque_rupture === "eleve"
                ? "danger"
                : item.risque_rupture === "moyen"
                  ? "warning"
                  : "ok";
            return (
              <article
                key={item.produit_id}
                className={`stock-card stock-card-${barClass}`}
              >
                <div className="stock-card-head">
                  <span className="stock-card-name" title={item.produit_nom}>
                    {item.produit_nom}
                  </span>
                  <RiskBadge risque={item.risque_rupture} />
                </div>
                <div className="stock-card-qty">
                  <span className="stock-big">{item.stock_actuel}</span>
                  <span className="stock-unit">en stock</span>
                </div>
                <div className="stock-bar-track" aria-hidden>
                  <div
                    className={`stock-bar-fill ${barClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="stock-card-foot">
                  <span>{item.jours_couverture} j. couverture</span>
                  {item.qte_commande_suggeree > 0 && (
                    <span className="cmd-hint">
                      +{item.qte_commande_suggeree} à commander
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
