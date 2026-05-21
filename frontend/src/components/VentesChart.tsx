import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopProduit, VenteTrendPoint } from "../api";
import type { Theme } from "../theme";
import "../App.css";

function chartColors(theme: Theme) {
  if (theme === "light") {
    return {
      grid: "#dce3ed",
      text: "#5c6b82",
      tooltipBg: "#ffffff",
      tooltipBorder: "#d4dbe6",
      line: "#1d6fd8",
      bar: "#1d6fd8",
    };
  }
  return {
    grid: "#2d3f56",
    text: "#8b9cb3",
    tooltipBg: "#151d2b",
    tooltipBorder: "#2a3a52",
    line: "#4a9eff",
    bar: "#4a9eff",
  };
}

export function VentesChart({
  data,
  top,
  theme,
}: {
  data: VenteTrendPoint[];
  top: TopProduit[];
  theme: Theme;
}) {
  const c = chartColors(theme);
  const chartData = data.map((d) => ({
    jour: new Date(d.jour).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    }),
    quantite: d.quantite,
  }));

  const tooltipStyle = {
    background: c.tooltipBg,
    border: `1px solid ${c.tooltipBorder}`,
    borderRadius: 8,
    color: c.text,
  };

  return (
    <div className="grid-charts">
      <div className="panel">
        <h2>Évolution des ventes (quotidien)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
            <XAxis
              dataKey="jour"
              tick={{ fill: c.text, fontSize: 11 }}
              interval="preserveEnd"
            />
            <YAxis tick={{ fill: c.text, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="quantite"
              stroke={c.line}
              strokeWidth={2}
              dot={false}
              name="Ventes"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="panel">
        <h2>Top produits</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={top}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={c.grid}
              horizontal={false}
            />
            <XAxis type="number" tick={{ fill: c.text, fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="produit_nom"
              width={120}
              tick={{ fill: c.text, fontSize: 10 }}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="total_ventes"
              fill={c.bar}
              radius={[0, 4, 4, 0]}
              name="Ventes"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
