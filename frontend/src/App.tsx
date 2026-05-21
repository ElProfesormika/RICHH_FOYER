import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  CommandeResume,
  ConfigMetier,
  DashboardKPI,
  MlStatus,
  Produit,
  StockOverview,
  TopProduit,
  VenteRecente,
  VenteTrendPoint,
} from "./api";
import "./App.css";
import { CommandePanel } from "./components/CommandePanel";
import { CommandeResumeCard } from "./components/CommandeResumeCard";
import {
  IconDashboard,
  IconLogo,
  IconOrder,
  IconRefresh,
  IconStock,
} from "./components/Icons";
import { KpiCards } from "./components/KpiCards";
import { MlStatusPanel } from "./components/MlStatusPanel";
import { LoadingState } from "./components/LoadingState";
import { SaleForm } from "./components/SaleForm";
import { StockGrid } from "./components/StockGrid";
import { StocksFilter, StockFilterId } from "./components/StocksFilter";
import { filterStocks, STOCK_FILTERS } from "./utils/stockRisk";
import { StocksTable } from "./components/StocksTable";
import { VentesChart } from "./components/VentesChart";
import { ThemeToggle } from "./components/ThemeToggle";
import { VentesLive } from "./components/VentesLive";
import { useTheme } from "./hooks/useTheme";

type Tab = "dashboard" | "stocks" | "commande";

const REFRESH_MS = 15000;

