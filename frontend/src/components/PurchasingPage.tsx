import { useMemo, useRef, useState } from "react";
import { useSimulation } from "../useSimulation";
import { ChevronRight, Package } from "./Icons";
import { ErrorState, LoadingState } from "./PageState";
import ProductionStatusBanner from "./ProductionStatusBanner";

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PurchasingPage() {
  const { data, approveOrder, loading, error, refresh } = useSimulation();
  const [activeTab, setActiveTab] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const supplierRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLElement>(null);

  const tabs = [
    "Draft Orders",
    "Supplier Performance",
    "Order History",
  ] as const;
  const tabRefs = [draftRef, supplierRef, historyRef];

  function handleTabClick(index: number) {
    setActiveTab(index);
    setTimeout(
      () =>
        tabRefs[index]?.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50,
    );
  }

  const supplierMetrics = useMemo(() => {
    if (!data) return [];
    return data.purchaseOrders.active.map((order) => {
      const linkedItems = data.products.filter(
        (item) => item.product.supplierName === order.supplierName,
      );
      const reviewRate =
        linkedItems.length > 0
          ? linkedItems.filter((item) => item.advice === "NEEDS_REVIEW")
              .length / linkedItems.length
          : 0;
      const avgLeadTime =
        linkedItems.length > 0
          ? linkedItems.reduce(
              (sum, item) => sum + item.product.leadTimeDays,
              0,
            ) / linkedItems.length
          : 0;
      const onTimeDelivery = Math.max(
        72,
        100 - avgLeadTime * 4 - reviewRate * 18,
      );
      return {
        name: order.supplierName,
        onTimeDelivery,
        pricingVolatility:
          reviewRate > 0.2 ? "High review load" : "Stable order profile",
        protectedRevenue: order.summary.totalProtectedRevenue,
        totalCost: order.totalAmount,
        reviewRate,
      };
    });
  }, [data]);

  if (loading && !data)
    return <LoadingState title="Loading purchasing data..." />;
  if (!data)
    return (
      <ErrorState
        title="Purchasing data unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );

  const draftOrders = data.purchaseOrders.active.slice(0, 2);
  const categories = useMemo(
    () => [...new Set(data.products.map((p) => p.product.category))],
    [data],
  );
  const urgencies = ["high", "medium", "low"] as const;
  const adviceRows = data.products
    .filter((p) => !categoryFilter || p.product.category === categoryFilter)
    .filter((p) => !urgencyFilter || p.urgency === urgencyFilter)
    .slice(0, 4);
  const purchaseHistory = data.purchaseOrders.history.slice(0, 4);
  const totalDraftValue = data.purchaseOrders.active.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );
  const protectedRevenue = data.purchaseOrders.active.reduce(
    (sum, order) => sum + order.summary.totalProtectedRevenue,
    0,
  );

  return (
    <div className="space-y-5">
      <ProductionStatusBanner data={data} compact />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-heading">
            Purchasing & Inventory Intelligence
          </h1>
          <p className="mt-1 text-sm text-body">
            Manage algorithmic procurement and strategic supplier fulfillment.
          </p>
        </div>
        <div className="rounded-xl bg-white p-1 shadow-[0_6px_24px_rgba(17,38,31,0.05)]">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              onClick={() => handleTabClick(index)}
              className={`rounded-sm px-4 py-2 text-sm font-medium ${
                activeTab === index
                  ? "bg-[#f5faf7] text-emerald-dark"
                  : "text-subtitle"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Draft POs
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {data.purchaseOrders.active.length}
          </p>
          <p className="mt-2 text-xs text-body">
            {
              data.purchaseOrders.active.filter(
                (po) => po.status === "NEEDS_REVIEW",
              ).length
            }{" "}
            require manual review
          </p>
        </article>
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Total Draft Value
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {euro(totalDraftValue)}
          </p>
          <p className="mt-2 text-xs text-body">
            Sum of all prepared purchase order amounts
          </p>
        </article>
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Revenue Protected
          </p>
          <p className="mt-3 text-[24px] font-semibold text-heading">
            {euro(protectedRevenue)}
          </p>
          <p className="mt-2 text-xs text-body">
            Aggregated from linked product advice impact
          </p>
        </article>
        <article className="rounded-md border border-border bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-body">
            Formula Snapshot
          </p>
          <p className="mt-3 text-sm font-semibold text-heading">
            reorder qty × cost price = PO line cost
          </p>
          <p className="mt-2 text-xs text-body">
            Supplier urgency comes from linked product advice and lead time
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_0.8fr]">
        <div ref={draftRef} className="space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-heading">
                Pending Approvals
              </p>
              <span className="text-sm font-medium text-emerald-dark">
                View All Drafts
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {draftOrders.map((order, index) => (
                <article
                  key={order.id}
                  className="rounded-2xl border border-border bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#edf7f3] text-emerald-dark">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-heading">
                          {order.supplierName}
                        </p>
                        <p className="text-xs text-body">
                          {index === 0
                            ? "Daily catch fulfillment"
                            : "Organic local greens"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#e7fff5] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-dark">
                      {order.status === "NEEDS_REVIEW"
                        ? "AI Suggested"
                        : "Manual Draft"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs text-body">
                    <div>
                      <p>Value</p>
                      <p className="mt-1 text-sm font-semibold text-heading">
                        {euro(order.totalAmount)}
                      </p>
                    </div>
                    <div>
                      <p>Items</p>
                      <p className="mt-1 text-sm font-semibold text-heading">
                        {order.itemCount} SKUs
                      </p>
                    </div>
                    <div>
                      <p>ETA</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-dark">
                        {new Date(
                          order.expectedDeliveryDate,
                        ).toLocaleDateString("nl-NL")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void approveOrder(order.id)}
                    className="mt-4 w-full rounded-sm bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Approve Order
                  </button>
                </article>
              ))}
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <p className="text-sm font-semibold text-heading">
                Product Advice Intelligence
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCategoryFilter((prev) => {
                      const idx = categories.indexOf(prev ?? "");
                      return idx < categories.length - 1
                        ? (categories[idx + 1] ?? null)
                        : null;
                    })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtitle"
                >
                  {categoryFilter ?? "All Categories"}
                </button>
                <button
                  onClick={() =>
                    setUrgencyFilter((prev) => {
                      const idx = urgencies.indexOf(
                        prev as (typeof urgencies)[number],
                      );
                      return idx < urgencies.length - 1
                        ? (urgencies[idx + 1] ?? null)
                        : null;
                    })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtitle"
                >
                  {urgencyFilter
                    ? `${urgencyFilter.charAt(0).toUpperCase()}${urgencyFilter.slice(1)} Urgency`
                    : "All Urgency"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.12em] text-body">
                    <th className="px-5 py-3">Product Name</th>
                    <th className="px-5 py-3">Inventory</th>
                    <th className="px-5 py-3">Urgency</th>
                    <th className="px-5 py-3">Predicted Demand</th>
                    <th className="px-5 py-3">Recommended</th>
                    <th className="px-5 py-3">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {adviceRows.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-heading">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-body">
                          {item.product.category} • {item.product.supplierName}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-subtitle">
                        {item.currentStock} {item.unit}
                        <p className="mt-1 text-xs text-body">
                          Need {item.requiredStock.toFixed(1)} {item.unit}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            item.urgency === "high"
                              ? "bg-[#fff0ef] text-alert"
                              : item.urgency === "medium"
                                ? "bg-[#fff8eb] text-[#9d6d1d]"
                                : "bg-[#ebfff6] text-emerald-dark"
                          }`}
                        >
                          {item.urgency}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-emerald-dark">
                        {item.expectedDemandDuringLeadTime} {item.unit}
                        <p className="mt-1 text-xs text-body">
                          confidence {item.confidenceScore.toFixed(0)}%
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-subtitle">
                        {item.reorderQuantity > 0
                          ? `${item.reorderQuantity} ${item.unit}`
                          : "--"}
                        <p className="mt-1 text-xs text-body">
                          safety stock {item.product.safetyStock} {item.unit}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-heading">
                        {euro(item.financialImpact.estimatedProfitImpact)}
                        <p className="mt-1 text-xs text-body">
                          lost revenue{" "}
                          {euro(item.financialImpact.potentialLostRevenue)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 border-t border-border px-5 py-4 md:grid-cols-3">
              <div className="rounded-sm bg-[#f7faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Calc: required stock
                </p>
                <p className="mt-2 text-sm text-heading">
                  demand during lead time + safety stock
                </p>
              </div>
              <div className="rounded-sm bg-[#f7faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Calc: reorder qty
                </p>
                <p className="mt-2 text-sm text-heading">
                  max(0, required stock - current stock), rounded to reorder
                  multiple
                </p>
              </div>
              <div className="rounded-sm bg-[#f7faf8] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-body">
                  Calc: PO impact
                </p>
                <p className="mt-2 text-sm text-heading">
                  protected revenue minus avoidable shortage / waste risk
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section
            ref={supplierRef}
            className="rounded-2xl bg-emerald-dark p-5 text-white"
          >
            <p className="text-sm font-semibold">Procurement Actions</p>
            <button
              onClick={() =>
                draftRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="mt-5 flex w-full items-center justify-between rounded-sm bg-[#073829] px-4 py-3 text-sm font-semibold"
            >
              Create New Manual PO
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const rows = data.purchaseOrders.active;
                const csv = [
                  [
                    "Supplier",
                    "Items",
                    "Total",
                    "Expected Delivery",
                    "Status",
                  ].join(","),
                  ...rows.map((o) =>
                    [
                      `"${o.supplierName}"`,
                      o.itemCount,
                      o.totalAmount.toFixed(2),
                      new Date(o.expectedDeliveryDate).toLocaleDateString(
                        "nl-NL",
                      ),
                      o.status,
                    ].join(","),
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="mt-3 flex w-full items-center justify-between rounded-sm border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-[#c6e0d8]"
            >
              Export for ERP
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <p className="text-sm font-semibold text-heading">
              Supplier Performance
            </p>
            <div className="mt-5 space-y-5">
              {supplierMetrics.slice(0, 2).map((supplier) => (
                <div key={supplier.name}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-heading">
                      {supplier.name}
                    </p>
                    <span
                      className={`text-sm font-semibold ${
                        supplier.onTimeDelivery > 90
                          ? "text-emerald-dark"
                          : "text-alert"
                      }`}
                    >
                      {supplier.onTimeDelivery > 90 ? "A+ Rating" : "B Rating"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-body">On-time Delivery</p>
                  <div className="mt-2 h-2 rounded-full bg-progress-track">
                    <div
                      className={`h-2 rounded-full ${
                        supplier.onTimeDelivery > 90
                          ? "bg-emerald-dark"
                          : "bg-alert"
                      }`}
                      style={{ width: `${supplier.onTimeDelivery}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-body">
                    <span>Pricing Volatility</span>
                    <span>{supplier.pricingVolatility}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-body">
                    <span>Review Rate</span>
                    <span>{(supplier.reviewRate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-body">
                    <span>Protected Revenue</span>
                    <span>{euro(supplier.protectedRevenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="p-5">
              <p className="text-sm font-semibold text-heading">
                Market Pricing Trends
              </p>
              <div className="mt-5 flex h-24 items-end gap-1 rounded-xl bg-[#f7faf8] p-4">
                {[28, 40, 52, 48, 66, 74, 79].map((bar, index) => (
                  <div
                    key={index}
                    className={`flex-1 rounded-t-[4px] ${
                      index === 6
                        ? "bg-alert"
                        : index >= 4
                          ? "bg-emerald-dark"
                          : "bg-[#b6d8ca]"
                    }`}
                    style={{ height: `${bar}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="h-32 bg-gradient-to-r from-[#0d5a43] via-[#1f7d61] to-[#d7e4de] p-4 text-white">
              <p className="text-xs uppercase tracking-[0.14em] text-white/75">
                Logistics Status
              </p>
              <p className="mt-2 text-xl font-semibold">
                {data.purchaseOrders.history.length} Active Deliveries
              </p>
            </div>
          </section>
        </div>
      </section>

      <section
        ref={historyRef}
        className="overflow-hidden rounded-2xl border border-border bg-white"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-heading">Order History</p>
          <span className="text-sm text-body">
            {purchaseHistory.length} recent processed orders
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-body">
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Delivery</th>
                <th className="px-5 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {purchaseHistory.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-5 py-4 text-sm font-medium text-heading">
                    {item.supplierName}
                  </td>
                  <td className="px-5 py-4 text-sm text-subtitle">
                    {item.status}
                  </td>
                  <td className="px-5 py-4 text-sm text-subtitle">
                    {item.itemCount}
                  </td>
                  <td className="px-5 py-4 text-sm text-subtitle">
                    {euro(item.totalAmount)}
                  </td>
                  <td className="px-5 py-4 text-sm text-subtitle">
                    {new Date(item.expectedDeliveryDate).toLocaleDateString(
                      "nl-NL",
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-subtitle">
                    {new Date(item.updatedAt).toLocaleString("nl-NL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
