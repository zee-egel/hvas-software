import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#10B981",
  "#006C49",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
];

interface OrdersChartProps {
  predicted: Record<string, number>;
  actual: Record<string, number>;
  title?: string;
}

export default function OrdersChart({
  predicted,
  actual,
  title,
}: OrdersChartProps) {
  const recipes = Array.from(
    new Set([...Object.keys(predicted), ...Object.keys(actual)]),
  );

  const data = recipes.map((name) => ({
    name,
    predicted: predicted[name] ?? 0,
    actual: actual[name] ?? 0,
  }));

  return (
    <div className="bg-card rounded-xl border border-border/10 p-6">
      <h3 className="text-base font-semibold text-heading mb-4">
        {title ?? "Orders by Recipe"}
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-body/60 py-12 text-center">
          Start a simulation to see order data
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#BBCABF"
              strokeOpacity={0.2}
            />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6C7A71" />
            <YAxis tick={{ fontSize: 12 }} stroke="#6C7A71" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(187,202,191,0.2)",
                fontFamily: "Poppins",
              }}
            />
            <Legend />
            <Bar
              dataKey="predicted"
              fill={COLORS[0]}
              radius={[4, 4, 0, 0]}
              name="Predicted"
            />
            <Bar
              dataKey="actual"
              fill={COLORS[1]}
              radius={[4, 4, 0, 0]}
              name="Actual"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