const TAB_ICONS = {
  dashboard: IconDashboard,
  stocks: IconStock,
  commande: IconOrder,
} as const;

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilterId>("all");

  const [kpi, setKpi] = useState<DashboardKPI | null>(null);
  const [trend, setTrend] = useState<VenteTrendPoint[]>([]);
  const [top, setTop] = useState<TopProduit[]>([]);
  const [stocks, setStocks] = useState<StockOverview[]>([]);
  const [alertes, setAlertes] = useState<StockOverview[]>([]);
  const [ventesLive, setVentesLive] = useState<VenteRecente[]>([]);
  const [commande, setCommande] = useState<CommandeResume | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [config, setConfig] = useState<ConfigMetier | null>(null);
  const [mlStatus, setMlStatus] = useState<MlStatus | null>(null);

  const horizonJours = config?.horizon_jours ?? kpi?.horizon_jours ?? 14;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const health = await api.health();
      setApiOnline(true);

      if (health.loading && !health.data_ready) {
        setDataLoading(true);
        return;
      }
      setDataLoading(false);

      const [k, t, tp, st, al, vl, cmd, prod, cfg, ml] = await Promise.all([
        api.kpi(),
        api.ventesTrend(120),
        api.topProduits(10),
        api.stocksOverview(),
        api.stocksOverview({ alertesOnly: true }),
        api.ventesRecentes(15),
        api.commande(),
        api.produits(),
        api.configMetier(),
        api.mlStatus(),
      ]);
      setKpi(k);
      setTrend(t);
      setTop(tp);
      setStocks(st);
      setAlertes(al);
      setVentesLive(vl);
      setCommande(cmd);
      setProduits(prod);
      setConfig(cfg);
      setMlStatus(ml);
      setLastUpdate(new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur de chargement";
      if (msg.includes("API indisponible") || msg.includes("Impossible de joindre")) {
        setApiOnline(false);
      }
      setError(msg);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = dataLoading ? 5000 : REFRESH_MS;
    const t = setInterval(() => load(true), interval);
    return () => clearInterval(t);
  }, [dataLoading, load]);

  const handleStockUpdate = async (id: number, stock: number) => {
    await api.updateStock(id, stock);
    await load(true);
  };

  const filteredStocks = useMemo(
    () => filterStocks(stocks, stockFilter),
    [stocks, stockFilter]
  );

  const stockFilterLabel = STOCK_FILTERS.find((f) => f.id === stockFilter)?.label;

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Tableau de bord" },
    { id: "stocks", label: "Stocks" },
    { id: "commande", label: "Commande" },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <IconLogo className="logo-svg" />
          <div>
            <strong>Foyer_UTT</strong>
            <span>Gestion stocks</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {tabs.map((t) => {
            const Icon = TAB_ICONS[t.id];
            return (
              <button
                key={t.id}
                className={`nav-item ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <Icon className="nav-icon-svg" />
                {t.label}
                {t.id === "dashboard" && kpi && kpi.alertes_stock > 0 && (
                  <span className="nav-badge">{kpi.alertes_stock}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <p className={`api-status ${apiOnline ? "online" : "offline"}`}>
            <span className="status-dot" />
            {apiOnline ? "API connectée" : "API hors ligne"}
          </p>
          {lastUpdate && (
            <p className="sync-status">
              Dernière sync :{" "}
              {lastUpdate.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
          <button
            className="btn-secondary btn-block"
            onClick={() => load()}
            disabled={loading}
          >
            <IconRefresh className="btn-icon" />
            Actualiser
          </button>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div>
            <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
            <p className="topbar-sub">
              {tab === "stocks" ? (
                <>
                  Prévisions XGBoost sur {horizonJours} jours · stock de sécurité
                  z={config?.z_service ?? 1.65} · délai L={config?.lead_time_jours ?? 3}{" "}
                  j · seuil fournisseur {config?.seuil_fournisseur_eur ?? 400} EUR
                  {stockFilter !== "all" && (
                    <>
                      {" "}
                      · filtre : <strong>{stockFilterLabel}</strong> (
                      {filteredStocks.length}/{stocks.length})
                    </>
                  )}
                </>
              ) : (
                <>
                  Prévisions XGBoost sur {horizonJours} jours · stock de sécurité
                  z={config?.z_service ?? 1.65} · seuil fournisseur{" "}
                  {config?.seuil_fournisseur_eur ?? 400} EUR
                </>
              )}
            </p>
          </div>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {dataLoading && (
          <div className="alert alert-info" role="status">
            Import des données en cours. Actualisation automatique active.
          </div>
        )}

        <main className="main">
          {loading && !kpi && !dataLoading ? (
            <LoadingState />
          ) : dataLoading ? (
            <LoadingState label="Préparation des données" />
          ) : (
            <>
              {tab === "dashboard" && kpi && (
                <div className="dashboard-page">
                  <KpiCards kpi={kpi} />
                  <MlStatusPanel ml={mlStatus} kpi={kpi} config={config} />
                  <div className="dashboard-row-3">
                    <SaleForm produits={produits} onSale={() => load(true)} />
                    <VentesLive ventes={ventesLive} />
                    {commande &&
                      (commande.montant_total > 0 || commande.lignes.length > 0) && (
                        <CommandeResumeCard commande={commande} />
                      )}
                  </div>
                  <StockGrid
                    items={alertes}
                    compact
                    title="Produits a surveiller"
                    emptyLabel="Aucune alerte stock pour le moment"
                    horizonJours={horizonJours}
                  />
                  <VentesChart data={trend} top={top} theme={theme} />
                </div>
              )}
              {tab === "stocks" && (
                <>
                  <StocksFilter
                    value={stockFilter}
                    onChange={setStockFilter}
                    stocks={stocks}
                  />
                  <StockGrid
                    items={filteredStocks}
                    title={
                      stockFilter === "all"
                        ? "Inventaire"
                        : `Inventaire — ${stockFilterLabel}`
                    }
                    emptyLabel={`Aucun produit en « ${stockFilterLabel ?? stockFilter} »`}
                    horizonJours={horizonJours}
                  />
                  <div className="section-spacer">
                    <StocksTable
                      produits={produits}
                      stocks={filteredStocks}
                      commande={commande}
                      onUpdate={handleStockUpdate}
                      horizonJours={horizonJours}
                      filterLabel={
                        stockFilter !== "all" ? stockFilterLabel : undefined
                      }
                    />
                  </div>
                </>
              )}
              {tab === "commande" &&
                (commande ? (
                  <CommandePanel
                    commande={commande}
                    horizonJours={horizonJours}
                    zService={config?.z_service}
                    leadTimeJours={config?.lead_time_jours}
                  />
                ) : (
                  <div className="panel empty-panel">
                    <p>
                      Aucune commande suggérée pour le moment. Enregistrez une
                      vente ou ajustez un stock pour recalculer automatiquement.
                    </p>
                  </div>
                ))}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
