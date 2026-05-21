import { CommandeResume } from "../api";
import { RiskBadge } from "./RiskBadge";

export function CommandeResumeCard({ commande }: { commande: CommandeResume }) {
  const top = [...commande.lignes]
    .sort((a, b) => b.montant - a.montant)
    .slice(0, 8);

  if (commande.montant_total <= 0 && commande.lignes.length === 0) {
    return (
      <div className="panel commande-card">
        <h2>Commande fournisseur</h2>
        <p className="panel-desc">
          Aucune ligne à commander (stocks suffisants) ou calcul ML pas encore
          effectué.
        </p>
      </div>
    );
  }

  return (
    <div className="panel commande-card">
      <h2>Commande fournisseur</h2>
      <div className="commande-total">
        <span className="commande-montant">
          {commande.montant_total.toFixed(2)} EUR
        </span>
        <span
          className={`commande-seuil ${commande.seuil_atteint ? "ok" : "warn"}`}
        >
          Seuil {commande.seuil_fournisseur} EUR :{" "}
          {commande.seuil_atteint ? "atteint" : "ajuste (R min)"}
        </span>
      </div>
      <ul className="commande-top-list">
        {top.map((l) => (
          <li key={l.produit_id}>
            <span className="cmd-name">{l.produit_nom}</span>
            <span className="cmd-qte">{l.qte_commande} u.</span>
            <span className="cmd-montant">{l.montant.toFixed(2)} EUR</span>
            <RiskBadge risque={l.risque_rupture} />
          </li>
        ))}
      </ul>
      {commande.lignes.length > 8 && (
        <p className="panel-desc">
          + {commande.lignes.length - 8} autres lignes (onglet Commande)
        </p>
      )}
    </div>
  );
}
