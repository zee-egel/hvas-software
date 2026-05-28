import type {
  OnboardingData,
  SmartOrderSuggestion,
  SmartOrderingForecastResponse,
  SmartSupplierOrderDraft,
} from "../api/client";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function averageDailyUsage(orderingFrequency?: string) {
  switch (orderingFrequency) {
    case "Daily":
      return 5.5;
    case "2–3 times per week":
      return 4;
    case "Weekly":
      return 2.6;
    case "Every two weeks":
      return 1.5;
    case "Irregular / when needed":
      return 2.2;
    default:
      return 3;
  }
}

function fallbackProducts(onboarding: OnboardingData) {
  return onboarding.initialProducts.length > 0
    ? onboarding.initialProducts
    : ["Chicken breast", "Tomatoes", "Fries"];
}

function fallbackSuppliers(onboarding: OnboardingData) {
  return onboarding.suppliers.length > 0
    ? onboarding.suppliers
    : ["Primary supplier"];
}

export function buildStarterSuggestions(
  onboarding: OnboardingData,
  days: number,
): SmartOrderSuggestion[] {
  const suppliers = fallbackSuppliers(onboarding);
  const products = fallbackProducts(onboarding);
  const dailyUsage = averageDailyUsage(onboarding.orderingFrequency);

  return products.map((productName, index) => {
    const supplierName = suppliers[index % suppliers.length] ?? "Primary supplier";
    const packageQuantity = 1;
    const expectedUsage = Number((dailyUsage * days * (1 + index * 0.08)).toFixed(1));
    const safetyBuffer = Number((Math.max(2, expectedUsage * 0.18)).toFixed(1));
    const suggestedQuantity = Math.ceil(expectedUsage + safetyBuffer);
    const estimatedLineCost = Number((suggestedQuantity * (4.5 + index * 1.4)).toFixed(2));

    return {
      productId: index + 1,
      productCode: slugify(productName),
      productName,
      category: onboarding.restaurantType ?? "Starter product",
      unit: "pcs",
      supplierId: index + 1,
      supplierName,
      expectedUsage,
      averageDailyUsage: Number((expectedUsage / days).toFixed(1)),
      currentStock: 0,
      outstandingIncomingQuantity: 0,
      safetyBuffer,
      requiredQuantity: suggestedQuantity,
      suggestedQuantity,
      packageQuantity,
      packageLabel: "1 pc",
      estimatedLineCost,
      confidenceScore: 44,
      confidence: "low",
      warnings: ["LOW_CONFIDENCE", "MISSING_STOCK_DATA"],
      stockDataStatus: "missing",
      supplierAvailable: true,
      minimumStock: Math.max(1, Math.round(safetyBuffer)),
    };
  });
}

export function buildStarterForecast(
  onboarding: OnboardingData,
  days: number,
): SmartOrderingForecastResponse {
  const suggestions = buildStarterSuggestions(onboarding, days);
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return {
    period: {
      days,
      start: start.toISOString(),
      end: end.toISOString(),
    },
    summary: {
      expectedRevenue: suggestions.reduce(
        (total, suggestion) => total + suggestion.suggestedQuantity * 12,
        0,
      ),
      expectedCovers: Math.max(18, days * 16),
      confidence: "low",
    },
    suggestions,
  };
}

export function buildStarterDrafts(
  suggestions: SmartOrderSuggestion[],
  quantities: Record<number, number>,
  acceptedIds: number[],
): {
  draftOrders: SmartSupplierOrderDraft[];
  summary: {
    supplierCount: number;
    totalProducts: number;
    estimatedTotalCost: number;
  };
} {
  const acceptedSet = new Set(acceptedIds);
  const chosen = suggestions.filter((suggestion) => acceptedSet.has(suggestion.productId));
  const bySupplier = new Map<string, SmartOrderSuggestion[]>();

  for (const suggestion of chosen) {
    const supplierName = suggestion.supplierName ?? "Unassigned supplier";
    const current = bySupplier.get(supplierName) ?? [];
    current.push(suggestion);
    bySupplier.set(supplierName, current);
  }

  const draftOrders = Array.from(bySupplier.entries()).map(([supplierName, lines], index) => {
    const productLines = lines.map((line) => {
      const quantity = quantities[line.productId] ?? line.suggestedQuantity;
      return {
        productId: line.productId,
        productCode: line.productCode,
        productName: line.productName,
        quantity,
        unit: line.unit,
        supplierId: line.supplierId,
        supplierName,
        unitCost: Number((line.estimatedLineCost / Math.max(quantity, 1)).toFixed(2)),
        estimatedLineCost: Number(
          ((line.estimatedLineCost / Math.max(line.suggestedQuantity, 1)) * quantity).toFixed(2),
        ),
        packageQuantity: line.packageQuantity,
        packageLabel: line.packageLabel,
        warnings: line.warnings,
      };
    });

    const estimatedTotalCost = Number(
      productLines.reduce((total, line) => total + line.estimatedLineCost, 0).toFixed(2),
    );
    const eta = new Date();
    eta.setDate(eta.getDate() + 2 + index);

    return {
      draftOrderId: `starter-draft-${index + 1}`,
      supplierId: index + 1,
      supplierName,
      status: "DRAFT",
      expectedDeliveryDate: eta.toISOString(),
      deliveryNote: "Starter draft based on your onboarding products and ordering cadence.",
      estimatedTotalCost,
      totalProducts: productLines.length,
      productLines,
    };
  });

  return {
    draftOrders,
    summary: {
      supplierCount: draftOrders.length,
      totalProducts: chosen.length,
      estimatedTotalCost: Number(
        draftOrders.reduce((total, order) => total + order.estimatedTotalCost, 0).toFixed(2),
      ),
    },
  };
}
