import { useMemo, useState } from "react";
import { CommandeResume, Produit, StockOverview } from "../api";
import { RiskBadge } from "./RiskBadge";

type LigneCommandeLookup = {
  qte: number;
  demande: number;
  stockSecu: number;
  besoin: number;
};

export function StocksTable({
  produits,
  stocks,
  commande,
  onUpdate,
  horizonJours = 14,
  filterLabel,
}: {
  produits: Produit[];
  stocks: StockOverview[];
  /** Même source que l'onglet Commande (prévision 14j + qté). */
  commande: CommandeResume | null;
  onUpdate: (id: number, stock: number) => Promise<void>;
  horizonJours?: number;
  filterLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const produitMap = useMemo(
    () => new Map(produits.map((p) => [p.id, p])),
    [produits]
  );

  const commandeMap = useMemo(() => {
    const m = new Map<number, LigneCommandeLookup>();
    for (const l of commande?.lignes ?? []) {
      m.set(l.produit_id, {
        qte: l.qte_commande,
        demande: l.demande_prevue,
        stockSecu: l.stock_securite,
        besoin: l.besoin_total ?? l.demande_prevue + l.stock_securite,
      });
    }
    return m;
  }, [commande]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...stocks]
      .filter(
        (s) =>
          !q ||
          s.produit_nom.toLowerCase().includes(q) ||
          (produitMap.get(s.produit_id)?.code_article ?? "")
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => {
        const qa =
          commandeMap.get(a.produit_id)?.qte ?? a.qte_commande_suggeree ?? 0;
        const qb =
          commandeMap.get(b.produit_id)?.qte ?? b.qte_commande_suggeree ?? 0;
        if (qb !== qa) return qb - qa;
        return a.produit_nom.localeCompare(b.produit_nom);
      });
  }, [stocks, search, produitMap, commandeMap]);

  const totaux = useMemo(() => {
    let qteTotal = 0;
    let avecPrevision = 0;
    let aCommander = 0;
    for (const s of filtered) {
      const cmd = commandeMap.get(s.produit_id);
      if (cmd) avecPrevision += 1;
      const qte = cmd?.qte ?? s.qte_commande_suggeree ?? 0;
      qteTotal += qte;
      if (qte > 0) aCommander += 1;
    }
    return { qteTotal, avecPrevision, aCommander };
  }, [filtered, commandeMap]);

  const save = async (produitId: number) => {
    const p = produitMap.get(produitId);
    if (!p) return;
    const raw = edit[produitId] ?? String(p.stock_actuel);
    const val = parseInt(raw, 10);
    if (Number.isNaN(val) || val < 0) return;
    setSaving(produitId);
    try {
      await onUpdate(produitId, val);
      setEdit((e) => {
        const next = { ...e };
        delete next[produitId];
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head-row">
        <h2>
          Ajustement manuel
          {filterLabel ? ` — ${filterLabel}` : ""}
        </h2>
        <input
          type="search"
          className="search-input"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <p className="panel-desc">
        {stocks.length} produit{stocks.length > 1 ? "s" : ""} dans ce filtre ·{" "}
        {totaux.avecPrevision} avec prévision {horizonJours} j ·{" "}
        <strong>{totaux.aCommander}</strong> à commander (
        <strong>{totaux.qteTotal}</strong> unités). Colonne « À commander » =
        onglet Commande (Q = D + SS − S).
      </p>
      <div className="panel-scroll" style={{ maxHeight: "50vh" }}>
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Stock</th>
              <th>Demande {horizonJours}j</th>
              <th>Stock secu.</th>
              <th>Risque</th>
              <th title={`Q = max(0, demande ${horizonJours}j + stock sécu. − stock)`}>
                À commander
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  Aucun produit pour ce filtre
                  {search ? " et cette recherche" : ""}.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const p = produitMap.get(s.produit_id);
                const cmd = commandeMap.get(s.produit_id);
                const demande = cmd?.demande ?? s.demande_prevue_horizon;
                const stockSecu = cmd?.stockSecu ?? s.stock_securite;
                const qte = cmd?.qte ?? s.qte_commande_suggeree ?? 0;
                const sansPrevision =
                  !cmd &&
                  s.demande_prevue_horizon <= 0 &&
                  s.stock_securite <= 0;

                return (
                  <tr key={s.produit_id}>
                    <td>{s.produit_nom}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={edit[s.produit_id] ?? p?.stock_actuel ?? s.stock_actuel}
                        onChange={(e) =>
                          setEdit((x) => ({
                            ...x,
                            [s.produit_id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      {sansPrevision ? "—" : demande.toFixed(0)}
                    </td>
                    <td>
                      {sansPrevision ? "—" : stockSecu.toFixed(0)}
                    </td>
                    <td>
                      <RiskBadge risque={s.risque_rupture} />
                    </td>
                    <td
                      className={
                        qte > 0
                          ? "cell-cmd-qte"
                          : sansPrevision
                            ? "cell-cmd-na"
                            : "cell-cmd-zero"
                      }
                      title={
                        sansPrevision
                          ? "Pas de prévision sur 14 j"
                          : qte > 0
                            ? `Besoin ${(cmd?.besoin ?? demande + stockSecu).toFixed(0)} u. · Q = max(0, D + SS − S)`
                            : `Stock couvre le besoin sur ${horizonJours} j (qté = 0)`
                      }
                    >
                      {sansPrevision ? "n/d" : qte > 0 ? qte : "0"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => save(s.produit_id)}
                        disabled={saving === s.produit_id || !p}
                      >
                        {saving === s.produit_id ? "…" : "Enregistrer"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="stocks-table-tfoot">
                <td colSpan={5}>
                  <strong>Total à commander</strong> ({totaux.aCommander}{" "}
                  produit{totaux.aCommander > 1 ? "s" : ""})
                </td>
                <td className="cell-cmd-qte">{totaux.qteTotal}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
