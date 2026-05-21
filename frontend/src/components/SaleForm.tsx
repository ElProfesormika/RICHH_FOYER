import { FormEvent, useMemo, useState } from "react";
import { api, Produit } from "../api";

export function SaleForm({
  produits,
  onSale,
}: {
  produits: Produit[];
  onSale: () => void;
}) {
  const [search, setSearch] = useState("");
  const [produitId, setProduitId] = useState<number | "">("");
  const [qte, setQte] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...produits]
      .filter((p) => !q || p.nom.toLowerCase().includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .slice(0, 50);
  }, [produits, search]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (produitId === "") return;
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.enregistrerVente(Number(produitId), qte);
      setMsg({
        type: "ok",
        text: `${r.produit_nom} : ${r.quantite} vendu(s). Stock restant : ${r.stock_actuel}`,
      });
      setProduitId("");
      setSearch("");
      setQte(1);
      onSale();
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setLoading(false);
    }
  };

  const selected = produits.find((p) => p.id === produitId);
  const stockOk = selected ? selected.stock_actuel >= qte : true;

  return (
    <div className="panel sale-form">
      <h2>Enregistrer une vente</h2>
      <p className="panel-desc">
        Chaque vente recalcule la prévision et la commande suggérée en temps réel.
      </p>
      <form onSubmit={submit} className="sale-form-stack">
        <label>
          Rechercher un produit
          <input
            type="search"
            className="search-input full-width"
            placeholder="Nom du produit..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setProduitId("");
            }}
          />
        </label>
        <label>
          Produit
          <select
            className="full-width"
            value={produitId}
            onChange={(e) =>
              setProduitId(e.target.value ? Number(e.target.value) : "")
            }
            required
            size={Math.min(6, Math.max(3, filtered.length))}
          >
            <option value="">-- Selectionner --</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id} disabled={p.stock_actuel <= 0}>
                {p.nom} ({p.stock_actuel} en stock)
              </option>
            ))}
          </select>
        </label>
        <div className="sale-form-row">
          <label>
            Quantité
            <input
              type="number"
              min={1}
              max={selected?.stock_actuel ?? 999}
              value={qte}
              onChange={(e) => setQte(Number(e.target.value))}
              disabled={!selected}
            />
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || produitId === "" || !stockOk}
          >
            {loading ? "En cours..." : "Valider"}
          </button>
        </div>
      </form>
      {selected && (
        <dl className="sale-details">
          <div>
            <dt>Prix TTC</dt>
            <dd>{selected.prix_vente_ttc.toFixed(2)} EUR</dd>
          </div>
          <div>
            <dt>Stock après vente</dt>
            <dd className={!stockOk ? "text-danger" : ""}>
              {Math.max(0, selected.stock_actuel - qte)} unités
            </dd>
          </div>
        </dl>
      )}
      {msg && <p className={`sale-msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
