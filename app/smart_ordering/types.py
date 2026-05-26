from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal


ConfidenceLabel = Literal["low", "medium", "high"]
WarningCode = Literal[
    "NO_SUPPLIER_LINKED",
    "MISSING_STOCK_DATA",
    "LOW_CONFIDENCE",
    "PACKAGE_OVER_ORDER",
    "BELOW_MINIMUM_STOCK",
    "OUT_OF_STOCK",
    "SUPPLIER_UNAVAILABLE",
]


@dataclass(frozen=True)
class SmartOrderingProductContext:
    productId: int
    productName: str
    category: str
    unit: str
    supplierId: int | None
    supplierName: str | None
    currentStock: float
    outstandingIncomingQuantity: float
    recentUsageDays: int
    recentUsageTotal: float
    averageDailyUsage: float
    minimumStock: float
    packageQuantity: float
    packageLabel: str
    unitCost: float
    supplierAvailable: bool
    stockDataStatus: Literal["ok", "missing", "stale"]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SmartOrderingSuggestion:
    productId: int
    productName: str
    category: str
    unit: str
    supplierId: int | None
    supplierName: str | None
    expectedUsage: float
    averageDailyUsage: float
    currentStock: float
    outstandingIncomingQuantity: float
    safetyBuffer: float
    requiredQuantity: float
    suggestedQuantity: float
    packageQuantity: float
    packageLabel: str
    estimatedLineCost: float
    confidenceScore: float
    confidence: ConfidenceLabel
    warnings: list[WarningCode]
    stockDataStatus: Literal["ok", "missing", "stale"]
    supplierAvailable: bool
    minimumStock: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SupplierOrderLine:
    productId: int
    productName: str
    quantity: float
    unit: str
    supplierId: int | None
    supplierName: str
    unitCost: float
    estimatedLineCost: float
    packageQuantity: float
    packageLabel: str
    warnings: list[WarningCode]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SupplierOrderDraft:
    draftOrderId: str
    supplierId: int | None
    supplierName: str
    status: str
    deliveryNote: str
    estimatedTotalCost: float
    totalProducts: int
    productLines: list[SupplierOrderLine]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["productLines"] = [line.to_dict() for line in self.productLines]
        return payload
