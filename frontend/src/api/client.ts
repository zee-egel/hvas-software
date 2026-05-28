export interface RestaurantProfile {
  id: string;
  name: string;
  location: string;
  type: string;
  openingHours: Record<string, string>;
  serviceMoments: string[];
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: "include",
    ...init,
  });
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  companyName: string;
  role: string;
  initials: string;
  onboardingCompleted: boolean;
  onboardingData: OnboardingData;
  onboardingCompletedAt?: string | null;
  workspaceMode: "starter" | "live";
}

export interface OnboardingData {
  restaurantType?: string;
  acquisitionSource?: string;
  orderingDecisionStyle?: string;
  orderingFrequency?: string;
  initialProducts: string[];
  suppliers: string[];
  forecastingSignals: string[];
  restaurantLocation?: {
    city?: string;
    postalCodeOrNeighborhood?: string;
  };
  primaryGoal?: string;
  digitalTwinSetup?: {
    selectedMethods: string[];
    recommendedMethods: string[];
  };
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface OnboardingStateResponse {
  onboardingCompleted: boolean;
  onboardingData: OnboardingData;
  completedAt?: string | null;
}

export interface Product {
  id: number;
  productCode?: string;
  name: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  wasteRiskPercentage: number;
  safetyStock: number;
  leadTimeDays: number;
  shelfLifeDays: number;
  category: string;
  supplierName: string;
}

export interface ForecastPoint {
  date: string;
  quantity: number;
  baselineQuantity?: number;
}

export interface SalesHistoryPoint {
  date: string;
  quantity: number;
}

export interface ForecastData {
  expectedDemand: number;
  confidenceScore: number;
  methodUsed: string;
  explanation: string;
  dailyForecast: ForecastPoint[];
  baselineForecast?: ForecastPoint[];
  horizonDays: number;
}

export interface FinancialImpact {
  shortageRisk: number;
  potentialLostRevenue: number;
  potentialWasteCost: number;
  estimatedProfitImpact: number;
  protectedRevenue: number;
  expectedOrderCost: number;
}

export interface InfluencingFactor {
  label: string;
  direction: "increase" | "decrease";
  impact: "high" | "medium" | "low";
}

export interface PurchaseOrderLine {
  productId: number;
  productCode?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  lineAmount?: number;
  reason: string;
  impact?: number;
  urgency?: "high" | "medium" | "low";
  linkedAdviceId?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierName: string;
  status: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "SENT_SIMULATED" | "REJECTED";
  itemCount: number;
  totalAmount: number;
  totalEstimatedCost?: number;
  expectedDeliveryDate: string;
  isSimulated: boolean;
  lastUpdated: string;
  createdAt?: string;
  reason?: string;
  products: PurchaseOrderLine[];
  productLines?: PurchaseOrderLine[];
  summary: {
    totalProtectedRevenue: number;
    totalPreventedWaste: number;
  };
}

export interface PurchaseOrderHistoryItem {
  id: string;
  supplierName: string;
  status: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "SENT_SIMULATED" | "REJECTED";
  updatedAt: string;
  itemCount: number;
  totalAmount: number;
  expectedDeliveryDate: string;
}

export interface TodayAction {
  id: string;
  type: "PURCHASE_ORDER" | "PRODUCT";
  title: string;
  description: string;
  impact: number;
  status: string;
  targetId: string | number;
}

export interface OrderAdviceItem {
  id: string;
  productId: number;
  productCode?: string;
  productName: string;
  category: string;
  unit: string;
  supplierName: string;
  currentStock: number;
  expectedDemandNext7Days: number;
  expectedDemandDuringLeadTime: number;
  reorderQuantity: number;
  adviceType: "ORDER" | "NEEDS_REVIEW" | "REDUCE" | "HOLD";
  urgency: "high" | "medium" | "low";
  confidenceScore: number;
  financialImpact: FinancialImpact;
  influencingFactors: InfluencingFactor[];
  explanation: string;
  whatIfNoAction: string;
  linkedPurchaseOrderId: string | null;
  autoOrderStatus: PurchaseOrder["status"] | null;
  recentSalesHistory: SalesHistoryPoint[];
  forecast: ForecastData;
  baselineForecast: ForecastPoint[];
  methodUsed: string;
  modelDiagnostics: Record<string, number | boolean>;
  forecastHorizonDays: number;
  product: Product;
  advice: "ORDER" | "NEEDS_REVIEW" | "REDUCE" | "HOLD";
  recommendationType: "ORDER" | "NEEDS_REVIEW" | "REDUCE" | "HOLD";
  noActionMessage: string;
  requiredStock: number;
  excessStock: number;
  urgencyScore: number;
  calculationBreakdown: {
    expectedDemandDuringLeadTime: number;
    safetyStock: number;
    currentStock: number;
    requiredStock: number;
    leadTimeDays: number;
  };
}

export interface OrderAdviceResponse {
  restaurant: RestaurantProfile;
  generatedAt: string;
  summary: {
    productsChecked: number;
    urgentActions: number;
    purchaseOrdersPrepared: number;
    protectedRevenue: number;
    potentialWastePrevented: number;
    estimatedProfitImpact: number;
    estimatedWeeklySavings?: number;
    urgentOrdersCount?: number;
    highestWasteRiskCost?: number;
    highestShortageRiskRevenue?: number;
  };
  topActions: TodayAction[];
  riskRadar: {
    shortageWatch: OrderAdviceItem[];
    wasteWatch: OrderAdviceItem[];
    reviewNeeded: OrderAdviceItem[];
  };
  productAdvice: OrderAdviceItem[];
  purchaseOrderDrafts: PurchaseOrder[];
  purchaseOrderHistory: PurchaseOrderHistoryItem[];
  evaluation: {
    aggregate: {
      mae: number;
      rmse: number;
      wape: number;
      stockoutSimulationRate: number;
      wasteSimulationRate: number;
    };
    byProduct: Array<{
      productId: number;
      mae: number;
      rmse: number;
      wape: number;
      stockoutSimulationRate: number;
      wasteSimulationRate: number;
    }>;
  };
  magicSummary: {
    checkedProducts: number;
    risksFound: number;
    draftOrdersCount: number;
    protectedRevenue: number;
    preventedWaste: number;
    lastUpdateLabel: string;
    message: string;
  };
  topUrgentAdvice: OrderAdviceItem[];
  biggestWasteRisks: OrderAdviceItem[];
  todaysActions: TodayAction[];
  purchaseOrders: {
    active: PurchaseOrder[];
    history: PurchaseOrderHistoryItem[];
  };
  filters: {
    categories: string[];
    adviceTypes: Array<"ORDER" | "NEEDS_REVIEW" | "REDUCE" | "HOLD">;
    urgencyLevels: Array<"high" | "medium" | "low">;
  };
  products: OrderAdviceItem[];
  dataFreshness: {
    sales: "fresh" | "stale" | "missing";
    inventory: "fresh" | "stale" | "missing";
    waste: "fresh" | "stale" | "missing";
    overall: "fresh" | "stale" | "missing";
  };
  dataCompleteness: {
    countedProducts: number;
    totalProducts: number;
    missingSupplierMappings: number;
    sufficientSalesHistoryProducts: number;
  };
  blockingIssues: Array<{
    code: string;
    severity: "warning" | "critical";
    productId: number;
    message: string;
  }>;
  sourceTimestamps: {
    lastSalesIngestAt: string | null;
    lastStockCountAt: string | null;
    lastWasteIngestAt: string | null;
    lastAdviceRunAt: string | null;
  };
}

export interface SmartOrderingContextProduct {
  productId: number;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  supplierId: number | null;
  supplierName: string | null;
  currentStock: number;
  outstandingIncomingQuantity: number;
  recentUsageDays: number;
  recentUsageTotal: number;
  averageDailyUsage: number;
  minimumStock: number;
  packageQuantity: number;
  packageLabel: string;
  unitCost: number;
  supplierAvailable: boolean;
  stockDataStatus: "ok" | "missing" | "stale";
}

export interface SmartOrderingContextResponse {
  generatedAt: string;
  restaurant: RestaurantProfile;
  suppliers: Array<{
    supplierId: number;
    supplierName: string;
    active: boolean;
  }>;
  products: SmartOrderingContextProduct[];
}

export interface SmartOrderSuggestion {
  productId: number;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  supplierId: number | null;
  supplierName: string | null;
  expectedUsage: number;
  averageDailyUsage: number;
  currentStock: number;
  outstandingIncomingQuantity: number;
  safetyBuffer: number;
  requiredQuantity: number;
  suggestedQuantity: number;
  packageQuantity: number;
  packageLabel: string;
  estimatedLineCost: number;
  confidenceScore: number;
  confidence: "low" | "medium" | "high";
  warnings: Array<
    | "NO_SUPPLIER_LINKED"
    | "MISSING_STOCK_DATA"
    | "LOW_CONFIDENCE"
    | "PACKAGE_OVER_ORDER"
    | "BELOW_MINIMUM_STOCK"
    | "OUT_OF_STOCK"
    | "SUPPLIER_UNAVAILABLE"
  >;
  stockDataStatus: "ok" | "missing" | "stale";
  supplierAvailable: boolean;
  minimumStock: number;
}

export interface SmartOrderingForecastResponse {
  period: {
    days: number;
    start: string;
    end: string;
  };
  summary: {
    expectedRevenue: number;
    expectedCovers: number;
    confidence: "low" | "medium" | "high";
  };
  suggestions: SmartOrderSuggestion[];
}

export interface SmartSupplierOrderLine {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  supplierId: number | null;
  supplierName: string;
  unitCost: number;
  estimatedLineCost: number;
  packageQuantity: number;
  packageLabel: string;
  warnings: SmartOrderSuggestion["warnings"];
}

export interface SmartSupplierOrderDraft {
  draftOrderId: string;
  supplierId: number | null;
  supplierName: string;
  status: string;
  expectedDeliveryDate: string;
  deliveryNote: string;
  estimatedTotalCost: number;
  totalProducts: number;
  productLines: SmartSupplierOrderLine[];
}

export interface InventoryUpdateItem {
  productId: number;
  currentStock: number;
}

export interface RestaurantResponse {
  restaurant: RestaurantProfile;
  generatedAt: string;
  inventory: Array<{
    productId: number;
    productName: string;
    category: string;
    unit: string;
    currentStock: number;
    supplierName: string;
  }>;
  suppliers: string[];
  contextOutlook: Array<Record<string, unknown>>;
}

export interface ImportJobStatus {
  id: number;
  importType: string;
  sourceSystem: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  recordCount: number;
  acceptedCount: number;
  rejectedCount: number;
  errors: Array<{ item: Record<string, unknown>; error: string }>;
}

export interface ImportStatusResponse {
  jobs: ImportJobStatus[];
  latestAdviceRunAt: string | null;
}

export interface ProductConfigItem {
  id: number;
  name: string;
  unit: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  wasteRiskPercentage: number;
  safetyStock: number;
  leadTimeDays: number;
  shelfLifeDays: number;
  reorderMultiple: number;
  active: boolean;
  supplierId: number | null;
  supplierName: string | null;
}

export interface SupplierConfigItem {
  id: number;
  name: string;
  defaultLeadTimeDays: number;
  active: boolean;
}

export interface HistoricalDatasetImportResponse {
  success: boolean;
  sourceSystem: string;
  rowsProcessed: number;
  productsTouched: number;
  importResults: {
    sales: {
      acceptedCount: number;
      rejectedCount: number;
    } | null;
    inventoryCounts: {
      acceptedCount: number;
      rejectedCount: number;
    } | null;
    receipts: {
      acceptedCount: number;
      rejectedCount: number;
    } | null;
    waste: {
      acceptedCount: number;
      rejectedCount: number;
    } | null;
  };
  snapshot: OrderAdviceResponse;
}

export interface LiveSimulationConfig {
  order_variance: number;
  restock_threshold: number;
  restock_amount: number;
  lookback_weeks: number;
  usage_variance_pct: number;
  waste_variance_pct: number;
  learning_rate_pct: number;
}

export interface LiveSimulationIngredientUsage {
  ingredientId: number;
  ingredientName: string;
  expectedUsage: number;
  actualUsage: number;
  learnedMultiplier: number;
  confidence: number;
  variancePct: number;
}

export interface LiveSimulationSummary {
  average_usage_skew_pct: number;
  average_absolute_skew_pct: number;
  most_volatile_ingredient: LiveSimulationIngredientUsage | null;
  low_stock_ingredients: string[];
}

export interface LiveSimulationState {
  predicted_food_orders: Record<string, number>;
  food_orders_this_week: Record<string, number>;
  model_accuracy: number[];
  inventory: Record<string, number>;
  restocked_ingredients: Record<string, number>;
  current_week: number;
  current_time: string;
  config: LiveSimulationConfig;
  is_running: boolean;
  predicted_orders: Record<string, number>;
  actual_orders: Record<string, number>;
  accuracy_history: number[];
  ingredient_usage: LiveSimulationIngredientUsage[];
  variance_summary: LiveSimulationSummary;
  recent_events: string[];
  generated_at: string;
}

export interface ApiIngredient {
  id: number;
  name: string;
}

export interface ApiRecipeIngredient {
  ingredientId: number;
  name: string;
  quantity: number;
}

export interface ApiRecipe {
  id: number;
  name: string;
  ingredients: ApiRecipeIngredient[];
}

export async function fetchOrderAdvice(): Promise<OrderAdviceResponse> {
  const res = await apiFetch("/api/order-advice");
  if (!res.ok) throw new Error(`Failed to fetch order advice: ${res.status}`);
  return res.json();
}

export async function fetchSmartOrderingContext(): Promise<SmartOrderingContextResponse> {
  const res = await apiFetch("/api/smart-ordering/context");
  if (!res.ok)
    throw new Error(`Failed to fetch smart ordering context: ${res.status}`);
  return res.json();
}

export async function fetchSmartOrderingForecast(payload: {
  days: number;
  includeCurrentStock: boolean;
  includeOutstandingOrders: boolean;
}): Promise<SmartOrderingForecastResponse> {
  const res = await apiFetch("/api/smart-ordering/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch smart ordering forecast: ${res.status}`);
  return res.json();
}

export async function createSmartOrderDraft(payload: {
  days: number;
  includeCurrentStock: boolean;
  includeOutstandingOrders: boolean;
  suggestions: Array<{
    productId: number;
    accepted: boolean;
    quantity: number;
    unit: string;
    supplierId: number | null;
  }>;
}): Promise<{
  period: {
    days: number;
    start: string;
    end: string;
  };
  draftOrders: SmartSupplierOrderDraft[];
  summary: {
    supplierCount: number;
    totalProducts: number;
    estimatedTotalCost: number;
  };
}> {
  const res = await apiFetch("/api/smart-ordering/order-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok)
    throw new Error(`Failed to create smart order draft: ${res.status}`);
  return res.json();
}

export async function placeSmartOrders(draftOrderIds: string[]): Promise<{
  placedAt: string;
  orders: Array<{
    draftOrderId: string;
    supplierId: number | null;
    supplierName: string;
    status: string;
    estimatedTotalCost: number;
  }>;
}> {
  const res = await apiFetch("/api/smart-ordering/place-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftOrderIds }),
  });
  if (!res.ok) throw new Error(`Failed to place smart orders: ${res.status}`);
  return res.json();
}

export async function fetchRestaurant(): Promise<RestaurantResponse> {
  const res = await apiFetch("/api/restaurant");
  if (!res.ok)
    throw new Error(`Failed to fetch restaurant snapshot: ${res.status}`);
  return res.json();
}

export async function fetchPurchaseOrders(): Promise<{
  restaurant: RestaurantProfile;
  generatedAt: string;
  active: PurchaseOrder[];
  history: PurchaseOrderHistoryItem[];
}> {
  const res = await apiFetch("/api/purchase-orders");
  if (!res.ok)
    throw new Error(`Failed to fetch purchase orders: ${res.status}`);
  return res.json();
}

export async function fetchLiveSimulation(): Promise<LiveSimulationState> {
  const res = await apiFetch("/api/live-simulation");
  if (!res.ok)
    throw new Error(`Failed to fetch live simulation: ${res.status}`);
  return res.json();
}

export async function startLiveSimulation(): Promise<LiveSimulationState> {
  const res = await apiFetch("/api/live-simulation/start", { method: "POST" });
  if (!res.ok)
    throw new Error(`Failed to start live simulation: ${res.status}`);
  return res.json();
}

export async function stopLiveSimulation(): Promise<LiveSimulationState> {
  const res = await apiFetch("/api/live-simulation/stop", { method: "POST" });
  if (!res.ok) throw new Error(`Failed to stop live simulation: ${res.status}`);
  return res.json();
}

export async function tickLiveSimulation(): Promise<LiveSimulationState> {
  const res = await apiFetch("/api/live-simulation/tick", { method: "POST" });
  if (!res.ok)
    throw new Error(`Failed to advance live simulation: ${res.status}`);
  return res.json();
}

export async function resetLiveSimulation(): Promise<LiveSimulationState> {
  const res = await apiFetch("/api/live-simulation/reset", { method: "POST" });
  if (!res.ok)
    throw new Error(`Failed to reset live simulation: ${res.status}`);
  return res.json();
}

export async function updateLiveSimulationConfig(
  config: Partial<LiveSimulationConfig>,
): Promise<LiveSimulationConfig> {
  const res = await apiFetch("/api/live-simulation/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok)
    throw new Error(`Failed to update live simulation config: ${res.status}`);
  return res.json();
}

export async function approvePurchaseOrder(
  id: string,
): Promise<{ success: boolean; snapshot: OrderAdviceResponse }> {
  const res = await apiFetch(`/api/purchase-orders/${id}/approve`, {
    method: "POST",
  });
  if (!res.ok)
    throw new Error(`Failed to approve purchase order: ${res.status}`);
  return res.json();
}

export async function rejectPurchaseOrder(
  id: string,
): Promise<{ success: boolean; snapshot: OrderAdviceResponse }> {
  const res = await apiFetch(`/api/purchase-orders/${id}/reject`, {
    method: "POST",
  });
  if (!res.ok)
    throw new Error(`Failed to reject purchase order: ${res.status}`);
  return res.json();
}

export async function updateInventory(items: InventoryUpdateItem[]): Promise<{
  success: boolean;
  updated: Record<string, number>;
  importResult: {
    jobId: number;
    status: string;
    recordCount: number;
    acceptedCount: number;
    rejectedCount: number;
    errors: Array<{ item: Record<string, unknown>; error: string }>;
  };
  orderAdvice: OrderAdviceResponse;
}> {
  const res = await apiFetch("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Failed to update inventory: ${res.status}`);
  return res.json();
}

export async function fetchImportStatus(): Promise<ImportStatusResponse> {
  const res = await apiFetch("/api/import/status");
  if (!res.ok) throw new Error(`Failed to fetch import status: ${res.status}`);
  return res.json();
}

export async function fetchProductConfig(): Promise<ProductConfigItem[]> {
  const res = await apiFetch("/api/config/products");
  if (!res.ok) throw new Error(`Failed to fetch product config: ${res.status}`);
  const payload = (await res.json()) as { items: ProductConfigItem[] };
  return payload.items;
}

export async function updateProductConfig(
  id: number,
  updates: Partial<ProductConfigItem>,
): Promise<ProductConfigItem> {
  const res = await apiFetch(`/api/config/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok)
    throw new Error(`Failed to update product config: ${res.status}`);
  return res.json();
}

export async function fetchSupplierConfig(): Promise<SupplierConfigItem[]> {
  const res = await apiFetch("/api/config/suppliers");
  if (!res.ok)
    throw new Error(`Failed to fetch supplier config: ${res.status}`);
  const payload = (await res.json()) as { items: SupplierConfigItem[] };
  return payload.items;
}

export async function updateSupplierConfig(
  id: number,
  updates: Partial<SupplierConfigItem>,
): Promise<SupplierConfigItem> {
  const res = await apiFetch(`/api/config/suppliers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok)
    throw new Error(`Failed to update supplier config: ${res.status}`);
  return res.json();
}

export async function importHistoricalDataset(
  file: File,
  sourceSystem = "historical_dataset",
): Promise<HistoricalDatasetImportResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("sourceSystem", sourceSystem);
  const res = await apiFetch("/api/import/historical-dataset", {
    method: "POST",
    body,
  });
  if (!res.ok) {
    throw new Error(`Failed to import historical dataset: ${res.status}`);
  }
  return res.json();
}

export async function fetchAuthSession(): Promise<AuthSessionResponse> {
  const res = await apiFetch("/api/auth/session");
  if (!res.ok) throw new Error(`Failed to fetch auth session: ${res.status}`);
  return res.json();
}

export async function loginUser(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<{ success: boolean; user: AuthUser }> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok)
    throw new Error(
      await readErrorMessage(res, `Failed to login: ${res.status}`),
    );
  return res.json();
}

export async function signupUser(payload: {
  fullName: string;
  email: string;
  companyName: string;
  password: string;
  rememberMe?: boolean;
}): Promise<{ success: boolean; user: AuthUser }> {
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok)
    throw new Error(
      await readErrorMessage(res, `Failed to sign up: ${res.status}`),
    );
  return res.json();
}

export async function logoutUser(): Promise<{ success: boolean }> {
  const res = await apiFetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error(`Failed to logout: ${res.status}`);
  return res.json();
}

export async function fetchOnboarding(): Promise<OnboardingStateResponse> {
  const res = await apiFetch("/api/onboarding");
  if (!res.ok) throw new Error(`Failed to fetch onboarding: ${res.status}`);
  return res.json();
}

export async function saveOnboarding(payload: {
  data: OnboardingData;
  completed?: boolean;
}): Promise<{
  success: boolean;
  user: AuthUser;
  onboarding: OnboardingStateResponse;
}> {
  const res = await apiFetch("/api/onboarding", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok)
    throw new Error(
      await readErrorMessage(res, `Failed to save onboarding: ${res.status}`),
    );
  return res.json();
}

export async function resetOnboarding(): Promise<{
  success: boolean;
  user: AuthUser;
  onboarding: OnboardingStateResponse;
}> {
  const res = await apiFetch("/api/onboarding/reset", { method: "POST" });
  if (!res.ok)
    throw new Error(
      await readErrorMessage(res, `Failed to reset onboarding: ${res.status}`),
    );
  return res.json();
}

export async function fetchRecipes(): Promise<ApiRecipe[]> {
  const res = await apiFetch("/api/recipes");
  if (!res.ok) throw new Error(`Failed to fetch recipes: ${res.status}`);
  return res.json();
}

export async function createRecipe(
  name: string,
  ingredients: { ingredientId: number; quantity: number }[],
): Promise<{ success: boolean; id: number }> {
  const res = await apiFetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ingredients }),
  });
  if (!res.ok)
    throw new Error(await readErrorMessage(res, `Failed to create recipe: ${res.status}`));
  return res.json();
}

export async function deleteRecipe(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok)
    throw new Error(await readErrorMessage(res, `Failed to delete recipe: ${res.status}`));
  return res.json();
}

export async function fetchIngredients(): Promise<ApiIngredient[]> {
  const res = await apiFetch("/api/ingredients");
  if (!res.ok) throw new Error(`Failed to fetch ingredients: ${res.status}`);
  return res.json();
}

export async function createIngredient(
  name: string,
): Promise<{ success: boolean; id: number }> {
  const res = await apiFetch("/api/ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok)
    throw new Error(
      await readErrorMessage(res, `Failed to create ingredient: ${res.status}`),
    );
  return res.json();
}
