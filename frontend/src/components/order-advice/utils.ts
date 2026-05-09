import type { OrderAdviceItem, PurchaseOrder } from "../../api/client";

export const adviceTone = {
  ORDER: "bg-alert/10 text-alert border-alert/15",
  NEEDS_REVIEW: "bg-sky-100 text-sky-800 border-sky-200",
  REDUCE: "bg-amber-100 text-amber-800 border-amber-200",
  HOLD: "bg-emerald-light text-badge-green border-emerald/20",
} as const;

export const adviceLabel = {
  ORDER: "Bijbestellen aanbevolen",
  NEEDS_REVIEW: "Controleer bestelling",
  REDUCE: "Waarschijnlijk overschot",
  HOLD: "Geen actie nodig",
} as const;

export const urgencyTone = {
  high: "text-alert",
  medium: "text-amber-700",
  low: "text-emerald-dark",
} as const;

export const purchaseOrderTone: Record<PurchaseOrder["status"], string> = {
  DRAFT: "bg-sky-100 text-sky-800 border-sky-200",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-light text-badge-green border-emerald/20",
  SENT_SIMULATED: "bg-[#efe7ff] text-[#5e3ea1] border-[#dbcafc]",
  REJECTED: "bg-[#f6e8e5] text-[#8f4b3e] border-[#eac8c0]",
};

export function euro(amount: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUnits(amount: number, unit: string) {
  return `${amount} ${unit}`;
}

export function getShortageHeadline(item: OrderAdviceItem) {
  if (item.advice === "ORDER") {
    return `Bestel ${item.reorderQuantity} ${item.product.unit} ${item.product.name.toLowerCase()}`;
  }
  if (item.advice === "NEEDS_REVIEW") {
    return `Controleer ${item.reorderQuantity} ${item.product.unit} ${item.product.name.toLowerCase()}`;
  }
  if (item.advice === "REDUCE") {
    return `Verminder ${item.product.name.toLowerCase()}`;
  }
  return `Houd ${item.product.name.toLowerCase()} aan`;
}

export function riskValue(item: OrderAdviceItem) {
  return Math.max(
    item.financialImpact.potentialLostRevenue,
    item.financialImpact.potentialWasteCost,
    item.financialImpact.estimatedProfitImpact,
  );
}

export function sortAdvice(items: OrderAdviceItem[]) {
  const urgencyRank = { high: 0, medium: 1, low: 2 };
  const adviceRank = { NEEDS_REVIEW: 0, ORDER: 1, REDUCE: 2, HOLD: 3 };

  return [...items].sort((left, right) => {
    const urgencyDelta = urgencyRank[left.urgency] - urgencyRank[right.urgency];
    if (urgencyDelta !== 0) return urgencyDelta;

    const adviceDelta = adviceRank[left.advice] - adviceRank[right.advice];
    if (adviceDelta !== 0) return adviceDelta;

    return riskValue(right) - riskValue(left);
  });
}
