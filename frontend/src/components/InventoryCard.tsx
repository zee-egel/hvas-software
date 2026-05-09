interface InventoryCardProps {
  name: string;
  quantity: number;
  restockThreshold: number;
  restockAmount: number;
}

export default function InventoryCard({
  name,
  quantity,
  restockThreshold,
  restockAmount,
}: InventoryCardProps) {
  const pct = (quantity / restockAmount) * 100;
  const thresholdPct = (restockThreshold / restockAmount) * 100;
  const isLow = pct < thresholdPct;

  return (
    <div className="bg-card rounded-xl border border-border/10 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-subtitle capitalize">
          {name}
        </span>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
            isLow
              ? "bg-alert/10 text-alert"
              : "bg-emerald-light text-badge-green"
          }`}
        >
          {isLow ? "Low Stock" : "Optimized"}
        </span>
      </div>

      <span
        className={`text-2xl font-semibold ${isLow ? "text-alert" : "text-emerald-dark"}`}
      >
        {quantity.toLocaleString()}
      </span>

      <div className="w-full h-2 bg-progress-track rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? "bg-alert" : "bg-emerald-dark"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
