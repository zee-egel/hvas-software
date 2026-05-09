import { AlertTriangle, TrendingUp, Zap } from "./Icons";

interface SmartInsightsProps {
  restockedIngredients: Record<string, number>;
  inventory: Record<string, number>;
  predictedOrders: Record<string, number>;
  actualOrders: Record<string, number>;
  currentWeek: number;
  restockThreshold: number;
}

export default function SmartInsights({
  restockedIngredients,
  inventory,
  predictedOrders,
  actualOrders,
  currentWeek,
  restockThreshold,
}: SmartInsightsProps) {
  const LOW_THRESHOLD = restockThreshold;
  const CRITICAL_THRESHOLD = Math.round(restockThreshold * 0.4);
  const insights: {
    icon: typeof Zap;
    text: string;
    tone: "green" | "amber" | "red";
  }[] = [];

  // --- Low / critical stock ---
  const entries = Object.entries(inventory);
  const critical = entries
    .filter(([, q]) => q < CRITICAL_THRESHOLD)
    .map(([n]) => n);
  const low = entries
    .filter(([, q]) => q >= CRITICAL_THRESHOLD && q < LOW_THRESHOLD)
    .map(([n]) => n);

  if (critical.length > 0) {
    insights.push({
      icon: AlertTriangle,
      text: `Critical stock: ${critical.join(", ")} — order immediately to avoid shortages.`,
      tone: "red",
    });
  }
  if (low.length > 0) {
    insights.push({
      icon: AlertTriangle,
      text: `Low stock warning: ${low.join(", ")} — consider restocking soon.`,
      tone: "amber",
    });
  }

  // --- Restocked ---
  const restockedNames = Object.keys(restockedIngredients);
  if (restockedNames.length > 0) {
    insights.push({
      icon: Zap,
      text: `Auto-restocked this cycle: ${restockedNames.join(", ")}.`,
      tone: "green",
    });
  }

  // --- Top predicted recipe ---
  const predictedEntries = Object.entries(predictedOrders);
  if (predictedEntries.length > 1) {
    const [topRecipe, topCount] = predictedEntries.reduce((a, b) =>
      b[1] > a[1] ? b : a,
    );
    insights.push({
      icon: TrendingUp,
      text: `Highest demand forecast: ${topRecipe} with ${topCount.toLocaleString()} predicted orders.`,
      tone: "green",
    });
  }

  // --- Prediction vs actual delta ---
  const actualEntries = Object.entries(actualOrders);
  if (actualEntries.length > 0 && predictedEntries.length > 0) {
    const totalPredicted = Object.values(predictedOrders).reduce(
      (a, b) => a + b,
      0,
    );
    const totalActual = Object.values(actualOrders).reduce((a, b) => a + b, 0);
    if (totalPredicted > 0) {
      const deltaPct = Math.round(
        ((totalActual - totalPredicted) / totalPredicted) * 100,
      );
      if (Math.abs(deltaPct) > 15) {
        insights.push({
          icon: TrendingUp,
          text:
            deltaPct > 0
              ? `Actual orders are ${deltaPct}% above predictions — consider increasing stock buffers.`
              : `Actual orders are ${Math.abs(deltaPct)}% below predictions — potential over-ordering risk.`,
          tone: Math.abs(deltaPct) > 30 ? "red" : "amber",
        });
      }
    }
  }

  // --- Fallback ---
  if (currentWeek === 0 || (insights.length === 0 && entries.length === 0)) {
    insights.push({
      icon: Zap,
      text: "Start a simulation to generate smart insights.",
      tone: "green",
    });
  } else if (insights.length === 0) {
    insights.push({
      icon: Zap,
      text: "All systems nominal — stock levels healthy and predictions on track.",
      tone: "green",
    });
  }

  const toneStyles = {
    green: "bg-emerald/10 border-emerald/20",
    amber: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
  };
  const iconBg = {
    green: "bg-emerald",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };
  const textColor = {
    green: "text-emerald-dark",
    amber: "text-amber-800",
    red: "text-red-800",
  };
  const titleColor = {
    green: "text-emerald-darkest",
    amber: "text-amber-900",
    red: "text-red-900",
  };

  return (
    <div className="flex flex-col gap-3">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`${toneStyles[insight.tone]} border rounded-lg p-5 flex items-start gap-4`}
        >
          <div
            className={`w-8 h-9 flex items-center justify-center ${iconBg[insight.tone]} rounded-2xl shrink-0`}
          >
            <insight.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            {i === 0 && (
              <h3
                className={`text-sm font-semibold ${titleColor[insight.tone]} tracking-wide`}
              >
                Smart Insights
              </h3>
            )}
            <p
              className={`text-sm ${textColor[insight.tone]} ${i === 0 ? "mt-1.5" : ""}`}
            >
              {insight.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
