import type { OrderAdviceResponse } from "../api/client";

function formatTimestamp(value: string | null) {
  if (!value) return "Missing";
  return new Date(value).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function freshnessClass(status: "fresh" | "stale" | "missing") {
  if (status === "fresh") return "bg-[#ebfff6] text-emerald-dark";
  if (status === "stale") return "bg-[#fff8eb] text-[#9d6d1d]";
  return "bg-[#fff0ef] text-alert";
}

export default function ProductionStatusBanner({
  data,
  compact = false,
}: {
  data: OrderAdviceResponse;
  compact?: boolean;
}) {
  const blockingPreview = data.blockingIssues.slice(0, compact ? 2 : 4);
  const completeness = data.dataCompleteness;
  const hasIssues =
    data.dataFreshness.overall !== "fresh" || data.blockingIssues.length > 0;

  return (
    <section
      className={`rounded-2xl border ${
        hasIssues ? "border-[#f1d9a9] bg-[#fffdf7]" : "border-[#d6eadf] bg-[#f8fdfb]"
      } p-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-body">
            Production Data Status
          </p>
          <h2 className="mt-2 text-lg font-semibold text-heading">
            {hasIssues
              ? "Operational inputs need attention"
              : "Operational inputs are fresh and actionable"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-body">
            Snapshot built from imported sales, inventory counts, receipts, and waste.
            HVAS uses the latest persisted production advice run and keeps the
            simulation separated as a sandbox.
          </p>
        </div>
        <div className="grid gap-2 text-right text-xs text-body">
          <div>Last sales ingest: {formatTimestamp(data.sourceTimestamps.lastSalesIngestAt)}</div>
          <div>Last count: {formatTimestamp(data.sourceTimestamps.lastStockCountAt)}</div>
          <div>Last advice run: {formatTimestamp(data.sourceTimestamps.lastAdviceRunAt)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${freshnessClass(data.dataFreshness.sales)}`}>
          Sales {data.dataFreshness.sales}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${freshnessClass(data.dataFreshness.inventory)}`}>
          Inventory {data.dataFreshness.inventory}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${freshnessClass(data.dataFreshness.waste)}`}>
          Waste {data.dataFreshness.waste}
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "md:grid-cols-3" : "xl:grid-cols-[1fr_1fr_1.3fr]"}`}>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-body">
            Count coverage
          </p>
          <p className="mt-2 text-sm font-semibold text-heading">
            {completeness.countedProducts} / {completeness.totalProducts} products counted
          </p>
          <p className="mt-1 text-xs text-body">
            Measured stock is the anchor for current on-hand calculation.
          </p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-body">
            Sales coverage
          </p>
          <p className="mt-2 text-sm font-semibold text-heading">
            {completeness.sufficientSalesHistoryProducts} products have enough history
          </p>
          <p className="mt-1 text-xs text-body">
            Forecast confidence degrades when history drops below 14 days.
          </p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-body">
            Blocking issues
          </p>
          {blockingPreview.length > 0 ? (
            <div className="mt-2 space-y-2">
              {blockingPreview.map((issue, index) => (
                <p key={`${issue.productId}-${issue.code}-${index}`} className="text-sm text-heading">
                  {issue.message}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-emerald-dark">
              No blocking data issues in the current production snapshot.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
