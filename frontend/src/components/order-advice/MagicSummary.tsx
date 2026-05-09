import type { OrderAdviceResponse } from "../../api/client";
import { euro } from "./utils";

export default function MagicSummary({
  data,
  onViewOrders,
}: {
  data: OrderAdviceResponse;
  onViewOrders: () => void;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald/15 bg-emerald-light/55 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-dark">
            <span className="h-2 w-2 rounded-full bg-emerald-dark" />
            Magic order assistant
          </div>
          <h2 className="mt-3 text-3xl font-semibold text-heading">
            {data.magicSummary.draftOrdersCount} bestellingen klaargezet
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-subtitle">
            {data.magicSummary.message}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-border bg-bg px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-body">Omzet beschermd</p>
            <p className="mt-1 text-xl font-semibold text-heading">
              {euro(data.magicSummary.protectedRevenue)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-bg px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-body">Waste voorkomen</p>
            <p className="mt-1 text-xl font-semibold text-heading">
              {euro(data.magicSummary.preventedWaste)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-bg px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-body">Laatste update</p>
            <p className="mt-1 text-xl font-semibold text-heading">
              {data.magicSummary.lastUpdateLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onViewOrders}
          className="rounded-full bg-emerald-dark px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Bekijk conceptorders
        </button>
        <p className="text-sm text-body">
          HVAS heeft je voorraad al bekeken, de vraag voorspeld en de juiste bestelling voorbereid.
        </p>
      </div>
    </section>
  );
}
