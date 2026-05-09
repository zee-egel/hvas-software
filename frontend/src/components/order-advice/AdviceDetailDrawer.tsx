import type { OrderAdviceItem } from "../../api/client";
import { X } from "../Icons";
import ForecastChart from "./ForecastChart";
import { adviceLabel, adviceTone, euro, formatUnits } from "./utils";

export default function AdviceDetailDrawer({
  item,
  onClose,
}: {
  item: OrderAdviceItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-40 bg-heading/20">
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-border bg-card shadow-lg">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
              Waarom dit advies?
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-heading">
              {item.product.name}
            </h3>
            <p className="mt-2 text-sm text-subtitle">
              {adviceLabel[item.advice]} · confidence {item.forecast.confidenceScore}% · {item.product.category} · {item.product.supplierName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border/15 bg-bg p-2 text-body transition-colors hover:bg-card"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1.5 text-sm font-medium ${adviceTone[item.advice]}`}>
              {adviceLabel[item.advice]}
            </span>
            <span className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-subtitle">
              {item.urgency.toUpperCase()} urgentie
            </span>
            {item.autoOrderStatus ? (
              <span className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-subtitle">
                Conceptorder: {item.autoOrderStatus}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-3xl border border-border/10 bg-bg p-4">
              <p className="text-sm text-body">Wat moet ik doen?</p>
              <p className="mt-2 text-xl font-semibold text-heading">
                {item.reorderQuantity > 0
                  ? `Bestel ${formatUnits(item.reorderQuantity, item.product.unit)}`
                  : adviceLabel[item.advice]}
              </p>
              <p className="mt-2 text-sm text-subtitle">{item.explanation}</p>
            </article>
            <article className="rounded-3xl border border-border/10 bg-bg p-4">
              <p className="text-sm text-body">Wat gebeurt er als je niets doet?</p>
              <p className="mt-2 text-xl font-semibold text-heading">
                {item.advice === "REDUCE"
                  ? euro(item.financialImpact.potentialWasteCost)
                  : euro(item.financialImpact.potentialLostRevenue)}
              </p>
              <p className="mt-2 text-sm text-subtitle">{item.noActionMessage}</p>
            </article>
          </div>

          <div>
            <h4 className="text-base font-semibold text-heading">
              Historische verkoop en verwachte vraag
            </h4>
            <p className="mt-1 text-sm text-body">
              Donkergroen toont de recente verkoop, lichtgroen de forecast en de stippellijn je huidige voorraad.
            </p>
            <div className="mt-4">
              <ForecastChart item={item} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-3xl border border-border/10 bg-bg p-4">
              <h4 className="text-base font-semibold text-heading">Berekening in simpele woorden</h4>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-subtitle">
                <li>Verwachte vraag tijdens lead time: {formatUnits(item.expectedDemandDuringLeadTime, item.product.unit)}</li>
                <li>Safety stock: {formatUnits(item.product.safetyStock, item.product.unit)}</li>
                <li>Benodigde voorraad: {formatUnits(item.requiredStock, item.product.unit)}</li>
                <li>Huidige voorraad: {formatUnits(item.currentStock, item.product.unit)}</li>
              </ul>
            </article>
            <article className="rounded-3xl border border-border/10 bg-bg p-4">
              <h4 className="text-base font-semibold text-heading">Aannames</h4>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-subtitle">
                <li>Lead time: {item.product.leadTimeDays} dagen</li>
                <li>Shelf life: {item.product.shelfLifeDays} dagen</li>
                <li>Waste-risico: {item.product.wasteRiskPercentage}%</li>
                <li>Forecastmethode: {item.forecast.methodUsed}</li>
              </ul>
            </article>
          </div>

          <article className="rounded-3xl border border-border/10 bg-bg p-4">
            <h4 className="text-base font-semibold text-heading">Gekoppelde conceptorder</h4>
            <p className="mt-3 text-sm text-subtitle">
              {item.linkedPurchaseOrderId
                ? `HVAS heeft dit product automatisch opgenomen in ${item.linkedPurchaseOrderId} voor ${item.product.supplierName}.`
                : "Voor dit product is geen conceptorder voorbereid."}
            </p>
          </article>

          <article className="rounded-3xl border border-border/10 bg-bg p-4">
            <h4 className="text-base font-semibold text-heading">Geschatte impact</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-body">Gemiste omzet</p>
                <p className="mt-1 text-lg font-semibold text-heading">
                  {euro(item.financialImpact.potentialLostRevenue)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-body">Waste</p>
                <p className="mt-1 text-lg font-semibold text-heading">
                  {euro(item.financialImpact.potentialWasteCost)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-body">Profit impact</p>
                <p className="mt-1 text-lg font-semibold text-heading">
                  {euro(item.financialImpact.estimatedProfitImpact)}
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
