import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchImportStatus,
  fetchProductConfig,
  fetchSupplierConfig,
  importHistoricalDataset,
  updateProductConfig,
  updateSupplierConfig,
  type HistoricalDatasetImportResponse,
  type ImportStatusResponse,
  type ProductConfigItem,
  type SupplierConfigItem,
} from "../api/client";
import { useAuth } from "../AuthContext";
import { Package, RefreshCw, Search, Settings, Truck } from "./Icons";
import { ErrorState } from "./PageState";
import Skeleton from "./Skeleton";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { resetOnboarding, user } = useAuth();
  const starterMode = user?.workspaceMode === "starter";
  const onboarding = user?.onboardingData;
  const [importStatus, setImportStatus] = useState<ImportStatusResponse | null>(
    null,
  );
  const [productConfig, setProductConfig] = useState<ProductConfigItem[]>([]);
  const [supplierConfig, setSupplierConfig] = useState<SupplierConfigItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetResult, setDatasetResult] =
    useState<HistoricalDatasetImportResponse | null>(null);
  const [search, setSearch] = useState("");
  const [savingSupplierId, setSavingSupplierId] = useState<number | null>(null);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [resettingOnboarding, setResettingOnboarding] = useState(false);

  useEffect(() => {
    if (starterMode) {
      setLoading(false);
      return;
    }
    void reloadSettings();
  }, [starterMode]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return productConfig.slice(0, 10);
    }

    return productConfig
      .filter((product) =>
        [
          product.name,
          product.category,
          product.supplierName ?? "",
          product.unit,
          String(product.id),
        ].some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, 12);
  }, [productConfig, search]);

  async function reloadSettings() {
    try {
      setLoading(true);
      setError(null);
      const [imports, products, suppliers] = await Promise.all([
        fetchImportStatus(),
        fetchProductConfig(),
        fetchSupplierConfig(),
      ]);
      setImportStatus(imports);
      setProductConfig(products);
      setSupplierConfig(suppliers);
    } catch (loadError) {
      console.error("Failed to load settings", loadError);
      setError("Could not load ordering settings.");
    } finally {
      setLoading(false);
    }
  }

  async function onImportDataset() {
    if (!datasetFile) return;

    try {
      setDatasetLoading(true);
      setDatasetResult(null);
      setError(null);
      const result = await importHistoricalDataset(datasetFile);
      setDatasetResult(result);
      await reloadSettings();
    } catch (importError) {
      console.error("Failed to import dataset", importError);
      setError("Could not import the forecast history file.");
    } finally {
      setDatasetLoading(false);
    }
  }

  async function onSaveSupplier(supplier: SupplierConfigItem) {
    try {
      setSavingSupplierId(supplier.id);
      await updateSupplierConfig(supplier.id, {
        defaultLeadTimeDays: supplier.defaultLeadTimeDays,
        active: supplier.active,
      });
    } catch (saveError) {
      console.error("Failed to update supplier", saveError);
      setError("Could not save supplier lead time.");
    } finally {
      setSavingSupplierId(null);
    }
  }

  async function onSaveProduct(product: ProductConfigItem) {
    try {
      setSavingProductId(product.id);
      await updateProductConfig(product.id, {
        safetyStock: product.safetyStock,
        reorderMultiple: product.reorderMultiple,
        supplierId: product.supplierId,
        active: product.active,
      });
    } catch (saveError) {
      console.error("Failed to update product", saveError);
      setError("Could not save reorder defaults.");
    } finally {
      setSavingProductId(null);
    }
  }

  async function onResetOnboarding() {
    try {
      setResettingOnboarding(true);
      setError(null);
      await resetOnboarding();
      navigate("/onboarding");
    } catch (resetError) {
      console.error("Failed to reset onboarding", resetError);
      setError("Could not restart onboarding.");
    } finally {
      setResettingOnboarding(false);
    }
  }

  if (starterMode && onboarding) {
    return (
      <div className="space-y-5">
        <section className="rounded-[28px] border border-border bg-white px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f6f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtitle">
                <Settings className="h-3.5 w-3.5" />
                Starter Setup
              </div>
              <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-heading">
                Your workspace is running on onboarding data only.
              </h1>
              <p className="mt-2 text-sm leading-6 text-body">
                No shared demo products or injected history are shown here. Everything below comes from the answers you gave during setup.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void onResetOnboarding()}
              disabled={resettingOnboarding}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-heading disabled:opacity-50"
            >
              {resettingOnboarding ? "Restarting..." : "Restart onboarding"}
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-5">
            <section className="rounded-[24px] border border-border bg-white p-5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-dark" />
                <p className="text-base font-semibold text-heading">
                  Suppliers
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {(onboarding.suppliers.length > 0
                  ? onboarding.suppliers
                  : ["No suppliers added yet"]).map((supplier) => (
                  <div
                    key={supplier}
                    className="rounded-2xl bg-[#fafaf7] px-4 py-4 text-sm font-medium text-heading"
                  >
                    {supplier}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-border bg-white p-5">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-dark" />
                <p className="text-base font-semibold text-heading">
                  Forecasting context
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {onboarding.forecastingSignals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full bg-[#edf4ef] px-3 py-2 text-sm font-medium text-heading"
                  >
                    {signal}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-sm text-body">
                Location: {onboarding.restaurantLocation?.city ?? "Not set"}
                {onboarding.restaurantLocation?.postalCodeOrNeighborhood
                  ? ` · ${onboarding.restaurantLocation.postalCodeOrNeighborhood}`
                  : ""}
              </p>
            </section>
          </div>

          <section className="rounded-[24px] border border-border bg-white p-5">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-dark" />
              <p className="text-base font-semibold text-heading">
                Starter products
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-body">
              These are the first items HVAS uses to build starter suggestions from your onboarding setup.
            </p>
            <div className="mt-5 space-y-3">
              {(onboarding.initialProducts.length > 0
                ? onboarding.initialProducts
                : ["No starter products added yet"]).map((product) => (
                <div
                  key={product}
                  className="rounded-2xl bg-[#fafaf7] px-4 py-4"
                >
                  <p className="text-sm font-semibold text-heading">{product}</p>
                  <p className="mt-1 text-xs text-body">
                    {onboarding.restaurantType ?? "Starter product"} · onboarding only
                  </p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    );
  }

  if (error && !productConfig.length && !supplierConfig.length && !loading) {
    return (
      <ErrorState
        title="Settings unavailable"
        message={error}
        onRetry={() => void reloadSettings()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-border bg-white px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f6f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtitle">
              <Settings className="h-3.5 w-3.5" />
              Ordering Settings
            </div>
            <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-heading">
              Keep forecasting accurate.
            </h1>
            <p className="mt-2 text-sm leading-6 text-body">
              Only the inputs that change order timing and replenishment are
              kept here.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void reloadSettings()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-[#fcfcfa] px-4 text-sm font-medium text-heading transition hover:bg-[#f6f7f2]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void onResetOnboarding()}
              disabled={resettingOnboarding}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-heading disabled:opacity-50"
            >
              {resettingOnboarding ? "Restarting..." : "Restart onboarding"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Last advice run
            </p>
            <p className="mt-2 text-sm font-medium text-heading">
              {loading ? (
                <Skeleton className="h-4 w-36" />
              ) : importStatus?.latestAdviceRunAt
                ? new Date(importStatus.latestAdviceRunAt).toLocaleString(
                    "nl-NL",
                  )
                : "No run recorded yet"}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Active suppliers
            </p>
            <p className="mt-2 text-sm font-medium text-heading">
              {loading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                `${supplierConfig.filter((supplier) => supplier.active).length} configured`
              )}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Products in rules
            </p>
            <p className="mt-2 text-sm font-medium text-heading">
              {loading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                `${productConfig.length} products`
              )}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-alert">{error}</p>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-5">
          <section className="rounded-[24px] border border-border bg-white p-5">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-dark" />
              <p className="text-base font-semibold text-heading">
                Supplier lead times
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-body">
              This controls when HVAS decides an order needs to happen.
            </p>

            <div className="mt-5 space-y-3">
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="h-20 w-full rounded-2xl bg-[#fafaf7]"
                    />
                  ))
                : supplierConfig.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="grid gap-3 rounded-2xl bg-[#fafaf7] p-4 md:grid-cols-[1fr_112px_auto]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-heading">
                          {supplier.name}
                        </p>
                        <p className="mt-1 text-xs text-body">
                          {supplier.active ? "Active for suggestions" : "Inactive"}
                        </p>
                      </div>

                      <label className="block">
                        <span className="sr-only">Lead time days</span>
                        <input
                          type="number"
                          min={1}
                          value={supplier.defaultLeadTimeDays}
                          onChange={(event) =>
                            setSupplierConfig((current) =>
                              current.map((item) =>
                                item.id === supplier.id
                                  ? {
                                      ...item,
                                      defaultLeadTimeDays: Number(
                                        event.target.value,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-medium text-heading outline-none transition focus:border-[#9ab59b]"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void onSaveSupplier(supplier)}
                        disabled={savingSupplierId === supplier.id}
                        className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {savingSupplierId === supplier.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-border bg-white p-5">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-emerald-dark" />
              <p className="text-base font-semibold text-heading">
                Forecast history
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-body">
              Upload a CSV when you want to refresh the order model with real
              sales and stock movement.
            </p>

            <div className="mt-5 grid gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  setDatasetFile(event.target.files?.[0] ?? null)
                }
                className="h-11 rounded-xl border border-border bg-[#fbfcfb] px-3 py-2 text-sm text-heading outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef3ea] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-heading"
              />
              <button
                type="button"
                onClick={() => void onImportDataset()}
                disabled={!datasetFile || datasetLoading}
                className="h-11 rounded-xl bg-emerald-dark px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {datasetLoading ? "Importing..." : "Import history"}
              </button>
            </div>

            {datasetResult ? (
              <div className="mt-4 rounded-2xl bg-[#f7f8f4] p-4 text-sm text-heading">
                Imported {datasetResult.rowsProcessed} rows across{" "}
                {datasetResult.productsTouched} products.
              </div>
            ) : null}
          </section>
        </div>

        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-dark" />
                <p className="text-base font-semibold text-heading">
                  Product reorder defaults
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-body">
                Safety stock and pack multiple are the only product rules kept
                here.
              </p>
            </div>

            <label className="relative block w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtitle" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products"
                className="h-11 w-full rounded-xl border border-border bg-[#fcfcfa] pl-9 pr-3 text-sm text-heading outline-none transition focus:border-[#9ab59b]"
              />
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-20 w-full rounded-2xl bg-[#fafaf7]"
                  />
                ))
              : visibleProducts.map((product) => (
                  <div
                    key={product.id}
                    className="grid gap-3 rounded-2xl bg-[#fafaf7] p-4 md:grid-cols-[1.4fr_110px_110px_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-heading">
                        {product.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-body">
                        {product.category} • {product.supplierName ?? "No supplier"}
                      </p>
                    </div>

                    <label className="block">
                      <span className="sr-only">Safety stock</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={product.safetyStock}
                        onChange={(event) =>
                          setProductConfig((current) =>
                            current.map((item) =>
                              item.id === product.id
                                ? {
                                    ...item,
                                    safetyStock: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-medium text-heading outline-none transition focus:border-[#9ab59b]"
                      />
                    </label>

                    <label className="block">
                      <span className="sr-only">Reorder multiple</span>
                      <input
                        type="number"
                        min={1}
                        step={0.1}
                        value={product.reorderMultiple}
                        onChange={(event) =>
                          setProductConfig((current) =>
                            current.map((item) =>
                              item.id === product.id
                                ? {
                                    ...item,
                                    reorderMultiple: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-medium text-heading outline-none transition focus:border-[#9ab59b]"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void onSaveProduct(product)}
                      disabled={savingProductId === product.id}
                      className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {savingProductId === product.id ? "Saving..." : "Save"}
                    </button>
                  </div>
                ))}
          </div>

          {!loading && !visibleProducts.length ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8f4] px-4 py-6 text-sm text-body">
              No products match that search.
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
