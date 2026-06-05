import type { OnboardingData } from "../api/client";

export type DigitalTwinMethod =
  | "Upload recent supplier invoices"
  | "Import product list"
  | "Connect POS system"
  | "Enter current stock manually"
  | "Start with demo/sample data";

export type DigitalTwinMethodDetails = {
  method: DigitalTwinMethod;
  why: string;
  effort: string;
  predicts: string;
  confidence: string;
};

const methodCatalog: Record<DigitalTwinMethod, Omit<DigitalTwinMethodDetails, "method">> = {
  "Upload recent supplier invoices": {
    why: "Invoices quickly reveal the real products, supplier naming, and package patterns you already buy.",
    effort: "10-15 min",
    predicts: "Starter product demand, supplier drafts, and first replenishment structure.",
    confidence: "Medium",
  },
  "Import product list": {
    why: "A clean catalog gives HVAS the fastest path to product coverage without operational history.",
    effort: "5-10 min",
    predicts: "Product-aware ordering suggestions and clearer setup completeness.",
    confidence: "Medium",
  },
  "Connect POS system": {
    why: "Sales data gives HVAS the strongest signal for demand prediction and seasonality.",
    effort: "20-45 min",
    predicts: "Demand forecasting, day patterns, and stronger reorder confidence.",
    confidence: "High",
  },
  "Enter current stock manually": {
    why: "Even one stock count prevents the first forecast from starting blind.",
    effort: "10 min",
    predicts: "Near-term replenishment and shortage prevention.",
    confidence: "Medium",
  },
  "Start with demo/sample data": {
    why: "Useful when you want to finish onboarding now and return with real imports later.",
    effort: "1 min",
    predicts: "No live forecasting until products and history are imported.",
    confidence: "Low",
  },
};

export function getDigitalTwinRecommendations(
  restaurantType?: string,
): DigitalTwinMethod[] {
  switch (restaurantType) {
    case "Cafe / lunchroom":
    case "Fast casual":
      return [
        "Upload recent supplier invoices",
        "Enter current stock manually",
        "Connect POS system",
      ];
    case "Delivery / ghost kitchen":
      return [
        "Connect POS system",
        "Import product list",
        "Upload recent supplier invoices",
      ];
    case "Fine dining":
      return [
        "Upload recent supplier invoices",
        "Import product list",
        "Enter current stock manually",
      ];
    case "Bar / pub":
      return [
        "Upload recent supplier invoices",
        "Connect POS system",
        "Enter current stock manually",
      ];
    default:
      return [
        "Upload recent supplier invoices",
        "Enter current stock manually",
        "Import product list",
      ];
  }
}

export function getDigitalTwinMethodDetails(
  restaurantType?: string,
): DigitalTwinMethodDetails[] {
  const recommended = new Set(getDigitalTwinRecommendations(restaurantType));
  const orderedMethods: DigitalTwinMethod[] = [
    ...getDigitalTwinRecommendations(restaurantType),
    ...(
      Object.keys(methodCatalog) as DigitalTwinMethod[]
    ).filter((method) => !recommended.has(method)),
  ];

  return orderedMethods.map((method) => ({
    method,
    ...methodCatalog[method],
  }));
}

export function getDigitalTwinCompleteness(onboarding: OnboardingData) {
  const selected = onboarding.digitalTwinSetup?.selectedMethods ?? [];
  const hasProducts = onboarding.initialProducts.length > 0;
  const hasSuppliers = onboarding.suppliers.length > 0;
  const hasUploadedDocs = (onboarding.uploadedDocuments?.length ?? 0) > 0;
  const hasNormalizedProducts = (onboarding.normalizedProducts?.length ?? 0) > 0;
  const hasManualStock = (onboarding.manualStockCounts?.length ?? 0) > 0;
  const hasPosProvider = Boolean(onboarding.posSetup?.provider);

  let score = 18;
  if (hasProducts) score += 22;
  if (hasSuppliers) score += 15;
  if (hasUploadedDocs) score += 10;
  if (hasNormalizedProducts) score += 12;
  if (selected.includes("Upload recent supplier invoices")) score += 18;
  if (selected.includes("Import product list")) score += 10;
  if (selected.includes("Connect POS system") || hasPosProvider) score += 20;
  if (selected.includes("Enter current stock manually") || hasManualStock) score += 12;
  if (selected.includes("Start with demo/sample data")) score = Math.max(score, 18);

  return Math.min(score, 100);
}
