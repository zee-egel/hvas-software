from __future__ import annotations

from math import ceil
from statistics import mean, pstdev
from typing import Any

from .types import ConfidenceLabel, SmartOrderingSuggestion, WarningCode


def package_label(package_quantity: float, unit: str) -> str:
    if package_quantity <= 0:
        return f"1 {unit}"
    return f"{package_quantity:g} {unit}"


def recent_usage_summary(sales_history: list[dict[str, Any]], history_days: int = 28) -> tuple[int, float, float]:
    recent_history = sales_history[-history_days:]
    usage_values = [float(item["quantitySold"]) for item in recent_history]
    days = len(usage_values)
    total_usage = round(sum(usage_values), 1)
    average_daily_usage = round(total_usage / days, 2) if days else 0.0
    return days, total_usage, average_daily_usage


def round_to_package_size(quantity: float, unit: str, package_quantity: float) -> float:
    if quantity <= 0:
        return 0.0
    rounded = quantity
    if unit in {"pcs", "bottle", "head", "dozen"}:
        rounded = float(ceil(quantity))
    elif unit in {"kg", "ltr"}:
        rounded = round(ceil(quantity * 2) / 2, 1)
    if package_quantity > 0:
        rounded = ceil(rounded / package_quantity) * package_quantity
    precision = 1 if unit in {"kg", "ltr"} else 0
    return round(rounded, precision)


def confidence_score(
    history_days: int,
    average_daily_usage: float,
    variability: float,
    has_stock_data: bool,
    stock_is_stale: bool,
    has_supplier: bool,
    supplier_available: bool,
) -> float:
    score = 92.0
    if history_days < 14:
        score -= 24.0
    elif history_days < 28:
        score -= 12.0
    if average_daily_usage > 0:
        score -= min(16.0, (variability / average_daily_usage) * 12.0)
    if not has_stock_data:
        score -= 18.0
    elif stock_is_stale:
        score -= 8.0
    if not has_supplier:
        score -= 12.0
    if not supplier_available:
        score -= 10.0
    return round(max(35.0, min(97.0, score)), 1)


def confidence_label(score: float) -> ConfidenceLabel:
    if score < 55:
        return "low"
    if score < 78:
        return "medium"
    return "high"


def build_warnings(
    supplier_id: int | None,
    current_stock: float,
    minimum_stock: float,
    has_stock_data: bool,
    stock_is_stale: bool,
    suggested_quantity: float,
    required_quantity: float,
    confidence: ConfidenceLabel,
    supplier_available: bool,
) -> list[WarningCode]:
    warnings: list[WarningCode] = []
    if supplier_id is None:
        warnings.append("NO_SUPPLIER_LINKED")
    if not has_stock_data or stock_is_stale:
        warnings.append("MISSING_STOCK_DATA")
    if confidence == "low":
        warnings.append("LOW_CONFIDENCE")
    if suggested_quantity > required_quantity and suggested_quantity > 0:
        warnings.append("PACKAGE_OVER_ORDER")
    if current_stock < minimum_stock:
        warnings.append("BELOW_MINIMUM_STOCK")
    if current_stock <= 0:
        warnings.append("OUT_OF_STOCK")
    if not supplier_available:
        warnings.append("SUPPLIER_UNAVAILABLE")
    return warnings


def calculate_suggestion(
    *,
    product: dict[str, Any],
    recent_usage_days: int,
    recent_usage_total: float,
    average_daily_usage: float,
    days: int,
    include_current_stock: bool,
    include_outstanding_orders: bool,
    current_stock: float,
    outstanding_incoming_quantity: float,
    has_stock_data: bool,
    stock_is_stale: bool,
) -> SmartOrderingSuggestion:
    recent_values = [float(item["quantitySold"]) for item in product["salesHistory"][-28:]]
    variability = pstdev(recent_values) if len(recent_values) > 1 else 0.0
    expected_usage = round(average_daily_usage * days, 1)
    safety_buffer = round(max(float(product["safetyStock"]) * min(1.0, days / 7), average_daily_usage * 0.15), 1)
    required_quantity = expected_usage + safety_buffer
    if include_current_stock:
        required_quantity -= current_stock
    if include_outstanding_orders:
        required_quantity -= outstanding_incoming_quantity
    required_quantity = round(max(0.0, required_quantity), 1)
    package_quantity = float(product["packageQuantity"] or 1.0)
    suggested_quantity = round_to_package_size(required_quantity, product["unit"], package_quantity)
    score = confidence_score(
        history_days=recent_usage_days,
        average_daily_usage=average_daily_usage,
        variability=variability,
        has_stock_data=has_stock_data,
        stock_is_stale=stock_is_stale,
        has_supplier=product["supplierId"] is not None,
        supplier_available=bool(product["supplierAvailable"]),
    )
    label = confidence_label(score)
    warnings = build_warnings(
        supplier_id=product["supplierId"],
        current_stock=current_stock,
        minimum_stock=float(product["minimumStock"]),
        has_stock_data=has_stock_data,
        stock_is_stale=stock_is_stale,
        suggested_quantity=suggested_quantity,
        required_quantity=required_quantity,
        confidence=label,
        supplier_available=bool(product["supplierAvailable"]),
    )
    return SmartOrderingSuggestion(
        productId=int(product["productId"]),
        productName=str(product["productName"]),
        category=str(product["category"]),
        unit=str(product["unit"]),
        supplierId=product["supplierId"],
        supplierName=product["supplierName"],
        expectedUsage=expected_usage,
        averageDailyUsage=round(average_daily_usage, 2),
        currentStock=round(current_stock, 1),
        outstandingIncomingQuantity=round(outstanding_incoming_quantity, 1),
        safetyBuffer=safety_buffer,
        requiredQuantity=required_quantity,
        suggestedQuantity=suggested_quantity,
        packageQuantity=package_quantity,
        packageLabel=package_label(package_quantity, str(product["unit"])),
        estimatedLineCost=round(suggested_quantity * float(product["unitCost"]), 2),
        confidenceScore=score,
        confidence=label,
        warnings=warnings,
        stockDataStatus="missing" if not has_stock_data else "stale" if stock_is_stale else "ok",
        supplierAvailable=bool(product["supplierAvailable"]),
        minimumStock=round(float(product["minimumStock"]), 1),
    )


def summarize_forecast(suggestions: list[SmartOrderingSuggestion], price_by_product_id: dict[int, float]) -> dict[str, Any]:
    if suggestions:
        average_score = mean(item.confidenceScore for item in suggestions)
    else:
        average_score = 72.0
    return {
        "expectedRevenue": round(
            sum(item.expectedUsage * price_by_product_id[item.productId] for item in suggestions),
            2,
        ),
        "expectedCovers": int(round(sum(item.expectedUsage for item in suggestions))),
        "confidence": confidence_label(average_score),
    }
