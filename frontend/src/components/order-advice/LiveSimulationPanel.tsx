import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { Play, RefreshCw, Square, Zap } from "../Icons";
import AccuracyChart from "../AccuracyChart";
import OrdersChart from "../OrdersChart";
import SmartInsights from "../SmartInsights";
import { useSimulation } from "../../useSimulation";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

export default function LiveSimulationPanel() {
  const {
    liveSimulation,
    startLiveService,
    stopLiveService,
    advanceLiveService,
    resetLiveService,
  } = useSimulation();
  const [autoPlay, setAutoPlay] = useState(false);

  const tickOnce = useEffectEvent(() => {
    void advanceLiveService();
  });

  useEffect(() => {
    if (!autoPlay || !liveSimulation?.is_running) return undefined;
    const interval = window.setInterval(() => {
      tickOnce();
    }, 1200);
    return () => window.clearInterval(interval);
  }, [autoPlay, liveSimulation?.is_running, tickOnce]);

  useEffect(() => {
    if (!liveSimulation?.is_running && autoPlay) {
      setAutoPlay(false);
    }
  }, [autoPlay, liveSimulation?.is_running]);

  const restockedCount = useMemo(
    () => Object.keys(liveSimulation?.restocked_ingredients ?? {}).length,
    [liveSimulation],
  );

  if (!liveSimulation) return null;

  const topVolatile = liveSimulation.variance_summary.most_volatile_ingredient;

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d5e9df] bg-[#f1fbf6] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-dark">
            <Zap className="h-3.5 w-3.5" />
            Live service simulation
          </div>
          <h2 className="mt-3 text-3xl font-semibold text-heading">
            Click start to watch the restaurant run
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-subtitle">
            Recipe usage is treated as a target, not exact truth. Each cycle
            simulates portion drift, waste, and a learned usage multiplier per
            ingredient.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void startLiveService()}
            disabled={liveSimulation.is_running}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-dark px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Start
          </button>
          <button
            type="button"
            onClick={() => void advanceLiveService()}
            disabled={!liveSimulation.is_running}
            className="rounded-full border border-border/15 bg-bg px-4 py-2.5 text-sm font-medium text-subtitle transition-colors hover:bg-card disabled:opacity-50"
          >
            Advance 1 cycle
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(() => setAutoPlay((current) => !current))
            }
            disabled={!liveSimulation.is_running}
            className="rounded-full border border-border/15 bg-bg px-4 py-2.5 text-sm font-medium text-subtitle transition-colors hover:bg-card disabled:opacity-50"
          >
            {autoPlay ? "Pause autoplay" : "Autoplay"}
          </button>
          <button
            type="button"
            onClick={() => void stopLiveService()}
            disabled={!liveSimulation.is_running}
            className="inline-flex items-center gap-2 rounded-full border border-border/15 bg-white px-4 py-2.5 text-sm font-medium text-subtitle transition-colors hover:bg-bg disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
          <button
            type="button"
            onClick={() => void resetLiveService()}
            className="inline-flex items-center gap-2 rounded-full border border-border/15 bg-white px-4 py-2.5 text-sm font-medium text-subtitle transition-colors hover:bg-bg"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-border bg-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body">
            Service state
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {liveSimulation.is_running ? "Running" : "Idle"}
          </p>
          <p className="mt-2 text-sm text-subtitle">
            Week {liveSimulation.current_week} at {liveSimulation.current_time}
          </p>
        </article>
        <article className="rounded-3xl border border-border bg-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body">
            Average skew
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {compactNumber(
              liveSimulation.variance_summary.average_usage_skew_pct,
            )}
            %
          </p>
          <p className="mt-2 text-sm text-subtitle">
            Net drift vs recipe target this cycle
          </p>
        </article>
        <article className="rounded-3xl border border-border bg-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body">
            Absolute variance
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {compactNumber(
              liveSimulation.variance_summary.average_absolute_skew_pct,
            )}
            %
          </p>
          <p className="mt-2 text-sm text-subtitle">
            Portioning noise plus waste spread
          </p>
        </article>
        <article className="rounded-3xl border border-border bg-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body">
            Auto-restocks
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {restockedCount}
          </p>
          <p className="mt-2 text-sm text-subtitle">
            Ingredients replenished this cycle
          </p>
        </article>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6">
          <OrdersChart
            predicted={liveSimulation.predicted_orders}
            actual={liveSimulation.actual_orders}
            title="Predicted vs actual orders"
          />
          <AccuracyChart accuracy={liveSimulation.accuracy_history} />
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-border/10 bg-[#fbf8f1] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
              Learned usage
            </p>
            <h3 className="mt-2 text-xl font-semibold text-heading">
              {topVolatile?.ingredientName ?? "No ingredient movement yet"}
            </h3>
            <p className="mt-2 text-sm text-subtitle">
              {topVolatile
                ? `This ingredient ran ${Math.abs(topVolatile.variancePct)}% ${
                    topVolatile.variancePct >= 0 ? "above" : "below"
                  } target. Learned multiplier: ${topVolatile.learnedMultiplier.toFixed(2)}x.`
                : "Start the simulation to let the model observe real-world prep drift."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {liveSimulation.recent_events.map((event) => (
                <span
                  key={event}
                  className="rounded-full border border-border/15 bg-white px-3 py-1.5 text-xs font-medium text-subtitle"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>

          <SmartInsights
            restockedIngredients={liveSimulation.restocked_ingredients}
            inventory={liveSimulation.inventory}
            predictedOrders={liveSimulation.predicted_orders}
            actualOrders={liveSimulation.actual_orders}
            currentWeek={liveSimulation.current_week}
            restockThreshold={liveSimulation.config.restock_threshold}
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-border/10 bg-white/70">
        <div className="border-b border-border/10 px-5 py-4">
          <h3 className="text-lg font-semibold text-heading">
            Ingredient usage drift
          </h3>
          <p className="mt-1 text-sm text-subtitle">
            The multiplier learns whether actual kitchen usage tends to run over
            or under the recipe baseline.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-border/10 text-xs uppercase tracking-wider text-body">
                <th className="px-5 py-3">Ingredient</th>
                <th className="px-5 py-3">Expected</th>
                <th className="px-5 py-3">Actual</th>
                <th className="px-5 py-3">Variance</th>
                <th className="px-5 py-3">Learned multiplier</th>
                <th className="px-5 py-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {liveSimulation.ingredient_usage.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-body"
                  >
                    Start the simulation to generate ingredient usage data.
                  </td>
                </tr>
              ) : (
                liveSimulation.ingredient_usage.map((item) => (
                  <tr
                    key={item.ingredientId}
                    className="border-b border-border/10 last:border-0"
                  >
                    <td className="px-5 py-4 font-medium text-heading">
                      {item.ingredientName}
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {compactNumber(item.expectedUsage)}
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {compactNumber(item.actualUsage)}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span
                        className={`rounded-full px-2.5 py-1 font-medium ${
                          item.variancePct > 0
                            ? "bg-[#fff0e6] text-[#a65a1b]"
                            : item.variancePct < 0
                              ? "bg-[#eef6ff] text-[#285c93]"
                              : "bg-emerald-light text-badge-green"
                        }`}
                      >
                        {item.variancePct > 0 ? "+" : ""}
                        {item.variancePct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {item.learnedMultiplier.toFixed(2)}x
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {Math.round(item.confidence * 100)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
