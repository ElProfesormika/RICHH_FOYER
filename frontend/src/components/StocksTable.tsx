import { useMemo, useState } from "react";
import { Produit, StockOverview } from "../api";
import { RiskBadge } from "./RiskBadge";

export function StocksTable({
  produits,
  stocks,
  onUpdate,
  horizonJours = 14,
}: {
  produits: Produit[];
  stocks: StockOverview[];
  onUpdate: (id: number, stock: number) => Promise<void>;
  horizonJours?: number;
}) {
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const stockMap = useMemo(
    () => new Map(stocks.map((s) => [s.produit_id, s])),
    [stocks]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...produits]
      .filter((p) => !q || p.nom.toLowerCase().includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [produits, search]);

  const save = async (p: Produit) => {
    const raw = edit[p.id] ?? String(p.stock_actuel);
    const val = parseInt(raw, 10);
    if (Number.isNaN(val) || val < 0) return;
    setSaving(p.id);
    try {
      await onUpdate(p.id, val);
      setEdit((e) => {
        const next = { ...e };
        delete next[p.id];
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head-row">
        <h2>Ajustement manuel des stocks</h2>
        <input
          type="search"
          className="search-input"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <p className="panel-desc">
        Inventaire ou réception : chaque modification recalcule la prévision et la commande en temps réel.
      </p>
      <div className="panel-scroll" style={{ maxHeight: "50vh" }}>
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Stock</th>
              <th>Demande {horizonJours}j</th>
              <th>Risque</th>
              <th>À commander</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const s = stockMap.get(p.id);
              return (
                <tr key={p.id}>
                  <td>{p.nom}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={edit[p.id] ?? p.stock_actuel}
                      onChange={(e) =>
                        setEdit((x) => ({ ...x, [p.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td>{s?.demande_prevue_horizon.toFixed(0) ?? "—"}</td>
                  <td>
                    {s ? <RiskBadge risque={s.risque_rupture} /> : "—"}
                  </td>
                  <td>{s?.qte_commande_suggeree ?? 0}</td>
                  <td>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => save(p)}
                      disabled={saving === p.id}
                    >
                      {saving === p.id ? "…" : "OK"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
