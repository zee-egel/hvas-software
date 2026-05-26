import { useEffect, useState } from "react";
import {
  fetchImportStatus,
  fetchProductConfig,
  fetchSupplierConfig,
  importHistoricalDataset,
  updateProductConfig,
  updateSupplierConfig,
  type HistoricalDatasetImportResponse,
  type ImportStatusResponse,
  type LiveSimulationConfig,
  type ProductConfigItem,
  type SupplierConfigItem,
} from "../api/client";
import { Bell, Settings, Sliders, Zap } from "./Icons";
import { ErrorState, LoadingState } from "./PageState";
import ProductionStatusBanner from "./ProductionStatusBanner";
import { useSimulation } from "../useSimulation";

type ConfigField = keyof LiveSimulationConfig;

const configLabels: Array<{
  key: ConfigField;
  label: string;
  help: string;
}> = [
  {
    key: "order_variance",
    label: "Order Variance",
    help: "How aggressively actual weekly orders can deviate from forecast.",
  },
  {
    key: "usage_variance_pct",
    label: "Usage Variance %",
    help: "Allowed kitchen portion drift from recipe targets.",
  },
  {
    key: "waste_variance_pct",
    label: "Waste Variance %",
    help: "Extra spoilage / over-portion allowance per cycle.",
  },
  {
    key: "learning_rate_pct",
    label: "Learning Rate %",
    help: "How quickly HVAS adapts to observed kitchen behavior.",
  },
  {
    key: "restock_threshold",
    label: "Restock Threshold",
    help: "Minimum stock level before the simulation auto-restocks.",
  },
  {
    key: "restock_amount",
    label: "Restock Amount",
    help: "Units added whenever the auto-restock threshold is breached.",
  },
  {
    key: "lookback_weeks",
    label: "Lookback Weeks",
    help: "History window used by the simulation engine for forecasting.",
  },
];

