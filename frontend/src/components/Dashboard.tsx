import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSimulation } from "../useSimulation";
import { ErrorState, LoadingState } from "./PageState";
import ProductionStatusBanner from "./ProductionStatusBanner";
import { AlertTriangle, Check, ChevronRight, Play, Truck, Zap } from "./Icons";
import { useAuth } from "../AuthContext";

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function Dashboard() {
  const { data, liveSimulation, loading, error, refresh, approveOrder } =
    useSimulation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const supplierStats = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<
      string,
      { draftCount: number; protectedRevenue: number; reviewCount: number }
    >();
    for (const order of data.purchaseOrders.active) {
      const existing = grouped.get(order.supplierName) ?? {
        draftCount: 0,
        protectedRevenue: 0,
        reviewCount: 0,
      };
      existing.draftCount += 1;
      existing.protectedRevenue += order.summary.totalProtectedRevenue;
      if (order.status === "NEEDS_REVIEW") existing.reviewCount += 1;
      grouped.set(order.supplierName, existing);
    }
    return Array.from(grouped.entries()).map(([name, values]) => ({
      name,
      rating:
        values.reviewCount === 0
          ? 98
          : Math.max(74, 96 - values.reviewCount * 7),
      ...values,
    }));
  }, [data]);
  const operationalHealth = useMemo(() => {
    if (!data) return 0;
    const urgentPenalty = data.summary.urgentActions * 4;
    const reviewPenalty =
      data.purchaseOrders.active.filter(
        (order) => order.status === "NEEDS_REVIEW",
      ).length * 3;
    const variancePenalty = Math.abs(
      liveSimulation?.variance_summary.average_absolute_skew_pct ?? 0,
    );
    const stockoutPenalty =
      data.evaluation.aggregate.stockoutSimulationRate * 25;
    return clamp(
      Math.round(
        100 - urgentPenalty - reviewPenalty - variancePenalty - stockoutPenalty,
      ),
      42,
      99,
    );
  }, [data, liveSimulation]);

  if (loading && !data)
    return <LoadingState title="Loading executive summary..." />;
  if (!data)
    return (
      <ErrorState
        title="Executive summary unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );

  const topActions = data.todaysActions.slice(0, 3);
  const topOrders = data.purchaseOrders.active.slice(0, 3);
  const shortage = [...data.products].sort(
    (a, b) =>
      b.financialImpact.potentialLostRevenue -
      a.financialImpact.potentialLostRevenue,
  )[0];
  const waste = [...data.products].sort(
    (a, b) =>
      b.financialImpact.potentialWasteCost -
      a.financialImpact.potentialWasteCost,
  )[0];
  const explainedSavings = (
    data.summary.protectedRevenue + data.summary.potentialWastePrevented
  ).toFixed(0);

  return (
    <div className="space-y-5">
      <ProductionStatusBanner data={data} />

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl bg-emerald-dark px-6 py-6 text-white shadow-[0_18px_44px_rgba(13,90,67,0.20)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#89f0c7]">
            <Zap className="h-3.5 w-3.5" />
            Magic Assistant Summary
          </div>
          <h1 className="mt-4 max-w-2xl text-[20px] font-semibold leading-[1.2] md:text-[24px]">
            Good morning, {user?.fullName.split(" ")[0]}. Your operational
            health is at {operationalHealth}%.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c8ddd5]">
            {data.magicSummary.message} HVAS also detected live kitchen usage
            drift and prioritized the orders most likely to protect revenue this
            service.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white/8 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#9edec4]">
                Revenue protected
              </p>
              <p className="mt-2 text-lg font-semibold">
                {euro(data.summary.protectedRevenue)}
              </p>
            </div>
            <div className="rounded-xl bg-white/8 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#9edec4]">
                Waste prevented
              </p>
              <p className="mt-2 text-lg font-semibold">
                {euro(data.summary.potentialWastePrevented)}
              </p>
            </div>
            <div className="rounded-xl bg-white/8 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#9edec4]">
                Health formula
              </p>
              <p className="mt-2 text-sm font-medium">
                100 - urgent actions - PO reviews - usage skew - stockout rate
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/purchasing")}
              className="rounded-xl bg-[#75f2c1] px-4 py-2.5 text-sm font-semibold text-emerald-darkest"
            >
              Apply AI Recommendations
            </button>
            <button
              onClick={() => navigate("/purchasing")}
              className="rounded-xl border border-white/20 bg-white/6 px-4 py-2.5 text-sm font-medium text-white"
            >
              View Details
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-heading">
                Live Simulation
              </p>
              <span className="h-2.5 w-2.5 rounded-full bg-[#25d59f]" />
            </div>
            <p className="mt-1 text-xs text-body">
              {liveSimulation?.is_running ? "Engine active" : "Engine idle"}
            </p>
            <div className="mt-4 rounded-xl border border-border bg-[#f8fbf9] p-4">
              <div className="flex items-end gap-1.5">
                {Object.values(
                  liveSimulation?.actual_orders ?? { a: 2, b: 4, c: 3 },
                ).map((value, index) => (
                  <div
                    key={index}
                    className={`flex-1 rounded-t-[4px] ${
                      index === 4 ? "bg-emerald-dark" : "bg-[#c8d8d2]"
                    }`}
                    style={{ height: `${Math.max(24, value * 10)}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => navigate("/simulation")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-dark text-white"
              >
                <Play className="h-4 w-4" />
              </button>
              <div className="text-right">
                <p className="text-sm font-semibold text-heading">
                  {(
                    liveSimulation?.accuracy_history.at(-1) ??
                    liveSimulation?.model_accuracy.at(-1) ??
                    0
                  ).toFixed(1)}
                  % accuracy
                </p>
                <span className="text-sm font-medium text-emerald-dark">
                  Full Engine <ChevronRight className="ml-1 inline h-4 w-4" />
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-body">
              Supplier reliability
            </p>
            <div className="mt-4 space-y-3">
              {supplierStats.slice(0, 2).map((supplier) => (
                <div key={supplier.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-heading">
                      {supplier.name}
                    </span>
                    <span
                      className={
                        supplier.rating >= 90
                          ? "font-semibold text-emerald-dark"
                          : "font-semibold text-alert"
                      }
                    >
                      {supplier.rating.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-progress-track">
                    <div
                      className={`h-2 rounded-full ${
                        supplier.rating >= 90 ? "bg-emerald-dark" : "bg-alert"
                      }`}
                      style={{ width: `${supplier.rating}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Estimated Savings",
            value: euro(
              data.summary.estimatedWeeklySavings ??
                data.summary.estimatedProfitImpact,
            ),
            note: `${euro(Number(explainedSavings))} protected revenue + prevented waste`,
            accent: "text-emerald-dark",
          },
          {
            label: "Draft Orders",
            value: `${data.purchaseOrders.active.length} Pending`,
            note: `${euro(
              data.purchaseOrders.active.reduce(
                (sum, order) => sum + order.totalAmount,
                0,
              ),
            )} Total Value`,
            accent: "text-heading",
          },
          {
            label: "Shortage Risk",
            value: shortage?.product.name ?? "Low",
            note: shortage
              ? `Need ${shortage.requiredStock.toFixed(1)} ${shortage.product.unit} vs ${shortage.currentStock.toFixed(1)} on hand`
              : "No stockouts active",
            accent: "text-alert",
          },
          {
            label: "Waste Risk",
            value: waste?.product.name ?? "Low",
            note: waste
              ? `${waste.excessStock.toFixed(1)} ${waste.product.unit} overstock • ${euro(waste.financialImpact.potentialWasteCost)} at risk`
              : "No excess risk active",
            accent: "text-heading",
          },
        ].map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(17,38,31,0.04)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
              {card.label}
            </p>
            <p className={`mt-3 text-[18px] font-semibold ${card.accent}`}>
              {card.value}
            </p>
            <p className="mt-2 text-xs text-body">{card.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-heading">
              Today&apos;s Actions
            </h2>
            <span className="rounded-full bg-emerald-light px-2.5 py-1 text-[11px] font-semibold text-emerald-dark">
              {topActions.length} Tasks
            </span>
          </div>
          <div>
            {topActions.map((action, index) => (
              <div
                key={action.id}
                className={`flex items-start gap-4 px-5 py-5 ${
                  index !== topActions.length - 1
                    ? "border-b border-border"
                    : ""
                }`}
              >
                <div
                  className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full ${
                    action.type === "PURCHASE_ORDER"
                      ? "bg-[#d8fff0] text-emerald-dark"
                      : "bg-[#fff0ef] text-alert"
                  }`}
                >
                  {action.type === "PURCHASE_ORDER" ? (
                    <Truck className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-heading">
                    {action.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-body">
                    {action.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        action.type === "PURCHASE_ORDER"
                          ? void approveOrder(action.id)
                          : navigate("/purchasing")
                      }
                      className="rounded-lg bg-emerald-dark px-3 py-2 text-xs font-semibold text-white"
                    >
                      {action.type === "PURCHASE_ORDER"
                        ? "Approve Now"
                        : "Review Risk"}
                    </button>
                    <button
                      onClick={() => navigate("/purchasing")}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtitle"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-heading">
                    {euro(action.impact)}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-body">
                    {action.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-2xl border border-border bg-white p-5">
            <p className="text-sm font-semibold text-heading">
              Kitchen Throughput
            </p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-[34px] font-semibold text-heading">
                {(
                  100 -
                  data.evaluation.aggregate.stockoutSimulationRate * 100 -
                  data.evaluation.aggregate.wasteSimulationRate * 40
                ).toFixed(0)}
                %
              </span>
              <span className="text-sm text-body">Orders on-time</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-progress-track">
              <div
                className="h-2 rounded-full bg-[#6cf0bd]"
                style={{
                  width: `${clamp(
                    100 -
                      data.evaluation.aggregate.stockoutSimulationRate * 100 -
                      data.evaluation.aggregate.wasteSimulationRate * 40,
                    10,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-heading">
                Active Learning
              </p>
              <Check className="h-4 w-4 text-emerald-dark" />
            </div>
            <p className="mt-3 text-sm leading-6 text-body">
              Ingredient variance tracking is active. HVAS is learning how your
              kitchen portions run against recipe targets and adjusting reorder
              precision over time.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[#f6faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Avg absolute skew
                </p>
                <p className="mt-2 font-semibold text-heading">
                  {(
                    liveSimulation?.variance_summary
                      .average_absolute_skew_pct ?? 0
                  ).toFixed(1)}
                  %
                </p>
              </div>
              <div className="rounded-xl bg-[#f6faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Accuracy WAPE
                </p>
                <p className="mt-2 font-semibold text-heading">
                  {(data.evaluation.aggregate.wape * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-heading">
              Top Draft Orders
            </h2>
            <span className="text-sm font-medium text-emerald-dark">
              View All Purchasing
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-body">
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Total Value</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {topOrders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-5 py-4 text-sm font-medium text-heading">
                      {order.supplierName}
                    </td>
                    <td className="px-5 py-4 text-xs text-body">
                      {order.status === "NEEDS_REVIEW" ? "DAILY" : "STOCK"}
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {order.itemCount} SKUs
                    </td>
                    <td className="px-5 py-4 text-sm text-subtitle">
                      {euro(order.totalAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => navigate("/purchasing")}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-heading"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold text-heading">Operational Note</p>
          <p className="mt-3 text-sm leading-6 text-body">
            {liveSimulation?.recent_events[0] ??
              "No live simulation events recorded yet."}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-[#f4f8f6] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-body">
                Protected revenue
              </p>
              <p className="mt-2 text-2xl font-semibold text-heading">
                {euro(data.summary.protectedRevenue)}
              </p>
            </div>
            <div className="rounded-xl bg-[#f4f8f6] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-body">
                Forecast error
              </p>
              <p className="mt-2 text-2xl font-semibold text-heading">
                {data.evaluation.aggregate.rmse.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
