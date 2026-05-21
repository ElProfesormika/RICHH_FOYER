export function RiskBadge({ risque }: { risque: string }) {
  const labels: Record<string, string> = {
    faible: "OK",
    moyen: "Attention",
    eleve: "Urgent",
    critique: "Ruptures",
  };
  return (
    <span className={`badge badge-${risque}`}>
      {labels[risque] ?? risque}
    </span>
  );
}