export default function SettingsPage() {
  const {
    data,
    liveSimulation,
    saveSimulationConfig,
    loading,
    error,
    refresh,
  } = useSimulation();
  const [draft, setDraft] = useState<LiveSimulationConfig | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatusResponse | null>(
    null,
  );
  const [productConfig, setProductConfig] = useState<ProductConfigItem[]>([]);
  const [supplierConfig, setSupplierConfig] = useState<SupplierConfigItem[]>(
    [],
  );
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetResult, setDatasetResult] =
    useState<HistoricalDatasetImportResponse | null>(null);

  useEffect(() => {
    if (liveSimulation) {
      setDraft(liveSimulation.config);
    }
  }, [liveSimulation]);

  useEffect(() => {
    let cancelled = false;

    async function loadOperationalSettings() {
      try {
        setOpsLoading(true);
        setOpsError(null);
        const [imports, products, suppliers] = await Promise.all([
          fetchImportStatus(),
          fetchProductConfig(),
          fetchSupplierConfig(),
        ]);
        if (cancelled) return;
        setImportStatus(imports);
        setProductConfig(products);
        setSupplierConfig(suppliers);
      } catch (loadError) {
        console.error("Failed to load production config", loadError);
        if (!cancelled) {
          setOpsError("Could not load production configuration.");
        }
      } finally {
        if (!cancelled) {
          setOpsLoading(false);
        }
      }
    }

    void loadOperationalSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !liveSimulation)
    return <LoadingState title="Loading settings..." />;
  if (!liveSimulation || !draft)
    return (
      <ErrorState
        title="Settings unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );

  async function onSave() {
    if (!draft) return;
    await saveSimulationConfig(draft);
  }

  async function reloadOperationalSettings() {
    try {
      setOpsLoading(true);
      setOpsError(null);
      const [imports, products, suppliers] = await Promise.all([
        fetchImportStatus(),
        fetchProductConfig(),
        fetchSupplierConfig(),
      ]);
      setImportStatus(imports);
      setProductConfig(products);
      setSupplierConfig(suppliers);
    } catch (loadError) {
      console.error("Failed to load production config", loadError);
      setOpsError("Could not load production configuration.");
    } finally {
      setOpsLoading(false);
    }
  }

  async function onImportDataset() {
    if (!datasetFile) return;
    try {
      setDatasetLoading(true);
      setDatasetResult(null);
      const result = await importHistoricalDataset(datasetFile);
      setDatasetResult(result);
      await Promise.all([refresh(), reloadOperationalSettings()]);
    } catch (importError) {
      console.error("Failed to import dataset", importError);
      setOpsError("Could not import the historical dataset.");
    } finally {
      setDatasetLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {data ? <ProductionStatusBanner data={data} compact /> : null}

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
        <div className="rounded-2xl bg-emerald-dark px-6 py-6 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9af6cf]">
            <Settings className="h-3.5 w-3.5" />
            System Settings
          </div>
          <h1 className="mt-4 text-[24px] font-semibold">
            Tune how HVAS learns, alerts, and automates.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c9ded6]">
            This page was designed for operators and admins. Adjust how the live
            simulation behaves, how quickly the engine learns portion drift, and
            what level of automation is appropriate for your kitchen.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9fff1] text-emerald-dark">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-heading">
                  Simulation Status
                </p>
                <p className="text-sm text-body">
                  {liveSimulation.is_running ? "Running" : "Idle"}
                </p>
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-progress-track">
              <div className="h-2 w-[76%] rounded-full bg-emerald-dark" />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f7f6] text-subtitle">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-heading">
                  Notification Policy
                </p>
                <p className="text-sm text-body">
                  Critical shortage and waste events are enabled.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-dark" />
            <p className="text-lg font-semibold text-heading">
              Simulation Controls
            </p>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {configLabels.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-semibold text-heading">
                  {field.label}
                </label>
                <p className="mt-1 text-sm leading-5 text-body">{field.help}</p>
                <input
                  type="number"
                  value={draft[field.key]}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            [field.key]: Number(event.target.value),
                          }
                        : current,
                    )
                  }
                  className="mt-3 h-11 w-full rounded-xl border border-border bg-[#fbfcfb] px-3 text-sm font-medium text-heading outline-none"
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => void onSave()}
              className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white"
            >
              Save Settings
            </button>
            <button
              type="button"
              onClick={() => setDraft(liveSimulation.config)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-subtitle"
            >
              Reset Changes
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-5">
            <p className="text-sm font-semibold text-heading">
              Operational Preferences
            </p>
            <div className="mt-5 space-y-4">
              {[
                "Enable auto-restock in simulation",
                "Require manual review for high-value POs",
                "Alert on learned multiplier changes above 5%",
              ].map((label, index) => (
                <label
                  key={label}
                  className="flex items-center justify-between gap-3 text-sm text-heading"
                >
                  <span>{label}</span>
                  <span
                    className={`relative inline-flex h-6 w-11 rounded-full ${
                      index !== 1 ? "bg-emerald-dark" : "bg-progress-track"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        index !== 1 ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <p className="text-sm font-semibold text-heading">Access & Roles</p>
            <div className="mt-4 space-y-4">
              {[
                ["Chef Marcus", "Kitchen Admin"],
                ["Alex Chef", "Purchasing Manager"],
                ["Sanne Ops", "Finance Reviewer"],
              ].map(([name, role]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl bg-[#f8fbf9] px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">{name}</p>
                    <p className="text-xs text-body">{role}</p>
                  </div>
                  <button
                    onClick={() =>
                      alert(`User management for ${name} coming soon.`)
                    }
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-subtitle"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5">
        <p className="text-lg font-semibold text-heading">
          Historical Dataset Import
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-body">
          Upload one CSV with daily product history and HVAS will rebuild the
          production dataset, recompute forecasts, and refresh the dashboard.
          Invoice exports from the PDF parser are also supported: HVAS will
          derive products, receipts, current stock, and proxy sales history
          from invoice lines when direct POS history is unavailable.
          Required columns: <code>date</code>, <code>sales_qty</code>, and
          either
          <code> product_id</code> or <code>product_name</code>. Recommended
          columns:
          <code> stock_on_hand</code>, <code>receipts_qty</code>,{" "}
          <code>waste_qty</code>,<code> supplier_name</code>, <code>unit</code>,{" "}
          <code>category</code>,<code>cost_price</code>,{" "}
          <code>selling_price</code>, <code>safety_stock</code>,
          <code>lead_time_days</code>.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              setDatasetFile(event.target.files?.[0] ?? null)
            }
            className="h-11 rounded-xl border border-border bg-[#fbfcfb] px-3 py-2 text-sm text-heading outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-dark file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          <button
            type="button"
            onClick={() => void onImportDataset()}
            disabled={!datasetFile || datasetLoading}
            className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {datasetLoading ? "Importing..." : "Import Dataset"}
          </button>
        </div>
        {datasetResult ? (
          <div className="mt-4 rounded-xl bg-[#f7faf8] p-4 text-sm text-heading">
            Imported {datasetResult.rowsProcessed} rows across{" "}
            {datasetResult.productsTouched} products. Sales accepted:{" "}
            {datasetResult.importResults.sales?.acceptedCount ?? 0}. Counts
            accepted:{" "}
            {datasetResult.importResults.inventoryCounts?.acceptedCount ?? 0}.
            Receipts accepted:{" "}
            {datasetResult.importResults.receipts?.acceptedCount ?? 0}. Waste
            accepted: {datasetResult.importResults.waste?.acceptedCount ?? 0}.
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-lg font-semibold text-heading">Import Pipeline</p>
          <p className="mt-2 text-sm text-body">
            Production data is ingested into the operational database through
            typed import jobs. Latest jobs and advice recompute status are shown
            here.
          </p>
          {opsLoading ? (
            <p className="mt-4 text-sm text-body">Loading import history...</p>
          ) : opsError ? (
            <p className="mt-4 text-sm text-alert">{opsError}</p>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-[#f7faf8] p-3 text-sm">
                <p className="font-semibold text-heading">
                  Latest advice recompute
                </p>
                <p className="mt-1 text-body">
                  {importStatus?.latestAdviceRunAt
                    ? new Date(importStatus.latestAdviceRunAt).toLocaleString(
                        "nl-NL",
                      )
                    : "No advice run recorded yet"}
                </p>
              </div>
              {(importStatus?.jobs ?? []).slice(0, 4).map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-heading">
                      {job.importType}
                    </p>
                    <span className="rounded-full bg-[#eef8f4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-dark">
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-body">
                    Source: {job.sourceSystem} • accepted {job.acceptedCount} /{" "}
                    {job.recordCount}
                  </p>
                  {job.rejectedCount > 0 ? (
                    <p className="mt-2 text-xs text-alert">
                      {job.rejectedCount} rejected records require
                      reconciliation.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-5">
            <p className="text-lg font-semibold text-heading">
              Supplier Lead Times
            </p>
            <p className="mt-2 text-sm text-body">
              These values directly affect lead-time demand and purchase-order
              timing.
            </p>
            <div className="mt-5 space-y-3">
              {supplierConfig.slice(0, 4).map((supplier) => (
                <div
                  key={supplier.id}
                  className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_120px_120px]"
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">
                      {supplier.name}
                    </p>
                    <p className="mt-1 text-xs text-body">
                      Active {supplier.active ? "yes" : "no"}
                    </p>
                  </div>
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
                                defaultLeadTimeDays: Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                    className="h-10 rounded-xl border border-border bg-[#fbfcfb] px-3 text-sm font-medium text-heading outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void updateSupplierConfig(supplier.id, {
                        defaultLeadTimeDays: supplier.defaultLeadTimeDays,
                        active: supplier.active,
                      })
                    }
                    className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <p className="text-lg font-semibold text-heading">
              Product Reorder Defaults
            </p>
            <p className="mt-2 text-sm text-body">
              Safety stock and reorder multiple feed directly into the
              production advice calculation.
            </p>
            <div className="mt-5 space-y-3">
              {productConfig.slice(0, 4).map((product) => (
                <div
                  key={product.id}
                  className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1.3fr_120px_120px_120px]"
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-body">
                      {product.category} •{" "}
                      {product.supplierName ?? "Unmapped supplier"}
                    </p>
                  </div>
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
                    className="h-10 rounded-xl border border-border bg-[#fbfcfb] px-3 text-sm font-medium text-heading outline-none"
                  />
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
                    className="h-10 rounded-xl border border-border bg-[#fbfcfb] px-3 text-sm font-medium text-heading outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void updateProductConfig(product.id, {
                        safetyStock: product.safetyStock,
                        reorderMultiple: product.reorderMultiple,
                        supplierId: product.supplierId,
                        active: product.active,
                      })
                    }
                    className="rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
