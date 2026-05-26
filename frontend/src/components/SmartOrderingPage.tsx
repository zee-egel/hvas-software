import { useEffect, useState } from "react";
import {
  createSmartOrderDraft,
  fetchSmartOrderingForecast,
  placeSmartOrders,
  type SmartOrderSuggestion,
  type SmartOrderingForecastResponse,
  type SmartSupplierOrderDraft,
} from "../api/client";
import {
  AlertTriangle,
  Check,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Trash,
  Truck,
} from "./Icons";
import { ErrorState, LoadingState } from "./PageState";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

const warningLabels: Record<string, string> = {
  NO_SUPPLIER_LINKED: "No supplier linked",
  MISSING_STOCK_DATA: "Missing stock data",
  LOW_CONFIDENCE: "Low confidence",
  PACKAGE_OVER_ORDER: "Package over-order",
  BELOW_MINIMUM_STOCK: "Below minimum stock",
  OUT_OF_STOCK: "Out of stock",
  SUPPLIER_UNAVAILABLE: "Supplier unavailable",
};

export default function SmartOrderingPage() {
  const [days, setDays] = useState(4);
  const [includeCurrentStock, setIncludeCurrentStock] = useState(true);
  const [includeOutstandingOrders, setIncludeOutstandingOrders] = useState(true);
  const [forecast, setForecast] = useState<SmartOrderingForecastResponse | null>(null);
  const [draftResponse, setDraftResponse] = useState<{
    draftOrders: SmartSupplierOrderDraft[];
    summary: {
      supplierCount: number;
      totalProducts: number;
      estimatedTotalCost: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftLoading, setDraftLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [confirmedDraftIds, setConfirmedDraftIds] = useState<string[]>([]);
  const [placementSummary, setPlacementSummary] = useState<string | null>(null);

  function resetInteractiveState() {
    setAcceptedIds([]);
    setRemovedIds([]);
    setDraftResponse(null);
    setConfirmedDraftIds([]);
    setPlacementSummary(null);
  }

  function applyForecast(nextForecast: SmartOrderingForecastResponse) {
    setForecast(nextForecast);
    setQuantities(
      Object.fromEntries(
        nextForecast.suggestions.map((item) => [
          item.productId,
          item.suggestedQuantity,
        ]),
      ),
    );
    resetInteractiveState();
  }

  async function loadPage() {
    setLoading(true);
    setError(null);
    try {
      const forecastResult = await fetchSmartOrderingForecast({
        days,
        includeCurrentStock,
        includeOutstandingOrders,
      });
      applyForecast(forecastResult);
    } catch (loadError) {
      console.error("Failed to load smart ordering forecast", loadError);
      setError("Could not load smart ordering suggestions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removedIdSet = new Set(removedIds);
  const acceptedIdSet = new Set(acceptedIds);
  const confirmedDraftIdSet = new Set(confirmedDraftIds);
  const visibleSuggestions = (forecast?.suggestions ?? []).filter(
    (item) => !removedIdSet.has(item.productId),
  );
  const acceptedCount = visibleSuggestions.filter((item) =>
    acceptedIdSet.has(item.productId),
  ).length;

  async function refreshForecast() {
    setLoading(true);
    setError(null);
    try {
      const nextForecast = await fetchSmartOrderingForecast({
        days,
        includeCurrentStock,
        includeOutstandingOrders,
      });
      applyForecast(nextForecast);
    } catch (loadError) {
      console.error(loadError);
      setError("Could not generate order suggestions.");
    } finally {
      setLoading(false);
    }
  }

  async function createDrafts() {
    setDraftLoading(true);
    setError(null);
    try {
      const response = await createSmartOrderDraft({
        days,
        includeCurrentStock,
        includeOutstandingOrders,
        suggestions: visibleSuggestions.map((item) => ({
          productId: item.productId,
          accepted: acceptedIdSet.has(item.productId),
          quantity: quantities[item.productId] ?? item.suggestedQuantity,
          unit: item.unit,
          supplierId: item.supplierId,
        })),
      });
      setDraftResponse({
        draftOrders: response.draftOrders,
        summary: response.summary,
      });
      setConfirmedDraftIds([]);
      setPlacementSummary(null);
    } catch (draftError) {
      console.error(draftError);
      setError("Could not create supplier drafts.");
    } finally {
      setDraftLoading(false);
    }
  }

  async function handlePlaceOrders() {
    if (confirmedDraftIds.length === 0) return;
    setPlacing(true);
    setError(null);
    try {
      const response = await placeSmartOrders(confirmedDraftIds);
      setPlacementSummary(
        `${response.orders.length} supplier orders simulated on ${new Date(
          response.placedAt,
        ).toLocaleString("nl-NL")}.`,
      );
      setConfirmedDraftIds([]);
    } catch (placementError) {
      console.error(placementError);
      setError("Could not simulate supplier order placement.");
    } finally {
      setPlacing(false);
    }
  }

  function updateQuantity(productId: number, nextValue: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Number(nextValue.toFixed(1))),
    }));
    setDraftResponse(null);
  }

  if (loading && !forecast) {
    return <LoadingState title="Generating smart order suggestions..." />;
  }

  if (error && !forecast) {
    return (
      <ErrorState
        title="Smart ordering unavailable"
        message={error}
        onRetry={() => void loadPage()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-white px-6 py-6 shadow-[0_20px_60px_rgba(19,52,43,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
              Automatic Ordering Assistant
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-heading">
              Demand forecasting for the next order
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-body">
              The API calculates demand, order quantities, warnings, and supplier drafts. The horeca owner only adjusts and confirms.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshForecast()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-[#f7faf8] px-4 py-2.5 text-sm font-medium text-heading transition-colors hover:bg-[#eef5f1] disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh suggestions
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-[26px] border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
              Order configuration
            </p>
            <div className="mt-5 rounded-2xl bg-[#f5f8f6] p-4">
              <p className="text-sm font-medium text-subtitle">Order for</p>
              <p className="mt-1 text-3xl font-semibold text-heading">{days} days</p>
              <p className="mt-2 text-sm text-body">
                {forecast
                  ? `Next ${days} days: ${formatDate(forecast.period.start)} to ${formatDate(
                      forecast.period.end,
                    )}`
                  : "Preparing range"}
              </p>
              <input
                type="range"
                min={1}
                max={14}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="mt-5 h-2 w-full accent-[#0d5a43]"
              />
              <div className="mt-2 flex justify-between text-xs text-body">
                <span>1 day</span>
                <span>14 days</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-[#fffdfa] p-4">
              <p className="text-sm font-medium text-heading">Forecast basis</p>
              <p className="mt-2 text-sm leading-6 text-body">
                Based on recent sales, stock, supplier package sizes, and incoming orders.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 rounded-2xl border border-border p-3">
                <input
                  type="checkbox"
                  checked={includeCurrentStock}
                  onChange={(event) => setIncludeCurrentStock(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#0d5a43]"
                />
                <span>
                  <span className="block text-sm font-medium text-heading">
                    Take current stock into account
                  </span>
                  <span className="block text-xs text-body">
                    Uses the latest counted stock level to reduce over-ordering.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-border p-3">
                <input
                  type="checkbox"
                  checked={includeOutstandingOrders}
                  onChange={(event) =>
                    setIncludeOutstandingOrders(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-[#0d5a43]"
                />
                <span>
                  <span className="block text-sm font-medium text-heading">
                    Take outstanding order quantities into account
                  </span>
                  <span className="block text-xs text-body">
                    Subtracts incoming supplier quantities that are already on the way.
                  </span>
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void refreshForecast()}
              disabled={loading}
              className="mt-5 w-full rounded-2xl bg-emerald-dark px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(13,90,67,0.22)] transition-opacity hover:opacity-92 disabled:opacity-60"
            >
              Generate order suggestions
            </button>
          </div>

          <div className="grid gap-3">
            <article className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-body">
                Expected revenue
              </p>
              <p className="mt-2 text-2xl font-semibold text-heading">
                {formatCurrency(forecast?.summary.expectedRevenue ?? 0)}
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-body">
                Expected covers / orders
              </p>
              <p className="mt-2 text-2xl font-semibold text-heading">
                {forecast?.summary.expectedCovers ?? 0}
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-body">
                Forecast confidence
              </p>
              <p className="mt-2 text-2xl font-semibold capitalize text-heading">
                {forecast?.summary.confidence ?? "medium"}
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-body">
                Context loaded
              </p>
              <p className="mt-2 text-2xl font-semibold text-heading">
                {forecast?.suggestions.length ?? 0}
              </p>
              <p className="mt-1 text-xs text-body">products ready for ordering</p>
            </article>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="rounded-[26px] border border-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-dark" />
                  <h2 className="text-2xl font-semibold text-heading">
                    Order suggestions
                  </h2>
                </div>
                <p className="mt-2 text-sm text-body">
                  The API already calculated expected usage, stock correction, package rounding, and warnings.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAcceptedIds(visibleSuggestions.map((item) => item.productId))}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-heading"
                >
                  Accept all suggestions
                </button>
                <div className="rounded-full bg-[#f4f8f5] px-4 py-2 text-sm text-body">
                  {acceptedCount} accepted
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[1120px] w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-body">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Expected usage</th>
                    <th className="pb-2">Current stock</th>
                    <th className="pb-2">Suggested order</th>
                    <th className="pb-2">Unit</th>
                    <th className="pb-2">Supplier</th>
                    <th className="pb-2">Package</th>
                    <th className="pb-2">Adjust quantity</th>
                    <th className="pb-2">Status / warning</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSuggestions.map((suggestion: SmartOrderSuggestion) => {
                    const quantity = quantities[suggestion.productId] ?? suggestion.suggestedQuantity;
                    const accepted = acceptedIdSet.has(suggestion.productId);
                    return (
                      <tr key={suggestion.productId} className="rounded-2xl bg-[#fbfcfb] text-sm text-heading">
                        <td className="rounded-l-2xl border-y border-l border-border px-4 py-4 align-top">
                          <p className="font-semibold">{suggestion.productName}</p>
                          <p className="mt-1 text-xs text-body">{suggestion.category}</p>
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top">
                          <p className="font-medium">{suggestion.expectedUsage} {suggestion.unit}</p>
                          <p className="mt-1 text-xs text-body">
                            Avg/day {suggestion.averageDailyUsage}
                          </p>
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top">
                          <p>{suggestion.currentStock} {suggestion.unit}</p>
                          {suggestion.outstandingIncomingQuantity > 0 ? (
                            <p className="mt-1 text-xs text-body">
                              Incoming {suggestion.outstandingIncomingQuantity}
                            </p>
                          ) : null}
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top font-semibold">
                          {suggestion.suggestedQuantity}
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top">
                          {suggestion.unit}
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top">
                          {suggestion.supplierName ?? "No supplier linked"}
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top">
                          {suggestion.packageLabel}
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  suggestion.productId,
                                  Math.max(0, quantity - suggestion.packageQuantity),
                                )
                              }
                              className="rounded-full border border-border p-2 text-subtitle"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              step={suggestion.packageQuantity >= 1 ? 1 : 0.5}
                              value={quantity}
                              onChange={(event) =>
                                updateQuantity(
                                  suggestion.productId,
                                  Number(event.target.value || 0),
                                )
                              }
                              className="w-20 rounded-xl border border-border bg-white px-3 py-2 text-center text-sm outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  suggestion.productId,
                                  quantity + suggestion.packageQuantity,
                                )
                              }
                              className="rounded-full border border-border p-2 text-subtitle"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="border-y border-border px-4 py-4 align-top">
                          <div className="flex items-center gap-2">
                            {suggestion.warnings.length > 0 ? (
                              <AlertTriangle className="h-4 w-4 text-[#bb6a23]" />
                            ) : (
                              <Check className="h-4 w-4 text-emerald-dark" />
                            )}
                            <span className="font-medium capitalize">
                              {suggestion.confidence}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {suggestion.warnings.map((warning) => (
                              <span
                                key={`${suggestion.productId}-${warning}`}
                                className="rounded-full bg-[#fff5e8] px-2 py-1 text-[11px] font-medium text-[#8a541a]"
                              >
                                {warningLabels[warning]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="rounded-r-2xl border-y border-r border-border px-4 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setAcceptedIds((current) =>
                                  current.includes(suggestion.productId)
                                    ? current.filter((item) => item !== suggestion.productId)
                                    : [...current, suggestion.productId],
                                )
                              }
                              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                                accepted
                                  ? "bg-emerald-dark text-white"
                                  : "border border-border text-heading"
                              }`}
                            >
                              {accepted ? "Accepted" : "Accept"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRemovedIds((current) => [...current, suggestion.productId])
                              }
                              className="rounded-full border border-[#f3d6d4] p-2 text-alert"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void createDrafts()}
                disabled={draftLoading || acceptedCount === 0}
                className="rounded-2xl bg-emerald-dark px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {draftLoading ? "Creating drafts..." : "Create supplier drafts"}
              </button>
            </div>
          </section>

          <section className="rounded-[26px] border border-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
                  Review supplier orders
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-heading">
                  Grouped by supplier on the API
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfirmedDraftIds(
                    draftResponse?.draftOrders.map((order) => order.draftOrderId) ?? [],
                  )
                }
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-heading"
              >
                Confirm all
              </button>
            </div>

            {!draftResponse || draftResponse.draftOrders.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-[#f8fbf9] p-6 text-sm text-body">
                Accept suggestions and create supplier drafts to continue to review.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {draftResponse.draftOrders.map((order) => {
                  const confirmed = confirmedDraftIdSet.has(order.draftOrderId);
                  return (
                    <article
                      key={order.draftOrderId}
                      className="rounded-3xl border border-border bg-[#fbfcfb] p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-emerald-dark" />
                            <h3 className="text-lg font-semibold text-heading">
                              {order.supplierName}
                            </h3>
                          </div>
                          <p className="mt-2 text-sm text-body">{order.deliveryNote}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmedDraftIds((current) =>
                              current.includes(order.draftOrderId)
                                ? current.filter((item) => item !== order.draftOrderId)
                                : [...current, order.draftOrderId],
                            )
                          }
                          className={`rounded-full px-3 py-2 text-xs font-semibold ${
                            confirmed
                              ? "bg-emerald-dark text-white"
                              : "border border-border text-heading"
                          }`}
                        >
                          {confirmed ? "Confirmed" : "Confirm"}
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-body">Products</p>
                          <p className="mt-1 font-semibold text-heading">{order.totalProducts}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-body">Estimated cost</p>
                          <p className="mt-1 font-semibold text-heading">
                            {formatCurrency(order.estimatedTotalCost)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-body">ETA</p>
                          <p className="mt-1 font-semibold text-heading">
                            {order.expectedDeliveryDate
                              ? formatDate(order.expectedDeliveryDate)
                              : "TBD"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {order.productLines.map((line) => (
                          <div
                            key={`${order.draftOrderId}-${line.productId}`}
                            className="rounded-2xl border border-border bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-heading">{line.productName}</p>
                              <p className="text-sm text-heading">
                                {line.quantity} {line.unit}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 rounded-3xl bg-[#17342b] px-5 py-5 text-white lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-[#b8d0c6]">
                  Confirmed supplier drafts
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {confirmedDraftIds.length} ready to place
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handlePlaceOrders()}
                disabled={placing || confirmedDraftIds.length === 0}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-emerald-dark disabled:opacity-60"
              >
                {placing ? "Placing..." : "Place orders"}
              </button>
            </div>

            {placementSummary ? (
              <div className="mt-4 rounded-2xl border border-[#cce9df] bg-[#f4fbf8] px-4 py-3 text-sm text-heading">
                {placementSummary}
              </div>
            ) : null}
            {error && forecast ? (
              <div className="mt-4 rounded-2xl border border-[#ffd8d5] bg-[#fff9f8] px-4 py-3 text-sm text-alert">
                {error}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
