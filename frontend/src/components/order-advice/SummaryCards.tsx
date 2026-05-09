import type { OrderAdviceItem, OrderAdviceResponse } from "../../api/client";
import { euro } from "./utils";

function highestShortageRisk(items: OrderAdviceItem[]) {
  return [...items].sort(
    (left, right) =>
      right.financialImpact.potentialLostRevenue -
      left.financialImpact.potentialLostRevenue,
  )[0];
}

function highestWasteRisk(items: OrderAdviceItem[]) {
  return [...items].sort(
    (left, right) =>
      right.financialImpact.potentialWasteCost -
      left.financialImpact.potentialWasteCost,
  )[0];
}

export default function SummaryCards({
  data,
}: {
  data: OrderAdviceResponse;
}) {
  const shortage = highestShortageRisk(data.products);
  const waste = highestWasteRisk(data.products);

  const cards = [
    {
      label: "Geschatte besparing",
      value: euro(data.summary.estimatedWeeklySavings ?? data.summary.estimatedProfitImpact),
      hint: "Profit uplift als je de adviezen volgt",
      tone: "text-heading",
      accent: "border-l-[3px] border-l-emerald-dark",
    },
    {
      label: "Klaargezette orders",
      value: String(data.magicSummary.draftOrdersCount),
      hint: "Conceptorders klaar voor goedkeuring",
      tone: "text-alert",
      accent: "border-l-[3px] border-l-alert",
    },
    {
      label: "Grootste tekortrisico",
      value: shortage ? shortage.product.name : "Geen",
      hint: shortage
        ? `Tot ${euro(shortage.financialImpact.potentialLostRevenue)} gemiste omzet`
        : "Geen acute risico's",
      tone: "text-heading",
      accent: "border-l-[3px] border-l-[#d48b43]",
    },
    {
      label: "Grootste waste-risico",
      value: waste ? waste.product.name : "Geen",
      hint: waste
        ? `${euro(waste.financialImpact.potentialWasteCost)} potentiële waste`
        : "Geen acute risico's",
      tone: "text-heading",
      accent: "border-l-[3px] border-l-[#7699c8]",
    },
  ];

  return (
    <section className="sticky top-4 z-20 rounded-3xl border border-border bg-card p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`rounded-3xl border border-border bg-bg px-4 py-4 ${card.accent}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-2 text-sm text-subtitle">{card.hint}</p>
          </article>
        ))}
      </div>
      <p className="px-2 pt-3 text-sm text-subtitle">{data.magicSummary.message}</p>
    </section>
  );
}
