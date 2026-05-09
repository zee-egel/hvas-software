import { useDeferredValue, useMemo, useRef, useState } from "react";
import type { OrderAdviceItem } from "../../api/client";
import { RefreshCw } from "../Icons";
import Skeleton from "../Skeleton";
import { useSimulation } from "../../useSimulation";
import AdviceDetailDrawer from "./AdviceDetailDrawer";
import AdviceFilters from "./AdviceFilters";
import AdviceTable from "./AdviceTable";
import LiveSimulationPanel from "./LiveSimulationPanel";
import MagicSummary from "./MagicSummary";
import PriorityAdviceCards from "./PriorityAdviceCards";
import PurchaseOrdersPanel from "./PurchaseOrdersPanel";
import SummaryCards from "./SummaryCards";
import TodaysActions from "./TodaysActions";
import { riskValue, sortAdvice } from "./utils";

function LoadingSkeleton() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div className="rounded-3xl border border-border/10 bg-card p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-10 w-72" />
        <Skeleton className="mt-3 h-4 w-5/6" />
      </div>
      <div className="rounded-3xl border border-border/10 bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-3xl bg-bg px-4 py-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-28" />
              <Skeleton className="mt-3 h-3 w-36" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-8">
      <div className="rounded-3xl border border-alert/20 bg-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-heading">
          Kon de magic assistant niet laden
        </h2>
        <p className="mt-3 text-sm text-body">{message}</p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-dark px-4 py-2.5 text-sm font-medium text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Opnieuw proberen
        </button>
      </div>
    </main>
  );
}

export default function OrderAdvicePage() {
  const { data, loading, error, refresh } = useSimulation();
  const [selectedItem, setSelectedItem] = useState<OrderAdviceItem | null>(
    null,
  );
  const [quickFilter, setQuickFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const purchaseOrdersRef = useRef<HTMLElement | null>(null);

  const sortedProducts = useMemo(
    () => (data ? sortAdvice(data.products) : []),
    [data],
  );

  const priorityItems = useMemo(
    () => sortedProducts.filter((item) => item.advice !== "HOLD").slice(0, 5),
    [sortedProducts],
  );

  const filteredProducts = useMemo(() => {
    return sortedProducts.filter((item) => {
      if (
        deferredSearch.trim() &&
        !item.product.name
          .toLowerCase()
          .includes(deferredSearch.trim().toLowerCase())
      ) {
        return false;
      }
      if (category !== "all" && item.product.category !== category) {
        return false;
      }
      if (quickFilter === "risk" && item.urgency !== "high") {
        return false;
      }
      if (
        quickFilter !== "all" &&
        quickFilter !== "risk" &&
        item.advice !== quickFilter
      ) {
        return false;
      }
      return true;
    });
  }, [category, deferredSearch, quickFilter, sortedProducts]);

  const biggestWaste = useMemo(
    () =>
      [...sortedProducts]
        .sort(
          (left, right) =>
            right.financialImpact.potentialWasteCost -
            left.financialImpact.potentialWasteCost,
        )
        .slice(0, 3),
    [sortedProducts],
  );

  const topRiskItem = useMemo(
    () =>
      [...sortedProducts].sort(
        (left, right) => riskValue(right) - riskValue(left),
      )[0] ?? null,
    [sortedProducts],
  );

  if (loading && !data) return <LoadingSkeleton />;
  if (error && !data)
    return <ErrorState message={error} onRetry={() => void refresh()} />;
  if (!data) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-8">
        <div className="rounded-3xl border border-border/10 bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold text-heading">
            Nog geen advies beschikbaar
          </h2>
          <p className="mt-3 text-sm text-body">
            Zodra de backend data teruggeeft zie je hier direct wat HVAS
            automatisch heeft voorbereid.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <MagicSummary
          data={data}
          onViewOrders={() =>
            purchaseOrdersRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
        />
        <SummaryCards data={data} />
        <TodaysActions actions={data.todaysActions} />
        <LiveSimulationPanel />

        <section ref={purchaseOrdersRef}>
          <PurchaseOrdersPanel
            orders={data.purchaseOrders.active}
            history={data.purchaseOrders.history}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <PriorityAdviceCards
            items={priorityItems}
            onSelect={setSelectedItem}
            selectedId={selectedItem?.product.id ?? null}
          />

          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
              Overzicht
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-heading">
              Waar moet je vandaag naar kijken?
            </h2>
            <div className="mt-6 grid gap-4">
              <article className="rounded-3xl border border-border bg-[#fff7f5] p-4">
                <p className="text-sm text-body">Waarschijnlijk tekort</p>
                <p className="mt-2 text-lg font-semibold text-heading">
                  {topRiskItem ? topRiskItem.product.name : "Geen"}
                </p>
                <p className="mt-2 text-sm text-subtitle">
                  {topRiskItem?.noActionMessage ?? "Geen acuut tekort-risico."}
                </p>
              </article>
              {biggestWaste.map((item) => (
                <article
                  key={item.product.id}
                  className="rounded-xl border border-border bg-[#fffbf2] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-heading">
                      {item.product.name}
                    </p>
                    <span className="text-sm font-medium text-amber-700">
                      {item.product.wasteRiskPercentage}% risk
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-subtitle">
                    Waarschijnlijk overschot van{" "}
                    {item.excessStock > 0
                      ? `${item.excessStock} ${item.product.unit}`
                      : `0 ${item.product.unit}`}
                    .
                  </p>
                  <p className="mt-2 text-sm text-body">
                    Geschatte impact{" "}
                    {new Intl.NumberFormat("nl-NL", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }).format(item.financialImpact.potentialWasteCost)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
                Product advice
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-heading">
                Wat HVAS per product heeft berekend
              </h2>
              <p className="mt-2 text-sm text-subtitle">
                Van sales history naar forecast, voorraadcheck, auto-order
                status en financiële impact.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-border/15 bg-bg px-4 py-2 text-sm font-medium text-subtitle transition-colors hover:bg-card disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Vernieuwen
            </button>
          </div>

          <div className="mt-6">
            <AdviceFilters
              filter={quickFilter}
              setFilter={setQuickFilter}
              category={category}
              setCategory={setCategory}
              categories={data.filters.categories}
              search={search}
              setSearch={setSearch}
            />
          </div>

          <div className="mt-6">
            <AdviceTable
              items={filteredProducts}
              selectedId={selectedItem?.product.id ?? null}
              onSelect={setSelectedItem}
            />
          </div>
        </section>
      </main>

      <AdviceDetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}
