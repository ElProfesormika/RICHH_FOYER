import { StockOverview } from "../api";
import { RiskBadge } from "./RiskBadge";

function stockPercent(item: StockOverview) {
  const besoin = item.demande_prevue_horizon + item.stock_securite;
  if (besoin <= 0) return 100;
  return Math.min(100, Math.round((item.stock_actuel / besoin) * 100));
}

export function StockGrid({
  items,
  compact = false,
  title = "Vue stocks",
  emptyLabel = "Aucun produit",
  horizonJours = 14,
}: {
  items: StockOverview[];
  compact?: boolean;
  title?: string;
  emptyLabel?: string;
  horizonJours?: number;
}) {
  const list = compact ? items.slice(0, 12) : items;

  return (
    <div className="panel">
      <h2>{title}</h2>
      {!compact && (
        <p className="panel-desc">
          Couverture estimée sur {horizonJours} jours, mise à jour à chaque vente
          enregistrée.
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
                  <span
                    className={
                      item.qte_commande_suggeree > 0
                        ? "cmd-hint"
                        : "cmd-hint cmd-hint-zero"
                    }
                  >
                    {item.qte_commande_suggeree > 0
                      ? `+${item.qte_commande_suggeree} à commander`
                      : "Rien à commander"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
