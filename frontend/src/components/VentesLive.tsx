import { VenteRecente } from "../api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VentesLive({ ventes }: { ventes: VenteRecente[] }) {
  return (
    <div className="panel">
      <h2>Activite recente</h2>
      <p className="panel-desc">
        Dernières ventes enregistrées. Stock mis à jour automatiquement.
      </p>
      <ul className="ventes-live-list">
        {ventes.length === 0 ? (
          <li className="ventes-live-empty">Aucune vente enregistrée récemment</li>
        ) : (
          ventes.map((v) => (
            <li key={v.id} className="ventes-live-item">
              <div className="ventes-live-main">
                <strong>{v.produit_nom}</strong>
                <span className="ventes-live-qte">x {v.quantite}</span>
              </div>
              <div className="ventes-live-meta">
                <time dateTime={v.date_vente}>{formatTime(v.date_vente)}</time>
                <span>Stock : {v.stock_restant}</span>
                <span>{v.tarif_ttc.toFixed(2)} EUR</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
