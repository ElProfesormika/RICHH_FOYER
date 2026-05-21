type Filter = "all" | "alertes" | "critique" | "eleve" | "moyen";

export function StocksFilter({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  counts: { all: number; alertes: number; critique: number; eleve: number; moyen: number };
}) {
  const items: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Tous", count: counts.all },
    { id: "alertes", label: "Alertes", count: counts.alertes },
    { id: "critique", label: "Rupture", count: counts.critique },
    { id: "eleve", label: "Urgent", count: counts.eleve },
    { id: "moyen", label: "Attention", count: counts.moyen },
  ];

  return (
    <div className="filter-chips" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`chip ${value === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          <span className="chip-count">{item.count}</span>
        </button>
      ))}
    </div>
  );
}
