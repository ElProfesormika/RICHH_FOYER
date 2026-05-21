import {
  STOCK_FILTERS,
  StockFilterId,
  stockFilterCounts,
} from "../utils/stockRisk";
import type { StockOverview } from "../api";

export type { StockFilterId };

export function StocksFilter({
  value,
  onChange,
  stocks,
}: {
  value: StockFilterId;
  onChange: (f: StockFilterId) => void;
  stocks: StockOverview[];
}) {
  const counts = stockFilterCounts(stocks);

  return (
    <div className="stocks-filter-bar">
      <div className="filter-chips" role="tablist" aria-label="Filtrer par niveau de risque">
        {STOCK_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={value === item.id}
            className={`chip ${item.chipClass} ${value === item.id ? "active" : ""}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
            <span className="chip-count">{counts[item.id]}</span>
          </button>
        ))}
      </div>
      {value !== "all" && (
        <p className="filter-active-hint" role="status">
          Filtre actif :{" "}
          <strong>{STOCK_FILTERS.find((f) => f.id === value)?.label}</strong> —{" "}
          {counts[value]} produit{counts[value] > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
