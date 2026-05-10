import { useMemo, useRef, useState } from "react";
import { useSimulation } from "../useSimulation";
import { Package, Sliders, Trash } from "./Icons";
import { ErrorState, LoadingState } from "./PageState";
import ProductionStatusBanner from "./ProductionStatusBanner";

export default function IntelligencePage() {
  const { data, liveSimulation, saveInventory, loading, error, refresh } =
    useSimulation();
  const tableRef = useRef<HTMLElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Derive baseline stocks from data; user edits are stored as overrides on top.
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  const draftStocks = useMemo<Record<number, string>>(() => {
    if (!data) return overrides;
    const base: Record<number, string> = {};
    for (const item of data.products) {
      base[item.product.id] = String(item.currentStock);
    }
    return { ...base, ...overrides };
  }, [data, overrides]);

  function setDraftStock(productId: number, value: string) {
    setOverrides((prev) => ({ ...prev, [productId]: value }));
  }

  const changedItems = useMemo(() => {
    if (!data) return [];
    return data.products
      .map((item) => {
        const current = Number(draftStocks[item.product.id]);
        if (Number.isNaN(current) || current === item.currentStock) return null;
        return { productId: item.product.id, currentStock: current };
      })
      .filter(
        (item): item is { productId: number; currentStock: number } =>
          item !== null,
      );
  }, [data, draftStocks]);

  if (loading && !data) return <LoadingState title="Loading inventory intelligence..." />;
  if (!data)
    return (
      <ErrorState
        title="Inventory intelligence unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );

  const topTrends = (liveSimulation?.ingredient_usage ?? []).slice(0, 2);
  const tableItems = data.products.slice(0, 6);
  const countCritical = data.products.filter(
    (item) => item.currentStock < item.requiredStock,
  ).length;
  const countWaste = data.products.filter((item) => item.excessStock > 0).length;
  const totalPotentialWaste = data.products.reduce(
    (sum, item) => sum + item.financialImpact.potentialWasteCost,
    0,
  );

  return (
    <div className="space-y-5">
      <ProductionStatusBanner data={data} compact />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-heading">
            Inventory & Stock Intelligence
          </h1>
          <div className="mt-2 flex gap-6 text-sm">
            <span className="font-semibold text-emerald-dark">
              Current Inventory
            </span>
            <span className="text-subtitle">Stock Counts</span>
            <span className="text-subtitle">Waste Tracking</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-subtitle"
          >
            <Sliders className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white"
          >
            New Count
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Products Tracked
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {data.products.length}
          </p>
          <p className="mt-2 text-xs text-body">
            Live inventory positions in the current snapshot
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Below Required Stock
          </p>
          <p className="mt-3 text-[24px] font-semibold text-alert">
            {countCritical}
          </p>
          <p className="mt-2 text-xs text-body">
            Current stock less than demand during lead time + safety stock
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Overstocked Items
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {countWaste}
          </p>
          <p className="mt-2 text-xs text-body">
            Products currently carrying excess stock risk
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Potential Waste Cost
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {new Intl.NumberFormat("nl-NL", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(totalPotentialWaste)}
          </p>
          <p className="mt-2 text-xs text-body">
            Based on current excess stock and perishability risk
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.9fr]">
        <div ref={filtersRef} className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-heading">
              Top Learning Trends
            </p>
            <div className="mt-4 space-y-3">
              {topTrends.map((trend, index) => (
                <div
                  key={trend.ingredientId}
                  className={`rounded-xl p-3 ${
                    index === 0 ? "bg-[#e8fff5]" : "bg-[#f5efef]"
                  }`}
                >
                  <p className="text-sm font-semibold text-heading">
                    {trend.ingredientName} usage is{" "}
                    {trend.variancePct >= 0 ? "above" : "below"} target this
                    week.
                  </p>
                  <p className="mt-1 text-xs text-body">
                    Suggested action: review portion control or receive counts.
                    Learned multiplier {trend.learnedMultiplier.toFixed(2)}x with{" "}
                    {Math.round(trend.confidence * 100)}% confidence.
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-heading">Quick Filters</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-body">
                  Storage Area
                </label>
                <select className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-heading outline-none">
                  <option>All Storage Areas</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-body">
                  Category
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Proteins", "Dairy", "Dry Goods", "Produce"].map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        tag === "Proteins"
                          ? "bg-emerald-dark text-white"
                          : "bg-[#f2f5f3] text-subtitle"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-body">
                  Supplier
                </label>
                <select className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-heading outline-none">
                  <option>All Suppliers</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-dark p-4 text-white">
            <p className="text-sm font-semibold">Smart Count</p>
            <p className="mt-2 text-sm text-[#cae7dc]">
              {changedItems.length || 3} items flagged for high variance.
            </p>
            <div className="mt-4 space-y-2">
              {(liveSimulation?.variance_summary.low_stock_ingredients ?? [
                "Ribeye Steak",
                "Avocados",
              ]).slice(0, 2).map((item, index) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-lg bg-white/6 px-3 py-2 text-sm"
                >
                  <span>{item}</span>
                  <span className="text-[#ff8c82]">
                    {index === 0 ? "-14%" : "+9%"}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const firstCritical = tableItems.find((i) => i.currentStock < i.requiredStock);
                if (firstCritical) {
                  document.getElementById(`stock-input-${firstCritical.product.id}`)?.focus();
                  tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                } else {
                  tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="mt-5 w-full rounded-xl bg-[#b9ffd8] px-4 py-2.5 text-sm font-semibold text-emerald-darkest"
            >
              Start Priority Count
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section ref={tableRef} className="overflow-hidden rounded-2xl border border-border bg-white">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-body">
                  <th className="px-5 py-3">Product Name</th>
                  <th className="px-5 py-3">Current Stock</th>
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3">Last Counted</th>
                  <th className="px-5 py-3">Predicted Drift</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((item, index) => {
                  return (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf7f3] text-emerald-dark">
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-heading">
                              {item.product.name}
                            </p>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-body">
                              {item.product.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          value={draftStocks[item.product.id] ?? ""}
                          id={`stock-input-${item.product.id}`}
                          onChange={(event) =>
                            setDraftStock(item.product.id, event.target.value)
                          }
                          className={`w-24 rounded-lg border px-3 py-2 text-sm font-semibold outline-none ${
                            item.currentStock < item.product.safetyStock
                              ? "border-[#ffd8d5] text-alert"
                              : "border-border text-heading"
                          }`}
                        />
                      </td>
                      <td className="px-5 py-4 text-sm text-subtitle">
                        {item.product.unit}
                      </td>
                      <td className="px-5 py-4 text-sm text-subtitle">
                        {index === 0 ? "2h ago" : index === 1 ? "1d ago" : "4h ago"}
                        <p className="mt-1 text-xs text-body">
                          lead time {item.product.leadTimeDays}d
                        </p>
                      </td>
                      <td
                        className={`px-5 py-4 text-sm font-semibold ${
                          item.currentStock < item.requiredStock
                            ? "text-alert"
                            : "text-emerald-dark"
                        }`}
                      >
                        {item.currentStock < item.requiredStock
                          ? `${(item.currentStock - item.requiredStock).toFixed(1)} ${item.product.unit}`
                          : item.excessStock > 0
                            ? `+${item.excessStock.toFixed(1)} ${item.product.unit}`
                            : "Stable"}
                        <p className="mt-1 text-xs text-body">
                          req. {item.requiredStock.toFixed(1)} {item.product.unit}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => document.getElementById(`stock-input-${item.product.id}`)?.focus()}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            item.currentStock < item.requiredStock
                              ? "bg-alert text-white"
                            : "border border-border bg-white text-heading"
                          }`}
                        >
                          {item.currentStock < item.requiredStock ? "Re-count" : "Update"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="grid gap-3 border-t border-border px-5 py-4 md:grid-cols-3">
              <div className="rounded-xl bg-[#f7faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Calc: required stock
                </p>
                <p className="mt-2 text-sm text-heading">
                  expected demand during lead time + safety stock
                </p>
              </div>
              <div className="rounded-xl bg-[#f7faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Calc: shortage gap
                </p>
                <p className="mt-2 text-sm text-heading">
                  current stock - required stock
                </p>
              </div>
              <div className="rounded-xl bg-[#f7faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Calc: waste signal
                </p>
                <p className="mt-2 text-sm text-heading">
                  excess stock × perishability and waste risk percentage
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm text-body">
              <span>Showing {tableItems.length} of {data.products.length} products</span>
              <button
                type="button"
                onClick={() => void saveInventory(changedItems)}
                disabled={loading || changedItems.length === 0}
                className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Save {changedItems.length > 0 ? changedItems.length : ""} Updates
              </button>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <button onClick={() => alert('Arrival scanning coming soon.')} className="flex items-center gap-3 rounded-2xl border border-border bg-white px-5 py-5 text-left">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d9fff1] text-emerald-dark">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-heading">Scan Arrivals</p>
                <p className="text-sm text-body">
                  Batch import received stock from today&apos;s deliveries.
                </p>
              </div>
            </button>
            <button onClick={() => alert('Waste log coming soon.')} className="flex items-center gap-3 rounded-2xl border border-border bg-white px-5 py-5 text-left">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0ef] text-alert">
                <Trash className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-heading">Waste Log</p>
                <p className="text-sm text-body">
                  Record spoilage or kitchen errors for AI adjustment.
                </p>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
