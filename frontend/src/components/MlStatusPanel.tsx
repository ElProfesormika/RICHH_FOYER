import { ConfigMetier, DashboardKPI, MlStatus } from "../api";

function formatDt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MlStatusPanel({
  ml,
  kpi,
  config,
}: {
  ml: MlStatus | null;
  kpi: DashboardKPI | null;
  config: ConfigMetier | null;
}) {
  const pret = ml?.pret ?? kpi?.ml_pret ?? false;
  const montant =
    ml?.montant_commande_eur ?? kpi?.montant_commande_suggeree ?? 0;
  const lignes = ml?.lignes_commande ?? kpi?.lignes_commande ?? 0;
  const seuil = ml?.seuil_fournisseur_eur ?? config?.seuil_fournisseur_eur ?? 400;
  const seuilOk = ml?.seuil_atteint ?? kpi?.seuil_atteint ?? false;
  const horizon = ml?.horizon_jours ?? config?.horizon_jours ?? 14;
  const z = config?.z_service ?? 1.65;
  const lead = config?.lead_time_jours ?? 3;

  return (
    <div className="panel ml-status-panel">
      <div className="panel-head-row">
        <h2>Moteur de prévision (XGBoost)</h2>
        <span className={`ml-badge ${pret ? "ml-badge-ok" : "ml-badge-warn"}`}>
          {pret ? "Actif" : "En attente"}
        </span>
      </div>
      <p className="panel-desc">
        Mode <strong>automatique</strong> : chaque vente ou ajustement de stock
        relance la prévision du produit et met à jour la commande fournisseur.
      </p>

      <div className="ml-status-grid">
        <div className="ml-stat">
          <span className="ml-stat-label">Commande suggérée</span>
          <span className="ml-stat-value">
            {pret ? `${montant.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—"}
          </span>
          <span className="ml-stat-sub">
            {lignes} ligne{lignes > 1 ? "s" : ""} · seuil {seuil} €{" "}
            {seuilOk ? "(atteint)" : "(R min appliqué)"}
          </span>
        </div>
        <div className="ml-stat">
          <span className="ml-stat-label">Dernier calcul</span>
          <span className="ml-stat-value small">
            {formatDt(ml?.date_dernier_calcul_commande ?? kpi?.date_dernier_calcul_ml)}
          </span>
          <span className="ml-stat-sub">
            {kpi?.produits_avec_prevision ?? ml?.produits_avec_prevision ?? 0} produits
            avec prévision
          </span>
        </div>
        <div className="ml-stat">
          <span className="ml-stat-label">Horizon / formules</span>
          <span className="ml-stat-value small">{horizon} jours</span>
          <span className="ml-stat-sub">
            SS = {z} × σ × √{lead} · Q = D + SS − S
          </span>
        </div>
      </div>
    </div>
  );
}
