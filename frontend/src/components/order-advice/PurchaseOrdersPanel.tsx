import { startTransition, useState } from "react";
import type { PurchaseOrder } from "../../api/client";
import { useSimulation } from "../../useSimulation";
import { euro, purchaseOrderTone } from "./utils";

export default function PurchaseOrdersPanel({
  orders,
  history,
}: {
  orders: PurchaseOrder[];
  history: Array<{
    id: string;
    supplierName: string;
    status: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "SENT_SIMULATED" | "REJECTED";
    updatedAt: string;
    itemCount: number;
    totalAmount: number;
    expectedDeliveryDate: string;
  }>;
}) {
  const { approveOrder, rejectOrder } = useSimulation();
  const [expandedId, setExpandedId] = useState<string | null>(orders[0]?.id ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <section className="rounded-3xl border border-border/10 bg-card p-6">
        <h2 className="text-2xl font-semibold text-heading">Conceptorders</h2>
        <div className="mt-5 rounded-3xl border border-dashed border-border/20 bg-bg px-6 py-12 text-center text-sm text-body">
          Geen conceptorders nodig. HVAS verwacht voorlopig genoeg voorraad.
        </div>
      </section>
    );
  }

  async function onApprove(id: string) {
    setPendingId(id);
    try {
      await approveOrder(id);
    } finally {
      setPendingId(null);
    }
  }

  async function onReject(id: string) {
    setPendingId(id);
    try {
      await rejectOrder(id);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-border/10 bg-card p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
          Automatisch voorbereid
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-heading">
          Conceptorders per leverancier
        </h2>
        <p className="mt-2 text-sm text-subtitle">
          Klaargezet voor goedkeuring. Versturen is in deze POC gesimuleerd, maar de orderlogica is al compleet.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {orders.map((order, index) => {
          const expanded = expandedId === order.id;
          const pending = pendingId === order.id;

          return (
            <article
              key={order.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm motion-safe:animate-[fadeInUp_260ms_ease-out]"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-heading">
                      {order.supplierName}
                    </h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${purchaseOrderTone[order.status]}`}>
                      {order.status}
                    </span>
                    {order.status === "NEEDS_REVIEW" ? (
                      <span className="rounded-full border border-[#f0d3b1] bg-[#fff7ee] px-2.5 py-1 text-xs font-medium text-amber-700">
                        Klaargezet
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-subtitle">
                    {order.itemCount} producten · inkoop {euro(order.totalAmount)} · levering verwacht op{" "}
                    {new Date(order.expectedDeliveryDate).toLocaleDateString("nl-NL")}
                  </p>
                  <p className="mt-2 text-sm text-body">
                    Beschermt {euro(order.summary.totalProtectedRevenue)} omzet.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(() =>
                        setExpandedId(expanded ? null : order.id),
                      )
                    }
                    className="rounded-full border border-border/15 bg-bg px-4 py-2 text-sm font-medium text-subtitle transition-colors hover:bg-card"
                  >
                    {expanded ? "Verberg details" : "Bekijk details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onReject(order.id)}
                    disabled={pending || order.status === "SENT_SIMULATED"}
                    className="rounded-full border border-border/15 bg-white px-4 py-2 text-sm font-medium text-subtitle transition-colors hover:bg-bg disabled:opacity-50"
                  >
                    Afwijzen
                  </button>
                  <button
                    type="button"
                    onClick={() => void onApprove(order.id)}
                    disabled={pending || order.status === "SENT_SIMULATED"}
                    className="rounded-full bg-emerald-dark px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Verwerken..." : order.status === "SENT_SIMULATED" ? "Verstuurd" : "Approve / send simulated"}
                  </button>
                </div>
              </div>

              {expanded ? (
                <div className="mt-5 overflow-hidden rounded-3xl border border-border/10 bg-white/65">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-border/10 text-xs uppercase tracking-wider text-body">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Hoeveelheid</th>
                        <th className="px-4 py-3">Reden</th>
                        <th className="px-4 py-3">Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.products.map((line) => (
                        <tr key={line.productId} className="border-b border-border/10 last:border-0">
                          <td className="px-4 py-4">
                            <p className="font-medium text-heading">{line.productName}</p>
                          </td>
                          <td className="px-4 py-4 text-sm text-subtitle">
                            {line.quantity} {line.unit}
                          </td>
                          <td className="px-4 py-4 text-sm text-subtitle">
                            {line.reason}
                          </td>
                          <td className="px-4 py-4 text-sm text-subtitle">
                            {euro(line.impact ?? line.totalCost ?? line.lineAmount ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {history.length > 0 ? (
        <div className="mt-8 rounded-3xl border border-border/10 bg-bg/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-dark">
                Order history
              </p>
              <h3 className="mt-2 text-lg font-semibold text-heading">
                Recent verwerkte conceptorders
              </h3>
            </div>
            <p className="text-sm text-body">POC statusflow blijft gesimuleerd</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {history.slice(0, 4).map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-border/10 bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-heading">{item.supplierName}</p>
                    <p className="mt-1 text-sm text-subtitle">
                      {item.itemCount} producten · {euro(item.totalAmount)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${purchaseOrderTone[item.status]}`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-body">
                  Verwachte levering {new Date(item.expectedDeliveryDate).toLocaleDateString("nl-NL")}
                </p>
                <p className="mt-1 text-xs text-body">
                  Laatst bijgewerkt {new Date(item.updatedAt).toLocaleString("nl-NL")}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
