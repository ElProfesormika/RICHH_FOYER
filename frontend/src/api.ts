/** En dev : http://127.0.0.1:8000/api via .env.development — sinon proxy /api */
const API =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

export interface DashboardKPI {
  total_produits: number;
  total_ventes: number;
  ventes_aujourdhui: number;
  jours_vente: number;
  periode_debut: string | null;
  periode_fin: string | null;
  montant_commande_suggeree: number;
  seuil_fournisseur: number;
  seuil_atteint: boolean;
  alertes_stock: number;
  horizon_jours: number;
}

export interface ConfigMetier {
  horizon_jours: number;
  z_service: number;
  lead_time_jours: number;
  seuil_fournisseur_eur: number;
  prix_achat_ratio: number;
  stock_init_jours: number;
  stock_plancher: number;
}

export interface VenteTrendPoint {
  jour: string;
  quantite: number;
}

export interface TopProduit {
  produit_nom: string;
  total_ventes: number;
}

export interface Prevision {
  produit_id: number;
  produit_nom: string;
  demande_prevue: number;
  stock_securite: number;
  stock_actuel: number;
  mae: number | null;
  risque_rupture: string;
  horizon_jours: number;
}

export interface StockOverview {
  produit_id: number;
  produit_nom: string;
  stock_actuel: number;
  prix_vente_ttc: number;
  demande_prevue_horizon: number;
  stock_securite: number;
  qte_commande_suggeree: number;
  risque_rupture: string;
  jours_couverture: number;
}

export interface VenteRecente {
  id: number;
  produit_nom: string;
  quantite: number;
  tarif_ttc: number;
  date_vente: string;
  stock_restant: number;
}

export interface VenteResponse {
  produit_id: number;
  produit_nom: string;
  quantite: number;
  stock_actuel: number;
  risque_rupture: string;
  date_vente: string;
}

export interface CommandeLigne {
  produit_id: number;
  produit_nom: string;
  stock_actuel: number;
  demande_prevue: number;
  stock_securite: number;
  qte_commande: number;
  prix_achat: number;
  montant: number;
  risque_rupture: string;
}

export interface CommandeResume {
  lignes: CommandeLigne[];
  montant_total: number;
  seuil_fournisseur: number;
  seuil_atteint: boolean;
  date_calcul: string | null;
}

export interface Produit {
  id: number;
  nom: string;
  code_article?: string | null;
  type_produit?: string | null;
  prix_vente_ttc: number;
  prix_achat: number;
  stock_actuel: number;
  delai_fournisseur_jours: number;
}

export interface HealthResponse {
  status: string;
  produits: number;
  data_ready: boolean;
  loading: boolean;
  error: string | null;
}

function formatApiError(status: number, body: string): string {
  try {
    const j = JSON.parse(body);
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map(String).join(", ");
  } catch {
    /* pas du JSON */
  }
  if (body.trim().startsWith("<")) {
    return `Erreur ${status} : le serveur a renvoyé du HTML (API probablement arrêtée). Lancez ./start-api.sh`;
  }
  return body.slice(0, 200) || `Erreur HTTP ${status}`;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error(
      "Impossible de joindre l'API. Lancez ./start-api.sh puis actualisez la page."
    );
  }

  const text = await res.text();

  if (!res.ok) {
    throw new Error(formatApiError(res.status, text));
  }

  if (!text.trim()) {
    throw new Error("Réponse vide du serveur");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 80).replace(/\s+/g, " ");
    throw new Error(
      `Réponse invalide sur ${url}. Début : « ${preview}… » — API démarrée ?`
    );
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  let res: Response;
  try {
    res = await fetch(`${API}/health`);
  } catch {
    throw new Error(
      "API indisponible. Ouvrez un terminal et exécutez : ./start-api.sh"
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiError(res.status, text));
  }
  if (!text.trim()) {
    throw new Error("Réponse vide du serveur");
  }
  try {
    return JSON.parse(text) as HealthResponse;
  } catch {
    throw new Error(
      "API indisponible ou mauvais proxy. Lancez ./start-api.sh sur le port 8000."
    );
  }
}

export const api = {
  health: fetchHealth,
  configMetier: () => fetchJson<ConfigMetier>(`${API}/config/metier`),
  kpi: () => fetchJson<DashboardKPI>(`${API}/dashboard/kpi`),
  stocksOverview: (alertesOnly = false) =>
    fetchJson<StockOverview[]>(
      `${API}/dashboard/stocks-overview?alertes_only=${alertesOnly}`
    ),
  ventesTrend: (days = 90) =>
    fetchJson<VenteTrendPoint[]>(`${API}/dashboard/ventes-trend?days=${days}`),
  topProduits: (limit = 12) =>
    fetchJson<TopProduit[]>(`${API}/dashboard/top-produits?limit=${limit}`),
  ventesRecentes: (limit = 15) =>
    fetchJson<VenteRecente[]>(`${API}/ventes/recentes?limit=${limit}`),
  enregistrerVente: (produit_id: number, quantite: number) =>
    fetchJson<VenteResponse>(`${API}/ventes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produit_id, quantite }),
    }),
  previsions: () => fetchJson<Prevision[]>(`${API}/ml/previsions`),
  commande: () => fetchJson<CommandeResume>(`${API}/ml/commande`),
  produits: () => fetchJson<Produit[]>(`${API}/produits`),
  updateStock: (id: number, stock: number) =>
    fetchJson<Produit>(`${API}/produits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock_actuel: stock }),
    }),
};
