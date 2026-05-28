import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  type OnboardingData,
  type NormalizedProductCandidate,
  uploadDataSetupDocument,
} from "../api/client";
import {
  getDigitalTwinCompleteness,
  getDigitalTwinMethodDetails,
} from "../lib/digitalTwin";
import { Check, Package, RefreshCw, Search, Settings, Truck, Zap } from "./Icons";

const posProviders = ["Toast", "Lightspeed", "Square", "Other"];

function normalizeOnboarding(data: OnboardingData): OnboardingData {
  return {
    restaurantType: data.restaurantType,
    acquisitionSource: data.acquisitionSource,
    orderingDecisionStyle: data.orderingDecisionStyle,
    orderingFrequency: data.orderingFrequency,
    initialProducts: data.initialProducts ?? [],
    suppliers: data.suppliers ?? [],
    forecastingSignals: data.forecastingSignals ?? [],
    restaurantLocation: data.restaurantLocation ?? {},
    primaryGoal: data.primaryGoal,
    digitalTwinSetup: data.digitalTwinSetup ?? {
      selectedMethods: [],
      recommendedMethods: [],
    },
    uploadedDocuments: data.uploadedDocuments ?? [],
    normalizedProducts: data.normalizedProducts ?? [],
    manualStockCounts: data.manualStockCounts ?? [],
    posSetup: data.posSetup ?? {},
  };
}

function upsertMethod(onboarding: OnboardingData, method: string): OnboardingData["digitalTwinSetup"] {
  const current = onboarding.digitalTwinSetup ?? {
    selectedMethods: [],
    recommendedMethods: [],
  };
  return {
    ...current,
    selectedMethods: current.selectedMethods.includes(method)
      ? current.selectedMethods
      : [...current.selectedMethods, method],
  };
}

