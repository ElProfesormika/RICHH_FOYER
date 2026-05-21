import { useMemo, useState } from "react";
import { CommandeResume } from "../api";
import { commandeTotaux, fmtEur, lignesExportCommande } from "../utils/commandeTotals";
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
  const [sortBy, setSortBy] = useState<"montant" | "nom" | "qte">("montant");
  const [showTechnique, setShowTechnique] = useState(false);
  const [onlyACommander, setOnlyACommander] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const t = commandeTotaux(commande);
  const dateStr = commande.date_calcul
    ? new Date(commande.date_calcul).toLocaleString("fr-FR")
    : "—";
  const ref = commande.reference_commande ?? "—";

  const lignesFiltrees = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = commande.lignes.filter((l) => {
      if (onlyACommander && l.qte_commande <= 0) return false;
      return (
        !q ||
        l.produit_nom.toLowerCase().includes(q) ||
        (l.code_article ?? "").toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "montant") return b.montant - a.montant;
      if (sortBy === "qte") return b.qte_commande - a.qte_commande;
      return a.produit_nom.localeCompare(b.produit_nom);
    });
    return list;
  }, [commande.lignes, search, sortBy, onlyACommander]);

  const lignesBon = useMemo(
    () => lignesExportCommande(lignesFiltrees),
    [lignesFiltrees]
  );

  const totauxFiltre = useMemo(
    () => ({
      unites: lignesFiltrees.reduce((s, l) => s + l.qte_commande, 0),
      montant: lignesFiltrees.reduce((s, l) => s + l.montant, 0),
      prevision: lignesFiltrees.reduce((s, l) => s + l.demande_prevue, 0),
    }),
    [lignesFiltrees]
  );

  const prixMoyen = t.nbUnites > 0 ? t.montantTotal / t.nbUnites : 0;

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

  return (
    <div className="commande-page">
      <div className="commande-header panel">
        <div className="commande-brand">
          <span className="commande-brand-name">Foyer_UTT</span>
          <span className="commande-brand-sub">
            Commande consolidée — cumul prévisions {horizonJours} jours
          </span>
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
          <span className="commande-kpi-value accent">{fmtEur(t.montantTotal)} €</span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Prévision cumulée {horizonJours}j</span>
          <span className="commande-kpi-value">
            {Math.round(t.demandeCumul14j)} u.
          </span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Qté à commander</span>
          <span className="commande-kpi-value">{t.nbUnites} u.</span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Prévisions (tous produits)</span>
          <span className="commande-kpi-value">{t.nbProduitsPrevision}</span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">À commander (qté &gt; 0)</span>
          <span className="commande-kpi-value">{t.nbLignesACommander}</span>
        </div>
        <div className="commande-kpi">
          <span className="commande-kpi-label">Prix moyen / unité</span>
          <span className="commande-kpi-value">{fmtEur(prixMoyen)} €</span>
        </div>
      </div>

      <div className="panel commande-bon-panel">
        <div className="panel-head-row">
          <h2>
            Détail commande ({lignesBon.length}
            {search ? ` / ${commande.lignes.length}` : ""} produits)
          </h2>
          <div className="toolbar">
            <input
              type="search"
              className="search-input"
              placeholder="Filtrer par nom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select-sm"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "montant" | "nom" | "qte")
              }
            >
              <option value="montant">Tri : total</option>
              <option value="qte">Tri : quantité</option>
              <option value="nom">Tri : nom</option>
            </select>
          </div>
        </div>
        <p className="panel-desc">
          <strong>{t.nbProduitsPrevision}</strong> produits avec prévision cumulée{" "}
          {horizonJours} j — dont <strong>{t.nbLignesACommander}</strong> à commander
          (qté &gt; 0). Les autres lignes (stock suffisant) restent visibles pour le
          cumul des prévisions. CSV / PDF : toutes les lignes.
        </p>
        <label className="commande-filter-check">
          <input
            type="checkbox"
            checked={onlyACommander}
            onChange={(e) => setOnlyACommander(e.target.checked)}
          />
          Afficher uniquement les produits à commander (qté &gt; 0)
        </label>
        <div className="panel-scroll table-wrap commande-bon-table-wrap">
          <table className="commande-bon-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Nom du produit</th>
                <th>Prév. cumul {horizonJours}j</th>
                <th>Quantité</th>
                <th>Prix unitaire HT</th>
                <th>Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lignesBon.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    Aucune ligne à commander.
                  </td>
                </tr>
              ) : (
                lignesBon.map((l) => (
                  <tr
                    key={l.numero}
                    className={l.quantite <= 0 ? "ligne-sans-commande" : ""}
                  >
                    <td>{l.numero}</td>
                    <td className="cell-produit">
                      {l.nom}
                      {l.code ? (
                        <span className="cell-ref-inline">{l.code}</span>
                      ) : null}
                    </td>
                    <td>{Math.round(l.prevision14j)}</td>
                    <td className="cell-strong">{l.quantite}</td>
                    <td>{fmtEur(l.prixUnitaire)} €</td>
                    <td className="cell-montant">{fmtEur(l.total)} €</td>
                  </tr>
                ))
              )}
            </tbody>
            {lignesBon.length > 0 && (
              <tfoot>
                <tr className="commande-tfoot">
                  <td colSpan={2}>
                    {search ? "Sous-total filtre" : "TOTAL COMMANDE"}
                  </td>
                  <td>{Math.round(totauxFiltre.prevision)}</td>
                  <td className="cell-strong">{totauxFiltre.unites}</td>
                  <td />
                  <td className="cell-montant cell-strong">
                    {search
                      ? `${fmtEur(totauxFiltre.montant)} €`
                      : `${fmtEur(t.montantTotal)} €`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="panel">
        <button
          type="button"
          className="btn-secondary btn-sm commande-toggle-tech"
          onClick={() => setShowTechnique((v) => !v)}
        >
          {showTechnique ? "Masquer" : "Afficher"} le détail technique (stock, SS, risque)
        </button>
        {showTechnique && (
          <div className="commande-tech-section">
            <div className="commande-summary">
              <div className="formula-box">
                <h3>Calcul</h3>
                <ul className="formula-list">
                  <li>
                    <strong>D</strong> = cumul prévisions {horizonJours} j (XGBoost)
                  </li>
                  <li>
                    <strong>Q</strong> = max(0, D + SS − S) · SS = {zService} × σ × √
                    {leadTimeJours}
                  </li>
                  <li>
                    Besoin cumulé commande : {Math.round(t.besoinCumul14j)} unités
                  </li>
                </ul>
              </div>
            </div>
            <div className="panel-scroll table-wrap commande-table-wrap">
              <table className="commande-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Stock</th>
                    <th>D {horizonJours}j</th>
                    <th>SS</th>
                    <th>Qté</th>
                    <th>Risque</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesFiltrees.map((l) => (
                    <tr key={l.produit_id}>
                      <td className="cell-produit">{l.produit_nom}</td>
                      <td>{l.stock_actuel}</td>
                      <td>{l.demande_prevue.toFixed(1)}</td>
                      <td>{l.stock_securite.toFixed(1)}</td>
                      <td className="cell-strong">{l.qte_commande}</td>
                      <td>
                        <RiskBadge risque={l.risque_rupture} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
