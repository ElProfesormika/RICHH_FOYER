import { useMemo, useState } from "react";
import { Produit, StockOverview } from "../api";
import { RiskBadge } from "./RiskBadge";

export function StocksTable({
  produits,
  stocks,
  onUpdate,
  horizonJours = 14,
  filterLabel,
}: {
  produits: Produit[];
  stocks: StockOverview[];
  onUpdate: (id: number, stock: number) => Promise<void>;
  horizonJours?: number;
  /** Libellé du filtre risque actif (ex. « Urgent ») */
  filterLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const produitMap = useMemo(
    () => new Map(produits.map((p) => [p.id, p])),
    [produits]
  );

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
      .sort((a, b) => a.produit_nom.localeCompare(b.produit_nom));
  }, [stocks, search, produitMap]);

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
        {stocks.length} produit{stocks.length > 1 ? "s" : ""} dans ce filtre.
        Chaque modification recalcule la prévision ({horizonJours} j) et la
        commande en temps réel.
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
              <th>À commander</th>
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
                    <td>{s.demande_prevue_horizon.toFixed(0)}</td>
                    <td>{s.stock_securite.toFixed(0)}</td>
                    <td>
                      <RiskBadge risque={s.risque_rupture} />
                    </td>
                    <td>{s.qte_commande_suggeree}</td>
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
        </table>
      </div>
    </div>
  );
}
