import { useMemo, useState } from "react";
import { CommandeResume } from "../api";
import { exportCommandeCsv } from "../utils/exportCommandeCsv";
import { exportCommandePdf } from "../utils/exportCommandePdf";
import { IconDownload } from "./Icons";
import { RiskBadge } from "./RiskBadge";

export function CommandePanel({
  commande,
  horizonJours = 14,
  zService = 1.65,
  leadTimeJours = 3,
}: {
  commande: CommandeResume;
  horizonJours?: number;
  zService?: number;
  leadTimeJours?: number;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"montant" | "risque" | "nom" | "qte">(
    "montant"
  );
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const dateStr = commande.date_calcul
    ? new Date(commande.date_calcul).toLocaleString("fr-FR")
    : "—";

  const nbLignes = commande.nb_lignes ?? commande.lignes.length;
  const nbUnites =
    commande.nb_unites_total ??
    commande.lignes.reduce((s, l) => s + l.qte_commande, 0);
  const ref = commande.reference_commande ?? "—";

  const lignesFiltrees = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = commande.lignes.filter(
      (l) =>
        !q ||
        l.produit_nom.toLowerCase().includes(q) ||
        (l.code_article ?? "").toLowerCase().includes(q)
    );
    const riskOrder: Record<string, number> = {
      critique: 0,
      eleve: 1,
      moyen: 2,
      faible: 3,
    };
    list = [...list].sort((a, b) => {
      if (sortBy === "montant") return b.montant - a.montant;
      if (sortBy === "qte") return b.qte_commande - a.qte_commande;
      if (sortBy === "risque")
        return (
          (riskOrder[a.risque_rupture] ?? 9) - (riskOrder[b.risque_rupture] ?? 9)
        );
      return a.produit_nom.localeCompare(b.produit_nom);
    });
    return list;
  }, [commande.lignes, search, sortBy]);

  const totauxFiltre = useMemo(
    () => ({
      unites: lignesFiltrees.reduce((s, l) => s + l.qte_commande, 0),
      montant: lignesFiltrees.reduce((s, l) => s + l.montant, 0),
    }),
    [lignesFiltrees]
  );

  const prixMoyen =
    nbUnites > 0 ? commande.montant_total / nbUnites : 0;

  const handleCsv = () => {
    setExporting("csv");
    try {
      exportCommandeCsv(commande, horizonJours);
    } finally {
      setExporting(null);
    }
  };

  const handlePdf = () => {
    setExporting("pdf");
    try {
      exportCommandePdf(commande, horizonJours);
    } finally {
      setExporting(null);
    }
  };

  const fmtEur = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="commande-page">
      <div className="commande-header panel">
        <div className="commande-brand">
          <span className="commande-brand-name">Foyer_UTT</span>
          <span className="commande-brand-sub">Commande fournisseur suggérée</span>
        </div>
        <div className="commande-header-meta">
          <span>
            <strong>Réf.</strong> {ref}
          </span>
          <span>
            <strong>Calcul</strong> {dateStr}
          </span>
        </div>
        <div className="commande-export-actions">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={handleCsv}
            disabled={commande.lignes.length === 0 || exporting !== null}
          >
            <IconDownload className="btn-icon" />
            {exporting === "csv" ? "Export…" : "Exporter CSV"}
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={handlePdf}
            disabled={commande.lignes.length === 0 || exporting !== null}
          >
            <IconDownload className="btn-icon" />
            {exporting === "pdf" ? "Génération…" : "Facture PDF"}
          </button>
        </div>
      </div>

      <div className="commande-kpi-strip">
        <div className="commande-kpi">
          <span className="commande-kpi-label">Montant total HT</span>
          <span className="commande-kpi-value accent">
            {fmtEur(commande.montant_total)} €
          </span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Produits à commander</span>
          <span className="commande-kpi-value">{nbLignes}</span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Unités totales</span>
          <span className="commande-kpi-value">{nbUnites}</span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Prix moyen / unité</span>
          <span className="commande-kpi-value">{fmtEur(prixMoyen)} €</span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Seuil fournisseur</span>
          <span
            className={`commande-kpi-value ${commande.seuil_atteint ? "ok" : "warn"}`}
          >
            {commande.seuil_fournisseur} €
            <small>
              {commande.seuil_atteint ? " atteint" : " · R min"}
            </small>
          </span>
        </div>
      </div>

      <div className="commande-summary">
        <div className="panel">
          <h2>Détail du calcul</h2>
          <dl className="summary-dl">
            <div>
              <dt>Formule quantité</dt>
              <dd>Q = max(0, D + SS − S)</dd>
            </div>
            <div>
              <dt>Demande D</dt>
              <dd>Prévision sur {horizonJours} jours</dd>
            </div>
            <div>
              <dt>Stock de sécurité</dt>
              <dd>
                SS = {zService} × σ × √{leadTimeJours}
              </dd>
            </div>
            <div>
              <dt>Stock S</dt>
              <dd>
                Stock actuel ; ajusté si stock Metro ≫ besoin
              </dd>
            </div>
          </dl>
          <p className="summary-meta">
            Les exports CSV et PDF incluent toutes les lignes ({nbLignes}), avec
            codes article, prix achat/vente et modèle de prévision.
          </p>
        </div>
        <div className="panel formula-box">
          <h2>Règles métier</h2>
          <ul className="formula-list">
            <li>
              Si le montant &lt; {commande.seuil_fournisseur} €, application du
              ratio <strong>R_min</strong> sur les quantités.
            </li>
            <li>
              <strong>XGBoost</strong> lorsque l'historique est suffisant ; sinon
              moyenne mobile.
            </li>
            <li>
              Colonne <strong>Stock cmd.</strong> = stock utilisé dans la formule Q.
            </li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <h2>
            Lignes de commande ({lignesFiltrees.length}
            {search ? ` / ${commande.lignes.length}` : ""})
          </h2>
          <div className="toolbar">
            <input
              type="search"
              className="search-input"
              placeholder="Produit ou réf. Metro…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select-sm"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "montant" | "risque" | "nom" | "qte")
              }
            >
              <option value="montant">Tri : montant</option>
              <option value="qte">Tri : quantité</option>
              <option value="risque">Tri : risque</option>
              <option value="nom">Tri : nom</option>
            </select>
          </div>
        </div>
        <div className="panel-scroll table-wrap commande-table-wrap">
          <table className="commande-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Produit</th>
                <th>Stock</th>
                <th>Stock cmd.</th>
                <th>D {horizonJours}j</th>
                <th>SS</th>
                <th>Besoin</th>
                <th>Qté</th>
                <th>P.U. achat</th>
                <th>P.V. TTC</th>
                <th>Montant</th>
                <th>Prévision</th>
                <th>Risque</th>
              </tr>
            </thead>
            <tbody>
              {lignesFiltrees.length === 0 ? (
                <tr>
                  <td colSpan={13} className="empty-cell">
                    Aucune ligne pour ce filtre.
                  </td>
                </tr>
              ) : (
                lignesFiltrees.map((l) => {
                  const besoin =
                    l.besoin_total ?? l.demande_prevue + l.stock_securite;
                  return (
                    <tr key={l.produit_id}>
                      <td className="cell-ref">{l.code_article ?? "—"}</td>
                      <td className="cell-produit">{l.produit_nom}</td>
                      <td>{l.stock_actuel}</td>
                      <td>{l.stock_commande ?? l.stock_actuel}</td>
                      <td>{l.demande_prevue.toFixed(1)}</td>
                      <td>{l.stock_securite.toFixed(1)}</td>
                      <td>{besoin.toFixed(1)}</td>
                      <td className="cell-strong">{l.qte_commande}</td>
                      <td>{fmtEur(l.prix_achat)} €</td>
                      <td>{fmtEur(l.prix_vente_ttc ?? 0)} €</td>
                      <td className="cell-montant">{fmtEur(l.montant)} €</td>
                      <td>
                        <span
                          className={`modele-tag ${
                            l.modele_prevision === "xgboost"
                              ? "modele-xgb"
                              : "modele-fb"
                          }`}
                          title={
                            l.mae != null
                              ? `MAE = ${l.mae.toFixed(2)}`
                              : "Moyenne mobile"
                          }
                        >
                          {l.modele_prevision === "xgboost" ? "XGB" : "Moy."}
                        </span>
                      </td>
                      <td>
                        <RiskBadge risque={l.risque_rupture} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {lignesFiltrees.length > 0 && (
              <tfoot>
                <tr className="commande-tfoot">
                  <td colSpan={7}>
                    {search
                      ? `Sous-total filtre (${lignesFiltrees.length} lignes)`
                      : "Total commande"}
                  </td>
                  <td className="cell-strong">{totauxFiltre.unites}</td>
                  <td colSpan={2} />
                  <td className="cell-montant cell-strong">
                    {search
                      ? `${fmtEur(totauxFiltre.montant)} €`
                      : `${fmtEur(commande.montant_total)} €`}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {search && (
          <p className="table-footnote">
            Montant global commande : {fmtEur(commande.montant_total)} € ({nbUnites}{" "}
            unités sur {nbLignes} produits).
          </p>
        )}
      </div>
    </div>
  );
}
