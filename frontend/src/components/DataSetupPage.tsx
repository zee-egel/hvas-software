import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { getDigitalTwinCompleteness, getDigitalTwinMethodDetails } from "../lib/digitalTwin";
import { Check, Package, RefreshCw, Settings, Truck, Zap } from "./Icons";

export default function DataSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const onboarding = user?.onboardingData;

  if (!onboarding) {
    return null;
  }

  const completeness = getDigitalTwinCompleteness(onboarding);
  const selectedMethods = onboarding.digitalTwinSetup?.selectedMethods ?? [];
  const methodDetails = getDigitalTwinMethodDetails(onboarding.restaurantType);
  const unresolvedProducts =
    onboarding.initialProducts.length > 0 && !selectedMethods.includes("Import product list")
      ? onboarding.initialProducts.slice(0, 2)
      : [];

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
              Continue improving your setup.
            </h1>
            <p className="mt-2 text-sm leading-6 text-body">
              This area keeps your onboarding setup alive after first run. Add better sources over time to strengthen the HVAS digital twin.
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

        <div className="mt-6 grid gap-3 md:grid-cols-3">
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
              Connected methods
            </p>
            <p className="mt-2 text-[1.8rem] font-semibold text-heading">
              {selectedMethods.length}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f7f8f4] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtitle">
              Normalized products
            </p>
            <p className="mt-2 text-[1.8rem] font-semibold text-heading">
              {onboarding.initialProducts.length}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Connected sources</p>
          </div>
          <div className="mt-5 space-y-3">
            {methodDetails.map((method) => {
              const connected = selectedMethods.includes(method.method);
              return (
                <div
                  key={method.method}
                  className="rounded-2xl bg-[#fafaf7] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-heading">{method.method}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        connected
                          ? "bg-[#17342b] text-white"
                          : "bg-white text-subtitle"
                      }`}
                    >
                      {connected ? "Selected" : "Not connected"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-body">{method.predicts}</p>
                  {method.method === "Connect POS system" ? (
                    <p className="mt-2 text-xs text-body">
                      TODO: replace with real POS connectors.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-dark" />
            <p className="text-base font-semibold text-heading">Products and resolution</p>
          </div>
          <div className="mt-5 space-y-3">
            {onboarding.initialProducts.map((product) => (
              <div key={product} className="rounded-2xl border border-border px-4 py-4">
                <p className="text-sm font-semibold text-heading">{product}</p>
                <p className="mt-1 text-sm text-body">
                  Normalized candidate: {product}
                </p>
              </div>
            ))}
            {onboarding.initialProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-body">
                No products have been added yet.
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-2xl bg-[#f6f8f5] px-4 py-4">
            <p className="text-sm font-semibold text-heading">Unresolved products</p>
            <p className="mt-2 text-sm text-body">
              {unresolvedProducts.length > 0
                ? unresolvedProducts.join(", ")
                : "No unresolved starter products right now."}
            </p>
          </div>
        </section>
      </section>

      <section className="rounded-[24px] border border-border bg-white p-5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-dark" />
          <p className="text-base font-semibold text-heading">What HVAS can do now</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            "Build starter supplier drafts",
            "Create first-pass normalized products",
            "Track setup completeness over time",
          ].map((line) => (
            <div key={line} className="rounded-2xl bg-[#fafaf7] px-4 py-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-dark" />
                <p className="text-sm font-medium text-heading">{line}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
