import { useEffect, useEffectEvent, useState } from "react";
import AccuracyChart from "./AccuracyChart";
import { Play, RefreshCw, Square, Zap } from "./Icons";
import OrdersChart from "./OrdersChart";
import { ErrorState, LoadingState } from "./PageState";
import { useSimulation } from "../useSimulation";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function LiveSimulationPage() {
  const {
    liveSimulation,
    loading,
    error,
    refresh,
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
    }, 1400);
    return () => window.clearInterval(interval);
  }, [autoPlay, liveSimulation?.is_running]);

  if (loading && !liveSimulation)
    return <LoadingState title="Loading live simulation..." />;
  if (!liveSimulation)
    return (
      <ErrorState
        title="Live simulation unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );

  const topVariance = liveSimulation.variance_summary.most_volatile_ingredient;
  const totalPredicted = Object.values(liveSimulation.predicted_orders).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalActual = Object.values(liveSimulation.actual_orders).reduce(
    (sum, value) => sum + value,
    0,
  );
  const demandDelta =
    totalPredicted > 0
      ? ((totalActual - totalPredicted) / totalPredicted) * 100
      : 0;
  const latestAccuracy =
    liveSimulation.accuracy_history.at(-1) ??
    liveSimulation.model_accuracy.at(-1) ??
    98.4;
  const restockedUnits = Object.values(
    liveSimulation.restocked_ingredients,
  ).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8e8e1] bg-[#f7fcf9] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-body">
          Sandbox Mode
        </p>
        <p className="mt-2 text-sm leading-6 text-body">
          Live Simulation is isolated from production KPIs. Use it to test
          forecast drift, kitchen variance, and restock behavior without
          changing the production purchasing snapshot.
        </p>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-light text-emerald-dark">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-heading">
                Live Simulation
              </p>
              <span className="rounded-full bg-emerald-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-dark">
                {liveSimulation.is_running ? "Active" : "Idle"}
              </span>
            </div>
            <p className="mt-1 text-sm text-body">
              Cycle {liveSimulation.current_week} • Model: HVAS-Core v4.2
              Predictive
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void startLiveService()}
            disabled={liveSimulation.is_running}
            className="inline-flex items-center gap-2 rounded-xl border border-[#ffd2d0] bg-[#fff0ef] px-4 py-2.5 text-sm font-semibold text-alert disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            Start
          </button>
          <button
            type="button"
            onClick={() => void stopLiveService()}
            disabled={!liveSimulation.is_running}
            className="inline-flex items-center gap-2 rounded-xl border border-[#ffd2d0] bg-[#fff0ef] px-4 py-2.5 text-sm font-semibold text-alert disabled:opacity-40"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
          <button
            type="button"
            onClick={() => void advanceLiveService()}
            disabled={!liveSimulation.is_running}
            className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Advance 1 Cycle
          </button>
          <button
            type="button"
            onClick={() => setAutoPlay((current) => !current)}
            disabled={!liveSimulation.is_running}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-subtitle disabled:opacity-40"
          >
            {autoPlay ? "Pause Autoplay" : "Autoplay"}
          </button>
          <button
            type="button"
            onClick={() => void resetLiveService()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-subtitle"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Total Predicted Orders
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {totalPredicted}
          </p>
          <p className="mt-2 text-xs text-body">
            Forecast output for the current cycle
          </p>
        </article>
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Total Actual Orders
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {totalActual}
          </p>
          <p
            className={`mt-2 text-xs font-medium ${
              demandDelta > 0 ? "text-alert" : "text-emerald-dark"
            }`}
          >
            {demandDelta > 0 ? "+" : ""}
            {demandDelta.toFixed(1)}% vs forecast
          </p>
        </article>
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Auto-Restocked Units
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {restockedUnits}
          </p>
          <p className="mt-2 text-xs text-body">
            Added after crossing configured stock thresholds
          </p>
        </article>
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Learning Confidence
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {(topVariance?.confidence ?? 0) * 100 > 0
              ? `${Math.round((topVariance?.confidence ?? 0) * 100)}%`
              : "0%"}
          </p>
          <p className="mt-2 text-xs text-body">
            Confidence in the strongest learned multiplier
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_0.75fr]">
        <div className="rounded-2xl border border-border bg-white p-4">
          <OrdersChart
            predicted={liveSimulation.predicted_orders}
            actual={liveSimulation.actual_orders}
            title="Predicted vs Actual Demand"
          />
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold text-heading">Model Accuracy</p>
          <p className="mt-1 text-sm text-body">
            Learning Delta over Simulation
          </p>
          <div className="mt-8 text-center">
            <p className="text-[44px] font-semibold leading-none text-emerald-darkest">
              {latestAccuracy.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm font-medium text-emerald-dark">
              {topVariance
                ? `${Math.abs(topVariance.variancePct).toFixed(1)}% live variance detected`
                : "No variance learned yet"}
            </p>
          </div>
          <div className="mt-8 rounded-xl border border-[#d7e9e2] bg-[#eef8f4] p-2">
            <div
              className="h-12 rounded-lg bg-linear-to-r from-[#cfe7dc] to-[#b6e3d3]"
              style={{ width: `${clamp(latestAccuracy, 8, 100)}%` }}
            />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
            <span className="text-body">Epoch Accuracy</span>
            <span className="font-semibold text-heading">
              {(latestAccuracy / 100).toFixed(4)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[#f6faf8] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-body">
                Avg skew
              </p>
              <p className="mt-2 font-semibold text-heading">
                {liveSimulation.variance_summary.average_usage_skew_pct.toFixed(
                  1,
                )}
                %
              </p>
            </div>
            <div className="rounded-xl bg-[#f6faf8] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-body">
                Abs skew
              </p>
              <p className="mt-2 font-semibold text-heading">
                {liveSimulation.variance_summary.average_absolute_skew_pct.toFixed(
                  1,
                )}
                %
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.4fr]">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-heading">Smart Insights</p>
          {liveSimulation.recent_events.map((event, index) => (
            <article
              key={event}
              className="rounded-md border border-border bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 h-8 w-1 rounded-full ${
                    index === 0
                      ? "bg-emerald-dark"
                      : index === 1
                        ? "bg-[#95efc8]"
                        : "bg-[#54dca8]"
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-heading">
                    {index === 0
                      ? "Usage Delta Warning"
                      : index === 1
                        ? "Precision Restock"
                        : "Demand Pivot Detected"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-body">{event}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-heading">
                Ingredient Usage Variance
              </p>
              <p className="mt-1 text-sm text-body">
                HVAS learns from your kitchen&apos;s unique behavior to improve
                ordering precision. Real-time learning active.
              </p>
            </div>
            <p className="text-sm text-body">
              Last update: {liveSimulation.current_time}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-body">
                  <th className="px-5 py-3">Ingredient</th>
                  <th className="px-5 py-3">Expected</th>
                  <th className="px-5 py-3">Actual</th>
                  <th className="px-5 py-3">Variance %</th>
                  <th className="px-5 py-3">Learned Multiplier</th>
                  <th className="px-5 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {liveSimulation.ingredient_usage.map((item) => (
                  <tr
                    key={item.ingredientId}
                    className="border-t border-border"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-heading">
                      {item.ingredientName}
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {item.expectedUsage}
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {item.actualUsage}
                    </td>
                    <td
                      className={`px-5 py-4 text-sm font-semibold ${
                        item.variancePct > 0
                          ? "text-alert"
                          : "text-emerald-dark"
                      }`}
                    >
                      {item.variancePct > 0 ? "+" : ""}
                      {item.variancePct.toFixed(1)}%
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      <span className="rounded-md bg-[#f2f5f3] px-2 py-1 font-medium text-heading">
                        {item.learnedMultiplier.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-20 rounded-full bg-progress-track">
                          <div
                            className="h-2 rounded-full bg-emerald-dark"
                            style={{ width: `${item.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-heading">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 border-t border-border px-5 py-4 md:grid-cols-3">
            <div className="rounded-xl bg-[#f7faf8] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-body">
                Calc: expected
              </p>
              <p className="mt-2 text-sm text-heading">
                recipe quantity × actual orders
              </p>
            </div>
            <div className="rounded-xl bg-[#f7faf8] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-body">
                Calc: actual
              </p>
              <p className="mt-2 text-sm text-heading">
                expected × learned multiplier × waste factor
              </p>
            </div>
            <div className="rounded-xl bg-[#f7faf8] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-body">
                Calc: confidence
              </p>
              <p className="mt-2 text-sm text-heading">
                grows with repeated observations per ingredient pair
              </p>
            </div>
          </div>
          <div className="border-t border-border px-5 py-4 text-center text-sm font-semibold text-emerald-dark">
            View All Ingredient Delta
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <AccuracyChart accuracy={liveSimulation.accuracy_history} />
      </section>
    </div>
  );
}
