import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AccuracyChartProps {
  accuracy: number[];
}

export default function AccuracyChart({ accuracy }: AccuracyChartProps) {
  const data = accuracy.map((val, i) => ({
    week: `W${i + 1}`,
    accuracy: val,
  }));

  return (
    <div className="bg-card rounded-xl border border-border/10 p-6">
      <h3 className="text-base font-semibold text-heading mb-4">
        Model Accuracy
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#BBCABF"
            strokeOpacity={0.2}
          />
          <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#6C7A71" />
          <YAxis tick={{ fontSize: 12 }} stroke="#6C7A71" domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(187,202,191,0.2)",
              fontFamily: "Poppins",
            }}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10B981" }}
            name="Accuracy %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
