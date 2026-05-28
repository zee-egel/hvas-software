import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useSimulation } from "../useSimulation";
import { ErrorState } from "./PageState";
import { ArrowRight, Check, Truck, Zap } from "./Icons";
import Skeleton from "./Skeleton";

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Dashboard() {
  const { data, loading, error, refresh, approveOrder } = useSimulation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const starterMode = user?.workspaceMode === "starter";
  const onboarding = user?.onboardingData;

  if (starterMode && onboarding) {
    const starterProducts = onboarding.initialProducts.slice(0, 4);
    const starterSignals = onboarding.forecastingSignals.slice(0, 4);
    const starterSuppliers = onboarding.suppliers.slice(0, 3);

    return (
      <div className="space-y-5">
        <section className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white px-6 py-6 shadow-[0_16px_50px_rgba(19,27,24,0.06)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#eef3f0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f6a65]">
            <Zap className="h-3.5 w-3.5" />
            Starter workspace
          </div>
          <h2 className="mt-4 max-w-3xl text-[1.7rem] font-semibold tracking-[-0.04em] text-[#17211d]">
            {user.companyName} is set up with only your onboarding inputs.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#66716d]">
            HVAS is starting clean: no shared demo orders, no injected history, just the restaurant details you gave us.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] bg-[#f6f8f6] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8480]">
                Restaurant type
              </p>
              <p className="mt-2 text-[1.25rem] font-semibold tracking-[-0.03em] text-[#17211d]">
                {onboarding.restaurantType ?? "Not set"}
              </p>
            </div>
            <div className="rounded-[22px] bg-[#f6f8f6] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8480]">
                Ordering cadence
              </p>
              <p className="mt-2 text-[1.25rem] font-semibold tracking-[-0.03em] text-[#17211d]">
                {onboarding.orderingFrequency ?? "Not set"}
              </p>
            </div>
            <div className="rounded-[22px] bg-[#f6f8f6] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8480]">
                First goal
              </p>
              <p className="mt-2 text-[1.25rem] font-semibold tracking-[-0.03em] text-[#17211d]">
                {onboarding.primaryGoal ?? "Understand demand"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <article className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white p-5 shadow-[0_12px_36px_rgba(19,27,24,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#87918d]">
                  What matters now
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[#17211d]">
                  Finish the first ordering loop
                </h3>
              </div>
              <button
                type="button"
                onClick={() => navigate("/ordering")}
                className="rounded-full border border-[#e5eae7] px-3 py-2 text-sm text-[#24302b]"
              >
                Open smart ordering
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {[
                `Starter products: ${starterProducts.length > 0 ? starterProducts.join(", ") : "none selected"}.`,
                `Forecast signals: ${starterSignals.length > 0 ? starterSignals.join(", ") : "default signals only"}.`,
                `Suppliers: ${starterSuppliers.length > 0 ? starterSuppliers.join(", ") : "add suppliers next"}.`,
              ].map((line) => (
                <div
                  key={line}
                  className="flex items-start gap-3 rounded-[22px] border border-[#edf1ee] px-4 py-4"
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#edf7f1] text-[#2f6a4f]">
                    <Check className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-7 text-[#17211d]">{line}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[22px] bg-[#172f27] px-4 py-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8c5b8]">
                Next best action
              </p>
              <p className="mt-2 text-base font-semibold">
                Generate your first starter suggestions
              </p>
              <p className="mt-2 text-sm leading-6 text-[#d3e1da]">
                HVAS can already build a first supplier draft from your products, cadence, and forecasting signals.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/ordering")}
                  className="rounded-full bg-white px-3 py-2 text-sm font-medium text-[#172f27]"
                >
                  Generate first forecast
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-sm text-white"
                >
                  Review setup
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white p-5 shadow-[0_12px_36px_rgba(19,27,24,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#87918d]">
                  Setup summary
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[#17211d]">
                  What HVAS knows so far
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3f0] text-[#2f6a4f]">
                <Truck className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-[#edf1ee] px-4 py-4">
                <p className="text-sm font-medium text-[#17211d]">Location</p>
                <p className="mt-1 text-sm text-[#69736f]">
                  {onboarding.restaurantLocation?.city ?? "Not set"}
                  {onboarding.restaurantLocation?.postalCodeOrNeighborhood
                    ? ` · ${onboarding.restaurantLocation.postalCodeOrNeighborhood}`
                    : ""}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#edf1ee] px-4 py-4">
                <p className="text-sm font-medium text-[#17211d]">Products</p>
                <p className="mt-1 text-sm text-[#69736f]">
                  {starterProducts.length > 0 ? starterProducts.join(", ") : "No products selected yet"}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#edf1ee] px-4 py-4">
                <p className="text-sm font-medium text-[#17211d]">Signals</p>
                <p className="mt-1 text-sm text-[#69736f]">
                  {starterSignals.length > 0 ? starterSignals.join(", ") : "Default signals only"}
                </p>
              </div>
            </div>
          </article>
        </section>
      </div>
    );
  }

  if (!data && !loading) {
    return (
      <ErrorState
        title="Workspace unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <section className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white px-6 py-6 shadow-[0_16px_50px_rgba(19,27,24,0.06)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#eef3f0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f6a65]">
            <Zap className="h-3.5 w-3.5" />
            Forecast overview
          </div>
          <Skeleton className="mt-4 h-10 w-full max-w-2xl rounded-2xl" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[22px] bg-[#f6f8f6] px-4 py-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-9 w-28" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <article className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white p-5 shadow-[0_12px_36px_rgba(19,27,24,0.04)]">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-3 h-8 w-48" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-[22px]" />
              ))}
            </div>
          </article>
          <article className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white p-5 shadow-[0_12px_36px_rgba(19,27,24,0.04)]">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-8 w-40" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-[22px]" />
              ))}
            </div>
          </article>
        </section>
      </div>
    );
  }

  const urgentProduct = [...data.products]
    .sort(
      (a, b) =>
        b.financialImpact.potentialLostRevenue -
        a.financialImpact.potentialLostRevenue,
    )
    .at(0);
  const wasteRisk = [...data.products]
    .sort(
      (a, b) =>
        b.financialImpact.potentialWasteCost -
        a.financialImpact.potentialWasteCost,
    )
    .at(0);
  const nextDrafts = data.purchaseOrders.active.slice(0, 3);
  const firstAction = data.todaysActions.at(0);
  const goalLabel = onboarding?.primaryGoal ?? "Save time ordering";
  const restaurantType = onboarding?.restaurantType ?? data.restaurant.type;

  const summaryLines = [
    urgentProduct
      ? `You may run low on ${urgentProduct.product.name.toLowerCase()} soon.`
      : "No major shortage signal right now.",
    wasteRisk
      ? `${wasteRisk.product.name} has the highest overstock risk.`
      : "Waste exposure is currently low.",
    `${data.purchaseOrders.active.length} draft orders are ready.`,
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white px-6 py-6 shadow-[0_16px_50px_rgba(19,27,24,0.06)]">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#eef3f0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f6a65]">
          <Zap className="h-3.5 w-3.5" />
          {restaurantType}
        </div>
        <h2 className="mt-4 max-w-3xl text-[1.7rem] font-semibold tracking-[-0.04em] text-[#17211d]">
          {user?.companyName ?? data.restaurant.name}: {data.summary.urgentActions} items need attention before the next order.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#66716d]">
          Focus on forecast risk, overstock risk, and the first goal you picked: {goalLabel.toLowerCase()}.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] bg-[#f6f8f6] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8480]">
              Protected revenue
            </p>
            <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[#17211d]">
              {euro(data.summary.protectedRevenue)}
            </p>
          </div>
          <div className="rounded-[22px] bg-[#f6f8f6] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8480]">
              Waste prevented
            </p>
            <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[#17211d]">
              {euro(data.summary.potentialWastePrevented)}
            </p>
          </div>
          <div className="rounded-[22px] bg-[#f6f8f6] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8480]">
              Draft orders
            </p>
            <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[#17211d]">
              {data.purchaseOrders.active.length}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <article className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white p-5 shadow-[0_12px_36px_rgba(19,27,24,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#87918d]">
                What matters now
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[#17211d]">
                Keep it simple
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate("/ordering")}
              className="rounded-full border border-[#e5eae7] px-3 py-2 text-sm text-[#24302b]"
            >
              Open smart ordering
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {summaryLines.map((line) => (
              <div
                key={line}
                className="flex items-start gap-3 rounded-[22px] border border-[#edf1ee] px-4 py-4"
              >
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#edf7f1] text-[#2f6a4f]">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-sm leading-7 text-[#17211d]">{line}</p>
              </div>
            ))}
          </div>

          {firstAction ? (
            <div className="mt-5 rounded-[22px] bg-[#172f27] px-4 py-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8c5b8]">
                Next best action
              </p>
              <p className="mt-2 text-base font-semibold">
                {firstAction.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#d3e1da]">
                {firstAction.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    firstAction.type === "PURCHASE_ORDER"
                      ? void approveOrder(firstAction.id)
                      : navigate("/ordering")
                  }
                  className="rounded-full bg-white px-3 py-2 text-sm font-medium text-[#172f27]"
                >
                  Take action
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/ordering")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-sm text-white"
                >
                  Review forecast
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </article>

        <article className="rounded-[30px] border border-[rgba(17,24,21,0.06)] bg-white p-5 shadow-[0_12px_36px_rgba(19,27,24,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#87918d]">
                Supplier drafts
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[#17211d]">
                Ready for review
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3f0] text-[#2f6a4f]">
              <Truck className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {nextDrafts.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#e5eae7] px-4 py-6 text-sm text-[#69736f]">
                No drafts are waiting right now.
              </div>
            ) : (
              nextDrafts.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[22px] border border-[#edf1ee] px-4 py-4"
                >
                  <p className="text-sm font-medium text-[#17211d]">
                    {order.supplierName}
                  </p>
                  <p className="mt-1 text-sm text-[#69736f]">
                    {order.itemCount} items · {euro(order.totalAmount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
