from __future__ import annotations

from math import ceil
from typing import Any


def round_quantity(unit: str, quantity: float, reorder_multiple: float) -> float:
    if quantity <= 0:
        return 0.0

    if reorder_multiple > 1:
        return float(ceil(quantity / reorder_multiple) * reorder_multiple)

    if unit in {"kg", "ltr"}:
        return round(ceil(quantity * 2) / 2, 1)
    if unit in {"pcs", "bottle", "head", "dozen"}:
        return float(ceil(quantity))
    return round(quantity, 1)


def calculateFinancialImpact(
    product: dict[str, Any],
    current_stock: float,
    reorder_quantity: float,
    expected_demand_next_7_days: float,
    expected_demand_during_lead_time: float,
    required_stock: float,
    excess_stock: float,
) -> dict[str, float]:
    shortage_qty = max(0.0, required_stock - current_stock)
    margin = max(0.0, product["sellingPrice"] - product["costPrice"])

    # POC assumption: unmet demand maps directly to lost sales opportunity.
    potential_lost_revenue = round(min(shortage_qty, expected_demand_next_7_days) * product["sellingPrice"], 2)
    protected_revenue = potential_lost_revenue

    # POC assumption: only the perishable overstock share turns into actual waste.
    excess_perishable_qty = excess_stock * product["perishability"]
    potential_waste_cost = round(
        excess_perishable_qty * product["costPrice"] * (product["wasteRiskPercentage"] / 100),
        2,
    )
    expected_order_cost = round(reorder_quantity * product["costPrice"], 2)

    if reorder_quantity > 0:
        estimated_profit_impact = round((min(shortage_qty, expected_demand_during_lead_time) * margin) - (expected_order_cost * 0.04), 2)
    else:
        estimated_profit_impact = round(potential_waste_cost, 2)

    shortage_risk = round(min(1.0, shortage_qty / max(required_stock, 1.0)), 2)
    return {
        "shortageRisk": shortage_risk,
        "potentialLostRevenue": potential_lost_revenue,
        "potentialWasteCost": potential_waste_cost,
        "estimatedProfitImpact": estimated_profit_impact,
        "protectedRevenue": protected_revenue,
        "expectedOrderCost": expected_order_cost,
    }


def calculateReorderAdvice(
    product: dict[str, Any],
    current_stock: float,
    adjusted_forecast: list[dict[str, Any]],
    confidence_score: float,
) -> dict[str, Any]:
    expected_demand_next_7_days = round(sum(point["quantity"] for point in adjusted_forecast), 1)
    lead_time_days = max(1, int(product["leadTimeDays"]))
    expected_demand_during_lead_time = round(
        sum(point["quantity"] for point in adjusted_forecast[:lead_time_days]),
        1,
    )
    required_stock = round(expected_demand_during_lead_time + product["safetyStock"], 1)
    raw_reorder = max(0.0, required_stock - current_stock)
    reorder_quantity = round_quantity(product["unit"], raw_reorder, float(product["reorderMultiple"]))
    excess_stock = round(max(0.0, current_stock - (expected_demand_next_7_days + product["safetyStock"] * 0.6)), 1)

    if reorder_quantity > 0 and confidence_score < 55:
        advice_type = "NEEDS_REVIEW"
    elif reorder_quantity > 0:
        advice_type = "ORDER"
    elif excess_stock > max(product["safetyStock"], expected_demand_next_7_days * 0.5) and product["perishability"] >= 0.55:
        advice_type = "REDUCE"
    else:
        advice_type = "HOLD"

    urgency = "high" if raw_reorder > product["safetyStock"] * 0.5 else "medium" if advice_type in {"ORDER", "NEEDS_REVIEW", "REDUCE"} else "low"
    if advice_type == "REDUCE" and product["wasteRiskPercentage"] >= 22:
        urgency = "high"

    financial_impact = calculateFinancialImpact(
        product=product,
        current_stock=current_stock,
        reorder_quantity=reorder_quantity,
        expected_demand_next_7_days=expected_demand_next_7_days,
        expected_demand_during_lead_time=expected_demand_during_lead_time,
        required_stock=required_stock,
        excess_stock=excess_stock,
    )
    return {
        "expectedDemandNext7Days": expected_demand_next_7_days,
        "expectedDemandDuringLeadTime": expected_demand_during_lead_time,
        "requiredStock": required_stock,
        "reorderQuantity": reorder_quantity,
        "excessStock": excess_stock,
        "adviceType": advice_type,
        "urgency": urgency,
        "financialImpact": financial_impact,
    }

