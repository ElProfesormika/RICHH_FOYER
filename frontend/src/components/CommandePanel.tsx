import { useMemo, useState } from "react";
import { CommandeResume } from "../api";
import { downloadCsv } from "../utils/exportCsv";
import { RiskBadge } from "./RiskBadge";

export function CommandePanel({ commande }: { commande: CommandeResume }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"montant" | "risque" | "nom">("montant");

  const dateStr = commande.date_calcul
    ? new Date(commande.date_calcul).toLocaleString("fr-FR")
    : "-";

  const lignes = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = commande.lignes.filter(
      (l) => !q || l.produit_nom.toLowerCase().includes(q)
    );
    const riskOrder: Record<string, number> = {
      critique: 0,
      eleve: 1,
      moyen: 2,
      faible: 3,
    };
    list = [...list].sort((a, b) => {
      if (sortBy === "montant") return b.montant - a.montant;
      if (sortBy === "risque")
        return (
          (riskOrder[a.risque_rupture] ?? 9) - (riskOrder[b.risque_rupture] ?? 9)
        );
      return a.produit_nom.localeCompare(b.produit_nom);
    });
    return list;
  }, [commande.lignes, search, sortBy]);

  const exportCsv = () => {
    downloadCsv(
      `commande-foyer-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Produit",
        "Stock",
        "Demande_7j",
        "Stock_securite",
        "Qte_commande",
        "Prix_achat",
        "Montant",
        "Risque",
      ],
      lignes.map((l) => [
        l.produit_nom,
        String(l.stock_actuel),
        l.demande_prevue.toFixed(1),
        l.stock_securite.toFixed(1),
        String(l.qte_commande),
        l.prix_achat.toFixed(2),
        l.montant.toFixed(2),
        l.risque_rupture,
      ])
    );
  };

  const totalLignes = commande.lignes.reduce((s, l) => s + l.qte_commande, 0);

  return (
    <div className="commande-page">
      <div className="commande-summary">
        <div className="panel">
          <h2>Résumé commande fournisseur</h2>
          <dl className="summary-dl">
            <div>
              <dt>Montant total</dt>
              <dd className="summary-highlight">
                {commande.montant_total.toFixed(2)} EUR
              </dd>
            </div>
            <div>
              <dt>Unités commandées</dt>
              <dd>{totalLignes}</dd>
            </div>
            <div>
              <dt>Seuil minimum</dt>
              <dd>{commande.seuil_fournisseur} EUR</dd>
            </div>
            <div>
              <dt>Statut seuil</dt>
              <dd>
                <span
                  className={`badge ${commande.seuil_atteint ? "badge-faible" : "badge-moyen"}`}
                >
                  {commande.seuil_atteint ? "Atteint" : "Ajusté (R min)"}
                </span>
              </dd>
            </div>
          </dl>
          <p className="summary-meta">Dernier calcul : {dateStr}</p>
        </div>
        <div className="panel formula-box">
          <h2>Règles de calcul</h2>
          <ul className="formula-list">
            <li>
              <strong>SS</strong> = z x sigma x racine(L), z = 1,65 (95 %)
            </li>
            <li>
              <strong>Q</strong> = D + SS - S sur 7 jours
            </li>
            <li>
              Si montant &lt; 400 EUR, application du ratio R_min
            </li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <h2>
            Lignes suggérées ({lignes.length}
            {search ? ` / ${commande.lignes.length}` : ""})
          </h2>
          <div className="toolbar">
            <input
              type="search"
              className="search-input"
              placeholder="Filtrer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select-sm"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "montant" | "risque" | "nom")
              }
            >
              <option value="montant">Tri : montant</option>
              <option value="risque">Tri : risque</option>
              <option value="nom">Tri : nom</option>
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={exportCsv}
              disabled={lignes.length === 0}
            >
              Exporter CSV
            </button>
          </div>
        </div>
        <div className="panel-scroll table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Stock</th>
                <th>Demande 7j</th>
                <th>Stock secu.</th>
                <th>Qte</th>
                <th>P.U.</th>
                <th>Montant</th>
                <th>Risque</th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    Aucune ligne. Lancez le recalcul ML depuis le menu.
                  </td>
                </tr>
              ) : (
                lignes.map((l) => (
                  <tr key={l.produit_id}>
                    <td>{l.produit_nom}</td>
                    <td>{l.stock_actuel}</td>
                    <td>{l.demande_prevue.toFixed(1)}</td>
                    <td>{l.stock_securite.toFixed(1)}</td>
                    <td className="cell-strong">{l.qte_commande}</td>
                    <td>{l.prix_achat.toFixed(2)} EUR</td>
                    <td>{l.montant.toFixed(2)} EUR</td>
                    <td>
                      <RiskBadge risque={l.risque_rupture} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
