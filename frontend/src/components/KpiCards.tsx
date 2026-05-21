import { DashboardKPI } from "../api";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export function KpiCards({ kpi }: { kpi: DashboardKPI }) {
  const cards = [
    {
      label: "Ventes aujourd'hui",
      value: String(kpi.ventes_aujourdhui),
      highlight: true,
    },
    { label: "Alertes stock", value: String(kpi.alertes_stock), alert: kpi.alertes_stock > 0 },
    { label: "Produits", value: String(kpi.total_produits) },
    {
      label: "Commande suggérée",
      value: `${kpi.montant_commande_suggeree.toFixed(0)} €`,
      ok: kpi.seuil_atteint,
    },
    {
      label: "Historique",
      value: `${kpi.total_ventes.toLocaleString("fr-FR")} ventes`,
      sub: `${formatDate(kpi.periode_debut)} → ${formatDate(kpi.periode_fin)}`,
      small: true,
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`kpi-card ${c.highlight ? "highlight" : ""} ${c.ok ? "ok" : ""} ${c.alert ? "alert" : ""}`}
        >
          <span className="kpi-label">{c.label}</span>
          <span className={`kpi-value ${c.small ? "small" : ""}`}>{c.value}</span>
          {c.sub && <span className="kpi-sub">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}
