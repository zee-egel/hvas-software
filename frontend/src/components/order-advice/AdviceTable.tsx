import type { OrderAdviceItem } from "../../api/client";
import { adviceLabel, adviceTone, euro, urgencyTone } from "./utils";

export default function AdviceTable({
  items,
  selectedId,
  onSelect,
}: {
  items: OrderAdviceItem[];
  selectedId: number | null;
  onSelect: (item: OrderAdviceItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/20 bg-bg px-6 py-12 text-center text-sm text-body">
        Geen producten gevonden voor deze filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-border/10">
      <table className="min-w-full text-left">
        <thead className="bg-bg/85">
          <tr className="border-b border-border/10 text-xs uppercase tracking-wider text-body">
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Voorraad</th>
            <th className="px-4 py-3">Verwachte vraag</th>
            <th className="px-4 py-3">Advies</th>
            <th className="px-4 py-3">Auto-order status</th>
            <th className="px-4 py-3">Impact</th>
            <th className="px-4 py-3">Waarom</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const selected = selectedId === item.product.id;
            return (
              <tr
                key={item.product.id}
                onClick={() => onSelect(item)}
                className={`cursor-pointer border-b border-border/10 align-top transition-colors last:border-0 ${
                  selected ? "bg-emerald-light/30" : "hover:bg-bg/85"
                }`}
              >
                <td className="px-4 py-4">
                  <p className="font-medium text-heading">{item.product.name}</p>
                  <p className="mt-1 text-xs text-body">
                    {item.product.category} · {item.product.supplierName} · confidence {item.forecast.confidenceScore}%
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-subtitle">
                  {item.currentStock} {item.product.unit}
                </td>
                <td className="px-4 py-4 text-sm text-subtitle">
                  {item.expectedDemandDuringLeadTime} {item.product.unit}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-2">
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${adviceTone[item.advice]}`}>
                      {adviceLabel[item.advice]}
                    </span>
                    <span className={`text-xs font-medium ${urgencyTone[item.urgency]}`}>
                      {item.urgency.toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-subtitle">
                  {item.linkedPurchaseOrderId ? (
                    <>
                      <p className="font-medium text-heading">{item.autoOrderStatus}</p>
                      <p className="mt-1 text-xs text-body">
                        Klaargezet bij {item.product.supplierName}
                      </p>
                    </>
                  ) : (
                    <span className="text-body">Geen conceptorder</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-subtitle">
                  <p>{euro(item.financialImpact.estimatedProfitImpact)}</p>
                  <p className="mt-1 text-xs text-body">
                    {item.advice === "REDUCE" ? "Waste-risico" : "Gemiste omzet"}{" "}
                    {euro(
                      item.advice === "REDUCE"
                        ? item.financialImpact.potentialWasteCost
                        : item.financialImpact.potentialLostRevenue,
                    )}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-subtitle">
                  <p>{item.explanation}</p>
                  <p className="mt-2 text-xs text-body">{item.noActionMessage}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