export default function DataSetupPage() {
  const navigate = useNavigate();
  const { user, saveOnboarding } = useAuth();
  const onboarding = user?.onboardingData
    ? normalizeOnboarding(user.onboardingData)
    : null;
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [uploadingKind, setUploadingKind] = useState<"invoice" | "product-list" | null>(null);
  const [savingStock, setSavingStock] = useState(false);
  const [savingPos, setSavingPos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (onboarding?.manualStockCounts ?? []).map((item) => [
        item.productName,
        String(item.quantity),
      ]),
    ),
  );
  const [posProvider, setPosProvider] = useState(
    onboarding?.posSetup?.provider ?? "Toast",
  );

  if (!onboarding) {
    return null;
  }

  const currentOnboarding = onboarding;

  const completeness = getDigitalTwinCompleteness(currentOnboarding);
  const selectedMethods =
    currentOnboarding.digitalTwinSetup?.selectedMethods ?? [];
  const methodDetails = getDigitalTwinMethodDetails(
    currentOnboarding.restaurantType,
  );
  const normalizedProducts = currentOnboarding.normalizedProducts ?? [];
  const uploadedDocuments = currentOnboarding.uploadedDocuments ?? [];
  const unresolvedProducts = useMemo(() => {
    const canonicalNames = new Set(
      normalizedProducts.map((item) => item.canonicalName.toLowerCase()),
    );
    return currentOnboarding.initialProducts.filter(
      (product) => !canonicalNames.has(product.toLowerCase()),
    );
  }, [normalizedProducts, currentOnboarding.initialProducts]);

  async function persist(nextData: OnboardingData) {
    await saveOnboarding({
      data: nextData,
      completed: true,
    });
  }

  async function handleUpload(kind: "invoice" | "product-list") {
    const file = kind === "invoice" ? invoiceFile : productFile;
    if (!file) return;

    try {
      setUploadingKind(kind);
      setError(null);
      const response = await uploadDataSetupDocument(file, kind);
      const methodName =
        kind === "invoice"
          ? "Upload recent supplier invoices"
          : "Import product list";
      const nextData = normalizeOnboarding({
        ...currentOnboarding,
        uploadedDocuments: [...uploadedDocuments, response.document],
        normalizedProducts: [
          ...normalizedProducts,
          ...response.candidates.filter(
            (candidate) =>
              !normalizedProducts.some(
                (existing) =>
                  existing.originalName === candidate.originalName &&
                  existing.sourceDocumentId === candidate.sourceDocumentId,
              ),
          ),
        ],
        digitalTwinSetup: upsertMethod(currentOnboarding, methodName),
      });
      await persist(nextData);
      if (kind === "invoice") {
        setInvoiceFile(null);
      } else {
        setProductFile(null);
      }
    } catch (uploadError) {
      console.error("Failed to upload setup document", uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload document.",
      );
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleSaveStock() {
    try {
      setSavingStock(true);
      setError(null);
      const manualStockCounts = Object.entries(stockDraft)
        .map(([productName, quantity]) => ({
          productName,
          quantity: Number(quantity || 0),
          unit: "pcs",
        }))
        .filter((item) => item.quantity > 0);

      await persist(
        normalizeOnboarding({
          ...currentOnboarding,
        manualStockCounts,
          digitalTwinSetup: upsertMethod(
            currentOnboarding,
            "Enter current stock manually",
          ),
        }),
      );
    } catch (saveError) {
      console.error("Failed to save stock counts", saveError);
      setError("Could not save stock counts.");
    } finally {
      setSavingStock(false);
    }
  }

  async function handleSavePosSetup() {
    try {
      setSavingPos(true);
      setError(null);
      await persist(
        normalizeOnboarding({
          ...currentOnboarding,
        posSetup: {
          provider: posProvider,
          status: "planned",
        },
          digitalTwinSetup: upsertMethod(
            currentOnboarding,
            "Connect POS system",
          ),
        }),
      );
    } catch (saveError) {
      console.error("Failed to save POS setup", saveError);
      setError("Could not save POS setup.");
    } finally {
      setSavingPos(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-border bg-white px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f6f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtitle">
              <Settings className="h-3.5 w-3.5" />
              Digital Twin
            </div>
            <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-heading">
              Upload and configure your operational data.
            </h1>
            <p className="mt-2 text-sm leading-6 text-body">
              Start with what you have now. Supplier documents, a simple product file, or one manual stock count already makes HVAS more useful.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-[#fcfcfa] px-4 text-sm font-medium text-heading"
          >
            <RefreshCw className="h-4 w-4" />
            Review setup
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Setup completeness
            </p>
            <p className="mt-2 text-[1.8rem] font-semibold text-heading">
              {completeness}%
            </p>
          </div>
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Uploaded docs
            </p>
            <p className="mt-2 text-[1.8rem] font-semibold text-heading">
              {uploadedDocuments.length}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Normalized products
            </p>
            <p className="mt-2 text-[1.8rem] font-semibold text-heading">
              {normalizedProducts.length}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Connected methods
            </p>
            <p className="mt-2 text-[1.8rem] font-semibold text-heading">
              {selectedMethods.length}
            </p>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-alert">{error}</p> : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Document upload</p>
          </div>
          <p className="mt-2 text-sm text-body">
            Upload invoices or product files. HVAS keeps the original supplier name and generates safe normalized candidates.
          </p>

          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl bg-[#fafaf7] p-4">
              <p className="text-sm font-semibold text-heading">Supplier invoices / order documents</p>
              <p className="mt-1 text-sm text-body">
                Use CSV, TXT, or Excel exports for now.
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)}
                className="mt-4 block w-full text-sm text-body file:mr-3 file:rounded-xl file:border-0 file:bg-[#edf4ef] file:px-3 file:py-2 file:font-medium file:text-heading"
              />
              <button
                type="button"
                onClick={() => void handleUpload("invoice")}
                disabled={!invoiceFile || uploadingKind !== null}
                className="mt-4 rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {uploadingKind === "invoice" ? "Uploading..." : "Upload invoices"}
              </button>
            </div>

            <div className="rounded-2xl bg-[#fafaf7] p-4">
              <p className="text-sm font-semibold text-heading">Product list</p>
              <p className="mt-1 text-sm text-body">
                Upload a supplier catalog or starter product export.
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={(event) => setProductFile(event.target.files?.[0] ?? null)}
                className="mt-4 block w-full text-sm text-body file:mr-3 file:rounded-xl file:border-0 file:bg-[#edf4ef] file:px-3 file:py-2 file:font-medium file:text-heading"
              />
              <button
                type="button"
                onClick={() => void handleUpload("product-list")}
                disabled={!productFile || uploadingKind !== null}
                className="mt-4 rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {uploadingKind === "product-list" ? "Uploading..." : "Import product list"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Manual stock and POS</p>
          </div>

          <div className="mt-5 rounded-2xl bg-[#fafaf7] p-4">
            <p className="text-sm font-semibold text-heading">Current stock</p>
            <p className="mt-1 text-sm text-body">
              Save a quick stock snapshot for your starter products.
            </p>
            <div className="mt-4 space-y-3">
              {onboarding.initialProducts.map((product) => (
                <div key={product} className="grid gap-3 md:grid-cols-[1fr_120px]">
                  <div className="rounded-xl bg-white px-3 py-3 text-sm font-medium text-heading">
                    {product}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={stockDraft[product] ?? ""}
                    onChange={(event) =>
                      setStockDraft((current) => ({
                        ...current,
                        [product]: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-border bg-white px-3 py-3 text-sm text-heading outline-none"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void handleSaveStock()}
              disabled={savingStock}
              className="mt-4 rounded-xl bg-emerald-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingStock ? "Saving..." : "Save stock counts"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-[#fafaf7] p-4">
            <p className="text-sm font-semibold text-heading">POS connection</p>
            <p className="mt-1 text-sm text-body">
              Save the provider you plan to connect next. Real integration is still a TODO.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {posProviders.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setPosProvider(provider)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    posProvider === provider
                      ? "bg-[#17342b] text-white"
                      : "border border-border bg-white text-heading"
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void handleSavePosSetup()}
              disabled={savingPos}
              className="mt-4 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-heading disabled:opacity-50"
            >
              {savingPos ? "Saving..." : "Save POS setup"}
            </button>
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Normalized products</p>
          </div>
          <div className="mt-5 space-y-3">
            {normalizedProducts.slice(0, 10).map((product: NormalizedProductCandidate) => (
              <div key={`${product.originalName}-${product.sourceDocumentId ?? "manual"}`} className="rounded-2xl border border-border px-4 py-4">
                <p className="text-sm font-semibold text-heading">{product.canonicalName}</p>
                <p className="mt-1 text-sm text-body">
                  Original: {product.originalName}
                </p>
                <p className="mt-1 text-xs text-body">
                  {product.supplier ?? "Unknown supplier"} · confidence {Math.round(product.confidence * 100)}%
                </p>
              </div>
            ))}
            {normalizedProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-body">
                Upload a document to generate normalized product candidates.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Setup state</p>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-[#fafaf7] px-4 py-4">
              <p className="text-sm font-semibold text-heading">Uploaded documents</p>
              <p className="mt-2 text-sm text-body">
                {uploadedDocuments.length > 0
                  ? uploadedDocuments.map((doc) => `${doc.name} (${doc.kind})`).join(", ")
                  : "No documents uploaded yet."}
              </p>
            </div>
            <div className="rounded-2xl bg-[#fafaf7] px-4 py-4">
              <p className="text-sm font-semibold text-heading">Unresolved products</p>
              <p className="mt-2 text-sm text-body">
                {unresolvedProducts.length > 0
                  ? unresolvedProducts.join(", ")
                  : "No unresolved starter products right now."}
              </p>
            </div>
            <div className="rounded-2xl bg-[#fafaf7] px-4 py-4">
              <p className="text-sm font-semibold text-heading">POS status</p>
              <p className="mt-2 text-sm text-body">
                {onboarding.posSetup?.provider
                  ? `${onboarding.posSetup.provider} (${onboarding.posSetup.status ?? "planned"})`
                  : "No POS provider configured yet."}
              </p>
            </div>
          </div>
        </section>
      </section>

      <section className="rounded-[24px] border border-border bg-white p-5">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-dark" />
          <p className="text-base font-semibold text-heading">Connected methods</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {methodDetails.map((method) => {
            const connected = selectedMethods.includes(method.method);
            return (
              <div key={method.method} className="rounded-2xl bg-[#fafaf7] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-heading">{method.method}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      connected ? "bg-[#17342b] text-white" : "bg-white text-subtitle"
                    }`}
                  >
                    {connected ? "Active" : "Not set"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-body">{method.predicts}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
