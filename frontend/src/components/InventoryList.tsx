import { useEffect, useMemo, useState } from "react";
import { useSimulation } from "../useSimulation";

function unitLabel(value: number, unit: string) {
  return `${value} ${unit}`;
}

export default function InventoryList() {
  const { data, loading, error, saveInventory } = useSimulation();
  const [draftStocks, setDraftStocks] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!data) return;
    const nextDrafts: Record<number, string> = {};
    for (const item of data.products) {
      nextDrafts[item.product.id] = String(item.currentStock);
    }
    setDraftStocks(nextDrafts);
  }, [data]);

  const changedItems = useMemo(() => {
    if (!data) return [];
    return data.products
      .map((item) => {
        const draftValue = Number(draftStocks[item.product.id]);
        if (Number.isNaN(draftValue) || draftValue === item.currentStock) {
          return null;
        }
        return {
          productId: item.product.id,
          currentStock: draftValue,
        };
      })
      .filter((item): item is { productId: number; currentStock: number } => item !== null);
  }, [data, draftStocks]);

  if (loading && !data) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6 py-8">
        <p className="text-sm text-body">Voorraad wordt geladen…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-8">
        <p className="text-sm text-body">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-8">
        <p className="text-sm text-body">Geen voorraaddata beschikbaar.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-heading">
            Inventory input
          </h2>
          <p className="mt-0.5 text-sm text-body">
            Werk huidige voorraad bij en zie direct wat dat doet met het
            besteladvies.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => void saveInventory(changedItems)}
            disabled={loading || changedItems.length === 0}
            className="rounded-full bg-emerald-dark px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Save {changedItems.length > 0 ? `${changedItems.length} change(s)` : "changes"}
          </button>
          <p className="text-xs text-body">
            Laatste adviesrun: {new Date(data.generatedAt).toLocaleString("nl-NL")}
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border/10 bg-card p-5">
          <span className="text-sm text-body">Producten</span>
          <p className="mt-2 text-3xl font-semibold text-heading">
            {data.products.length}
          </p>
        </div>
        <div className="rounded-3xl border border-border/10 bg-card p-5">
          <span className="text-sm text-body">Items met wijziging</span>
          <p className="mt-2 text-3xl font-semibold text-heading">
            {changedItems.length}
          </p>
        </div>
        <div className="rounded-3xl border border-border/10 bg-card p-5">
          <span className="text-sm text-body">ORDER-adviezen</span>
          <p className="mt-2 text-3xl font-semibold text-alert">
            {data.products.filter((item) => item.advice === "ORDER" || item.advice === "NEEDS_REVIEW").length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border/10 bg-card">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-border/10 text-xs uppercase tracking-wider text-body">
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Current stock</th>
              <th className="px-6 py-4">Safety stock</th>
              <th className="px-6 py-4">Forecast</th>
              <th className="px-6 py-4">Lead time</th>
              <th className="px-6 py-4">Waste risk</th>
              <th className="px-6 py-4">Advice</th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((item) => (
              <tr
                key={item.product.id}
                className="border-b border-border/10 align-top last:border-0"
              >
                <td className="px-6 py-4">
                  <p className="font-medium text-heading">{item.product.name}</p>
                  <p className="mt-1 text-xs text-body">{item.product.category}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={draftStocks[item.product.id] ?? ""}
                      onChange={(event) =>
                        setDraftStocks((current) => ({
                          ...current,
                          [item.product.id]: event.target.value,
                        }))
                      }
                      className="w-28 rounded-2xl border border-border/15 bg-bg px-3 py-2 text-sm text-heading focus:outline-none"
                    />
                    <span className="text-sm text-body">{item.product.unit}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-subtitle">
                  {unitLabel(item.product.safetyStock, item.product.unit)}
                </td>
                <td className="px-6 py-4 text-sm text-subtitle">
                  {unitLabel(item.forecast.expectedDemand, item.product.unit)}
                </td>
                <td className="px-6 py-4 text-sm text-subtitle">
                  {item.product.leadTimeDays} dagen
                </td>
                <td className="px-6 py-4 text-sm text-subtitle">
                  {item.product.wasteRiskPercentage}%
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.advice === "ORDER"
                        ? "bg-alert/10 text-alert"
                        : item.advice === "NEEDS_REVIEW"
                          ? "bg-sky-100 text-sky-800"
                        : item.advice === "REDUCE"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-light text-badge-green"
                    }`}
                  >
                    {item.advice}
                  </span>
                  <p className="mt-2 max-w-xs text-xs text-body">
                    {item.explanation}
                  </p>
                  <p className="mt-2 max-w-xs text-xs text-body">
                    {item.noActionMessage}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
