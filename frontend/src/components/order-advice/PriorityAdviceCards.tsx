import type { OrderAdviceItem } from "../../api/client";
import { adviceLabel, adviceTone, euro, getShortageHeadline } from "./utils";

export default function PriorityAdviceCards({
  items,
  onSelect,
  selectedId,
}: {
  items: OrderAdviceItem[];
  onSelect: (item: OrderAdviceItem) => void;
  selectedId: number | null;
}) {
  return (
    <section className="rounded-3xl border border-border/10 bg-card p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
            Vandaag actie nodig
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-heading">
            Begin met deze producten
          </h2>
          <p className="mt-2 text-sm text-subtitle">
            De belangrijkste adviezen staan bovenaan op impact en urgentie.
          </p>
        </div>
        <p className="text-sm text-body">
          {items.length} product{items.length === 1 ? "" : "en"} vragen nu aandacht
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {items.map((item) => {
          const selected = selectedId === item.product.id;
          const accentTone =
            item.advice === "ORDER"
              ? "border-l-[4px] border-l-alert"
              : item.advice === "NEEDS_REVIEW"
                ? "border-l-[4px] border-l-sky-500"
              : item.advice === "REDUCE"
                ? "border-l-[4px] border-l-[#d48b43]"
                : "border-l-[4px] border-l-emerald";
          return (
            <button
              key={item.product.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`rounded-3xl border bg-card p-5 text-left transition-colors ${accentTone} ${
                selected
                  ? "border-emerald-dark shadow-sm"
                  : "border-border hover:border-emerald/40 hover:bg-bg"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-heading">
                    {getShortageHeadline(item)}
                  </p>
                  <p className="mt-1 text-sm text-subtitle">
                    {item.product.name} · {adviceLabel[item.advice]} · {item.product.supplierName}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${adviceTone[item.advice]}`}
                >
                  {item.urgency.toUpperCase()}
                </span>
              </div>

              <p className="mt-4 text-sm text-heading">
                Voorkomt naar schatting{" "}
                <span className="font-semibold">
                  {item.advice === "REDUCE"
                    ? euro(item.financialImpact.potentialWasteCost)
                    : euro(item.financialImpact.potentialLostRevenue)}
                </span>{" "}
                {item.advice === "REDUCE" ? "waste" : "gemiste omzet"}.
              </p>
              <p className="mt-3 text-sm text-subtitle">{item.explanation}</p>
              <p className="mt-2 text-sm text-body">{item.noActionMessage}</p>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-body">
                <span className="rounded-full border border-border bg-bg px-2.5 py-1">Voorraad: {item.currentStock} {item.product.unit}</span>
                <span className="rounded-full border border-border bg-bg px-2.5 py-1">Vraag tijdens lead time: {item.expectedDemandDuringLeadTime} {item.product.unit}</span>
                <span className="rounded-full border border-border bg-bg px-2.5 py-1">Impact: {euro(item.financialImpact.estimatedProfitImpact)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
