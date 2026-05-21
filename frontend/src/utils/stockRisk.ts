import { StockOverview } from "../api";

/** Filtres de l'onglet Stocks (alignés sur les badges de risque). */
export type StockFilterId =
  | "all"
  | "alertes"
  | "critique"
  | "eleve"
  | "moyen"
  | "faible";

export const ALERTE_RISQUES = ["critique", "eleve", "moyen"] as const;

export const STOCK_FILTERS: {
  id: StockFilterId;
  label: string;
  chipClass: string;
}[] = [
  { id: "all", label: "Tous", chipClass: "" },
  { id: "alertes", label: "Alertes", chipClass: "chip-alertes" },
  { id: "critique", label: "Ruptures", chipClass: "chip-critique" },
  { id: "eleve", label: "Urgent", chipClass: "chip-eleve" },
  { id: "moyen", label: "Attention", chipClass: "chip-moyen" },
  { id: "faible", label: "OK", chipClass: "chip-faible" },
];

export function matchesStockFilter(
  risque: string,
  filter: StockFilterId
): boolean {
  if (filter === "all") return true;
  if (filter === "alertes") {
    return (ALERTE_RISQUES as readonly string[]).includes(risque);
  }
  return risque === filter;
}

export function filterStocks(
  stocks: StockOverview[],
  filter: StockFilterId
): StockOverview[] {
  if (filter === "all") return stocks;
  return stocks.filter((s) => matchesStockFilter(s.risque_rupture, filter));
}

export function stockFilterCounts(
  stocks: StockOverview[]
): Record<StockFilterId, number> {
  return {
    all: stocks.length,
    alertes: stocks.filter((s) => matchesStockFilter(s.risque_rupture, "alertes"))
      .length,
    critique: stocks.filter((s) => s.risque_rupture === "critique").length,
    eleve: stocks.filter((s) => s.risque_rupture === "eleve").length,
    moyen: stocks.filter((s) => s.risque_rupture === "moyen").length,
    faible: stocks.filter((s) => s.risque_rupture === "faible").length,
  };
}
