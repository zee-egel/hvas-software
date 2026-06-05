import { useDeferredValue, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createSmartOrderDraft,
  fetchSmartOrderingForecast,
  placeSmartOrders,
  type SmartOrderSuggestion,
  type SmartOrderingForecastResponse,
  type SmartSupplierOrderDraft,
} from "../api/client";
import { useAuth } from "../AuthContext";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash,
  Truck,
  X,
} from "./Icons";
import { ErrorState } from "./PageState";
import Skeleton from "./Skeleton";
import ConfettiFireworks from "./ui/ConfettiFireworks";

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

type PlacementEmailPreview = {
  supplierName: string;
  recipient: string;
  subject: string;
  body: string;
};

export default function SmartOrderingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [days, setDays] = useState(4);
  const [includeCurrentStock, setIncludeCurrentStock] = useState(true);
  const [includeOutstandingOrders, setIncludeOutstandingOrders] =
    useState(true);
  const [forecast, setForecast] =
    useState<SmartOrderingForecastResponse | null>(null);
  const [draftResponse, setDraftResponse] = useState<{
    draftOrders: SmartSupplierOrderDraft[];
    summary: {
      supplierCount: number;
      totalProducts: number;
      estimatedTotalCost: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [confirmedDraftIds, setConfirmedDraftIds] = useState<string[]>([]);
  const [placementSummary, setPlacementSummary] = useState<string | null>(null);
  const [placementEmails, setPlacementEmails] = useState<PlacementEmailPreview[]>(
    [],
  );
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<SmartOrderSuggestion | null>(null);
  const [search, setSearch] = useState("");
  const [confettiActive, setConfettiActive] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const needsProductImport = user?.workspaceMode === "starter";

  useEffect(() => {
    if (!confettiActive) return;

    const timeoutId = window.setTimeout(() => {
      setConfettiActive(false);
    }, 4800);

    return () => window.clearTimeout(timeoutId);
  }, [confettiActive]);

  function resetInteractiveState() {
    setAcceptedIds([]);
    setRemovedIds([]);
    setDraftResponse(null);
    setConfirmedDraftIds([]);
    setPlacementSummary(null);
    setPlacementEmails([]);
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

  function triggerFireworks() {
    setConfettiActive(false);
    window.setTimeout(() => {
      setConfettiActive(true);
    }, 10);
  }

  function supplierRecipient(supplierName: string) {
    const slug = supplierName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    return `orders@${slug || "supplier"}.com`;
  }

  function buildPlacementEmails(
    draftOrders: SmartSupplierOrderDraft[],
    draftIds: string[],
  ): PlacementEmailPreview[] {
    return draftOrders
      .filter((order) => draftIds.includes(order.draftOrderId))
      .map((order) => ({
        supplierName: order.supplierName,
        recipient: supplierRecipient(order.supplierName),
        subject: `Purchase order for ${order.supplierName} · ${formatDate(order.expectedDeliveryDate)}`,
        body: [
          `Hello ${order.supplierName},`,
          "",
          "Please find our order request below:",
          ...order.productLines.map(
            (line) =>
              `- ${line.productName} (${line.productCode}): ${line.quantity} ${line.unit}`,
          ),
          "",
          `Requested delivery: ${formatDate(order.expectedDeliveryDate)}`,
          `Estimated total: ${formatCurrency(order.estimatedTotalCost)}`,
          "",
          "Please confirm availability and delivery timing.",
          "",
          `${user?.companyName ?? "HVAS Customer"}`,
        ].join("\n"),
      }));
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

  const removedIdSet = new Set(removedIds);
  const acceptedIdSet = new Set(acceptedIds);
  const confirmedDraftIdSet = new Set(confirmedDraftIds);
  const baseVisibleSuggestions = (forecast?.suggestions ?? []).filter(
    (item) => !removedIdSet.has(item.productId),
  );
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const visibleSuggestions = baseVisibleSuggestions.filter((item) => {
    if (!normalizedSearch) return true;
    const haystack = [
      item.productCode,
      item.productName,
      item.supplierName ?? "",
      item.category,
      item.packageLabel,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });
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
      const emailPreviews = buildPlacementEmails(
        draftResponse?.draftOrders ?? [],
        confirmedDraftIds,
      );
      const response = await placeSmartOrders(confirmedDraftIds);
      setPlacementSummary(
        `${response.orders.length} supplier order${
          response.orders.length > 1 ? "s" : ""
        } placed on ${new Date(response.placedAt).toLocaleString("nl-NL")}.`,
      );
      setPlacementEmails(emailPreviews);
      triggerFireworks();
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
      <ConfettiFireworks active={confettiActive} />

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
              HVAS calculates demand, order quantities, warnings, and supplier drafts from imported products, purchase history, and stock counts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshForecast()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-[#f7faf8] px-4 py-2.5 text-sm font-medium text-heading transition-colors hover:bg-[#eef5f1] disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {forecast ? "Refresh suggestions" : "Generate suggestions"}
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-[26px] border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
              Order configuration
            </p>
            <div className="mt-5 rounded-2xl bg-[#f5f8f6] p-4">
              <p className="text-sm font-medium text-subtitle">Order for</p>
              <p className="mt-1 text-3xl font-semibold text-heading">
                {days} days
              </p>
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

            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 rounded-2xl border border-border p-3">
                <input
                  type="checkbox"
                  checked={includeCurrentStock}
                  onChange={(event) =>
                    setIncludeCurrentStock(event.target.checked)
                  }
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
            {forecast ? (
              <div className="mt-5 rounded-2xl bg-[#f6f8f6] px-4 py-4 text-sm text-[#5f6a65]">
                {forecast.suggestions.length} suggestions ·{" "}
                {forecast.summary.expectedCovers} expected units ·{" "}
                {forecast.summary.confidence} confidence
              </div>
            ) : loading ? (
              <div className="mt-5 rounded-2xl bg-[#f6f8f6] px-4 py-4">
                <Skeleton className="h-4 w-40" />
              </div>
            ) : null}
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
                  Review, adjust, and accept what should be ordered next.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="relative min-w-60 flex-1 lg:max-w-xs">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search product, supplier, category"
                    className="w-full rounded-full border border-border bg-[#f8fbf9] py-2 pl-10 pr-4 text-sm text-heading placeholder:text-body focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setAcceptedIds(
                      visibleSuggestions.map((item) => item.productId),
                    )
                  }
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-heading"
                >
                  Accept all suggestions
                </button>
                <div className="rounded-full bg-[#f4f8f5] px-4 py-2 text-sm text-body">
                  {acceptedCount} accepted
                </div>
              </div>
            </div>

            {loading && !forecast ? (
              <div className="mt-5 h-128 overflow-auto rounded-2xl border border-border bg-white p-3">
                <div className="space-y-2">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                  ))}
                </div>
              </div>
            ) : !forecast ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-[#f8fbf9] p-8 text-center">
                <p className="text-base font-medium text-heading">
                  No suggestions loaded yet
                </p>
                <p className="mt-2 text-sm text-body">
                  {needsProductImport
                    ? "Import products first so HVAS has real items to forecast."
                    : "Generate suggestions to start the ordering flow."}
                </p>
                {needsProductImport ? (
                  <button
                    type="button"
                    onClick={() => navigate("/data-setup")}
                    className="mt-4 rounded-full bg-emerald-dark px-4 py-2 text-sm font-semibold text-white"
                  >
                    Import products
                  </button>
                ) : null}
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-[#f8fbf9] p-8 text-center">
                <p className="text-base font-medium text-heading">
                  {normalizedSearch
                    ? "No matching suggestions"
                    : needsProductImport
                      ? "Import products to activate Smart Ordering"
                      : "No forecast-ready products yet"}
                </p>
                <p className="mt-2 text-sm text-body">
                  {normalizedSearch
                    ? "Try a different search term."
                    : needsProductImport
                      ? "Upload invoices or a product list to build your live product workspace."
                      : "Upload invoice history or sales history for imported products to generate demand forecasts."}
                </p>
                {!normalizedSearch ? (
                  <button
                    type="button"
                    onClick={() => navigate("/data-setup")}
                    className="mt-4 rounded-full bg-emerald-dark px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open data setup
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 h-128 overflow-auto rounded-2xl border border-border bg-white p-3">
                <div className="space-y-2">
                  {visibleSuggestions.map(
                    (suggestion: SmartOrderSuggestion) => {
                      const quantity =
                        quantities[suggestion.productId] ??
                        suggestion.suggestedQuantity;
                      const accepted = acceptedIdSet.has(suggestion.productId);
                      const hasWarnings = suggestion.warnings.length > 0;

                      return (
                        <article
                          key={suggestion.productId}
                          className="grid gap-3 rounded-2xl border border-border bg-[#fbfcfb] px-4 py-3 lg:grid-cols-[minmax(0,1.7fr)_auto_auto_auto]"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedSuggestion(suggestion)}
                            className="min-w-0 text-left"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 rounded-full p-1.5 ${
                                  hasWarnings
                                    ? "bg-[#fff5e8] text-[#bb6a23]"
                                    : "bg-[#eef7f2] text-emerald-dark"
                                }`}
                              >
                                {hasWarnings ? (
                                  <AlertTriangle className="h-4 w-4" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-heading">
                                  {suggestion.productName}
                                </p>
                                <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e7d77]">
                                  {suggestion.productCode}
                                </p>
                                <p className="mt-1 truncate text-xs text-body">
                                  {suggestion.supplierName ??
                                    "No supplier linked"}{" "}
                                  · {suggestion.packageLabel}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                  <span className="rounded-full bg-white px-2 py-1 text-body">
                                    Stock {suggestion.currentStock}{" "}
                                    {suggestion.unit}
                                  </span>
                                  <span className="rounded-full bg-white px-2 py-1 text-body">
                                    Use {suggestion.expectedUsage}{" "}
                                    {suggestion.unit}
                                  </span>
                                  {hasWarnings ? (
                                    <span className="rounded-full bg-[#fff5e8] px-2 py-1 font-medium text-[#8a541a]">
                                      {suggestion.warnings.length} warning
                                      {suggestion.warnings.length > 1
                                        ? "s"
                                        : ""}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </button>

                          <div className="flex min-w-28 flex-col justify-center rounded-2xl bg-white px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-body">
                              Suggested
                            </p>
                            <p className="mt-1 text-lg font-semibold text-heading">
                              {suggestion.suggestedQuantity} {suggestion.unit}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  suggestion.productId,
                                  Math.max(
                                    0,
                                    quantity - suggestion.packageQuantity,
                                  ),
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

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedSuggestion(suggestion)}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs font-medium text-heading"
                            >
                              Details
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAcceptedIds((current) =>
                                  current.includes(suggestion.productId)
                                    ? current.filter(
                                        (item) => item !== suggestion.productId,
                                      )
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
                                setRemovedIds((current) => [
                                  ...current,
                                  suggestion.productId,
                                ])
                              }
                              className="rounded-full border border-[#f3d6d4] p-2 text-alert"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </div>
            )}

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
                  Supplier drafts
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-heading">
                  Ready to place
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfirmedDraftIds(
                    draftResponse?.draftOrders.map(
                      (order) => order.draftOrderId,
                    ) ?? [],
                  )
                }
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-heading"
              >
                Confirm all
              </button>
            </div>

            {!draftResponse || draftResponse.draftOrders.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-[#f8fbf9] p-6 text-sm text-body">
                Accept suggestions and create supplier drafts to continue to
                review.
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
                          <p className="mt-2 text-sm text-body">
                            {order.deliveryNote}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmedDraftIds((current) =>
                              current.includes(order.draftOrderId)
                                ? current.filter(
                                    (item) => item !== order.draftOrderId,
                                  )
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
                          <p className="text-xs uppercase tracking-[0.12em] text-body">
                            Products
                          </p>
                          <p className="mt-1 font-semibold text-heading">
                            {order.totalProducts}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-body">
                            Estimated cost
                          </p>
                          <p className="mt-1 font-semibold text-heading">
                            {formatCurrency(order.estimatedTotalCost)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-body">
                            ETA
                          </p>
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
                              <div>
                                <p className="font-medium text-heading">
                                  {line.productName}
                                </p>
                                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e7d77]">
                                  {line.productCode}
                                </p>
                              </div>
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

            <div className="mt-5 flex flex-col gap-3 rounded-3xl bg-emerald-dark px-5 py-5 text-white lg:flex-row lg:items-center lg:justify-between">
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
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-[#cce9df] bg-[#f4fbf8] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#dff3ea] text-emerald-dark">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-heading">
                        Orders placed successfully
                      </p>
                      <p className="mt-1 text-sm text-heading">
                        {placementSummary}
                      </p>
                      <p className="mt-2 text-xs text-body">
                        HVAS prepared the supplier emails below so you can review exactly what gets sent.
                      </p>
                    </div>
                  </div>
                </div>

                {placementEmails.length > 0 ? (
                  <div className="rounded-3xl border border-border bg-[#fbfcfb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
                          Outgoing supplier emails
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-heading">
                          Ready to send
                        </h3>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1.5 text-xs text-body">
                        {placementEmails.length} draft{placementEmails.length > 1 ? "s" : ""}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {placementEmails.map((email) => (
                        <article
                          key={`${email.supplierName}-${email.recipient}`}
                          className="rounded-2xl border border-border bg-white p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-heading">
                                {email.supplierName}
                              </p>
                              <p className="mt-1 text-xs text-body">
                                To: {email.recipient}
                              </p>
                            </div>
                            <div className="rounded-full bg-[#f4f8f5] px-3 py-1 text-xs text-body">
                              Auto-generated
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl bg-[#f8fbf9] px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-body">
                              Subject
                            </p>
                            <p className="mt-1 text-sm font-medium text-heading">
                              {email.subject}
                            </p>
                          </div>

                          <div className="mt-3 rounded-2xl bg-[#f8fbf9] px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-body">
                              Message preview
                            </p>
                            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-heading">
                              {email.body}
                            </pre>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
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

      {selectedSuggestion ? (
        <div className="fixed inset-0 z-40 bg-heading/20">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-border bg-white shadow-lg">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
                  Suggestion details
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-heading">
                  {selectedSuggestion.productName}
                </h3>
                <p className="mt-2 text-sm text-body">
                  {selectedSuggestion.productCode} ·{" "}
                  {selectedSuggestion.category} ·{" "}
                  {selectedSuggestion.supplierName ?? "No supplier linked"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSuggestion(null)}
                className="rounded-full border border-border bg-[#f8fbf9] p-2 text-body"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-border bg-[#f8fbf9] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-body">
                  Product code
                </p>
                <p className="mt-1 text-sm font-semibold text-heading">
                  {selectedSuggestion.productCode}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-border bg-[#f8fbf9] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-body">
                    Suggested order
                  </p>
                  <p className="mt-2 text-xl font-semibold text-heading">
                    {selectedSuggestion.suggestedQuantity}{" "}
                    {selectedSuggestion.unit}
                  </p>
                  <p className="mt-1 text-sm text-body">
                    Package: {selectedSuggestion.packageLabel}
                  </p>
                </article>
                <article className="rounded-2xl border border-border bg-[#f8fbf9] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-body">
                    Confidence
                  </p>
                  <p className="mt-2 text-xl font-semibold capitalize text-heading">
                    {selectedSuggestion.confidence}
                  </p>
                  <p className="mt-1 text-sm text-body">
                    Avg/day {selectedSuggestion.averageDailyUsage}{" "}
                    {selectedSuggestion.unit}
                  </p>
                </article>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-body">
                    Expected usage
                  </p>
                  <p className="mt-2 text-lg font-semibold text-heading">
                    {selectedSuggestion.expectedUsage} {selectedSuggestion.unit}
                  </p>
                </article>
                <article className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-body">
                    Current stock
                  </p>
                  <p className="mt-2 text-lg font-semibold text-heading">
                    {selectedSuggestion.currentStock} {selectedSuggestion.unit}
                  </p>
                  {selectedSuggestion.outstandingIncomingQuantity > 0 ? (
                    <p className="mt-1 text-sm text-body">
                      Incoming {selectedSuggestion.outstandingIncomingQuantity}{" "}
                      {selectedSuggestion.unit}
                    </p>
                  ) : null}
                </article>
              </div>

              <article className="rounded-2xl border border-border bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-body">
                  Warnings
                </p>
                {selectedSuggestion.warnings.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSuggestion.warnings.map((warning) => (
                      <span
                        key={`${selectedSuggestion.productId}-${warning}`}
                        className="rounded-full bg-[#fff5e8] px-2 py-1 text-xs font-medium text-[#8a541a]"
                      >
                        {warningLabels[warning]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-body">
                    No warnings for this suggestion.
                  </p>
                )}
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
