import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OrderAdviceItem } from "../../api/client";

export default function ForecastChart({ item }: { item: OrderAdviceItem }) {
  const history = item.recentSalesHistory.map((point) => ({
    label: new Date(point.date).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
    }),
    sales: point.quantity,
    stock: item.currentStock,
  }));

  const forecast = item.forecast.dailyForecast.map((point) => ({
    label: new Date(point.date).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
    }),
    forecast: point.quantity,
    stock: item.currentStock,
  }));

  const data = [...history, ...forecast];

  return (
    <div className="h-64 rounded-3xl border border-border/10 bg-bg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#BBCABF" strokeDasharray="3 3" strokeOpacity={0.25} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6C7A71" />
          <YAxis tick={{ fontSize: 11 }} stroke="#6C7A71" />
          <Tooltip
            contentStyle={{
              borderRadius: 16,
              border: "1px solid rgba(187,202,191,0.25)",
              fontFamily: "Poppins",
            }}
          />
          <ReferenceLine
            y={item.currentStock}
            stroke="#A43A3A"
            strokeDasharray="5 5"
            label={{ value: "Voorraad", fill: "#A43A3A", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#006C49"
            strokeWidth={2.5}
            dot={false}
            name="Historische verkoop"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#10B981"
            strokeWidth={2.5}
            dot={false}
            strokeDasharray="6 4"
            name="Verwachte vraag"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
