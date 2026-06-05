from __future__ import annotations

from datetime import UTC, datetime, timedelta
from math import ceil
from statistics import mean
from typing import Any

import pandas as pd


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def round_reorder_quantity(unit: str, quantity: float) -> float:
    if quantity <= 0:
        return 0.0
    if unit in {"pcs", "bottle", "head", "dozen"}:
        return float(ceil(quantity))
    if unit in {"kg", "ltr"}:
        return round(ceil(quantity * 2) / 2, 1)
    return round(quantity, 1)


def calculate_forecast(
    product: dict[str, Any],
    sales_history: list[dict[str, Any]],
    horizon_days: int,
) -> dict[str, Any]:
    sales_frame = pd.DataFrame(sales_history)
    sales_frame["date"] = pd.to_datetime(sales_frame["date"])
    sales_frame = sales_frame.sort_values("date")
    sales_frame["weekday"] = sales_frame["date"].dt.weekday

    weekday_groups = {
        int(weekday): group["quantitySold"].astype(float).tolist()
        for weekday, group in sales_frame.groupby("weekday")
    }
    moving_average_window = sales_frame.tail(14)["quantitySold"].astype(float).tolist()
    moving_average = mean(moving_average_window) if moving_average_window else 0.0

    last_history_date = sales_frame["date"].max().date()
    daily_forecast: list[dict[str, Any]] = []
    methods_used: list[str] = []

    for step in range(1, horizon_days + 1):
        forecast_date = last_history_date + timedelta(days=step)
        weekday = forecast_date.weekday()
        weekday_values = weekday_groups.get(weekday, [])

        if len(weekday_values) >= 8:
            predicted = mean(weekday_values)
            methods_used.append("weekday_average")
        else:
            predicted = moving_average
            methods_used.append("moving_average")

        daily_forecast.append(
            {
                "date": forecast_date.isoformat(),
                "quantity": round(predicted, 1),
            }
        )

    expected_demand = round(sum(item["quantity"] for item in daily_forecast), 1)
    recent_values = sales_frame.tail(21)["quantitySold"].astype(float).tolist()
    variation = pd.Series(recent_values).std() if len(recent_values) > 1 else 0.0
    variation_ratio = 0.0 if moving_average <= 0 else min(
        1.0,
        float(variation) / max(moving_average, 1.0),
    )
    sample_score = min(1.0, len(sales_frame) / 56)
    confidence_score = round(
        max(35.0, min(96.0, (sample_score * (1 - variation_ratio * 0.6)) * 100)),
        1,
    )

    unique_methods = sorted(set(methods_used))
    if unique_methods == ["weekday_average"]:
        method_used = "weekday_average"
    elif unique_methods == ["moving_average"]:
        method_used = "moving_average"
    else:
        method_used = "hybrid"

    explanation = (
        f"Verwachte vraag voor {horizon_days} dagen op basis van "
        f"{'weekday average' if method_used != 'moving_average' else 'moving average fallback'}."
    )

    return {
        "expectedDemand": expected_demand,
        "confidenceScore": confidence_score,
        "methodUsed": method_used,
        "explanation": explanation,
        "dailyForecast": daily_forecast,
        "horizonDays": horizon_days,
    }


def calculate_reorder_quantity(
    product: dict[str, Any],
    current_stock: float,
    forecast: dict[str, Any],
) -> dict[str, Any]:
    lead_time_days = max(1, int(product["leadTimeDays"]))
    demand_points = forecast["dailyForecast"][:lead_time_days]
    expected_demand_during_lead_time = round(
        sum(point["quantity"] for point in demand_points),
        1,
    )
    required_stock = round(
        expected_demand_during_lead_time + float(product["safetyStock"]),
        1,
    )
    raw_gap = required_stock - current_stock
    reorder_quantity = round_reorder_quantity(product["unit"], raw_gap)
    excess_stock = round(max(0.0, current_stock - required_stock), 1)

    if reorder_quantity > 0:
        recommendation_type = "ORDER"
    elif (
        excess_stock > max(4.0, expected_demand_during_lead_time * 0.45)
        and product["wasteRiskPercentage"] >= 18
    ):
        recommendation_type = "REDUCE"
    else:
        recommendation_type = "HOLD"

    shortage_ratio = max(0.0, required_stock - current_stock) / max(required_stock, 1.0)
    if recommendation_type == "ORDER" and shortage_ratio >= 0.45:
        urgency = "high"
    elif recommendation_type == "REDUCE" and product["wasteRiskPercentage"] >= 22:
        urgency = "medium"
    elif recommendation_type == "ORDER":
        urgency = "medium"
    else:
        urgency = "low"

    return {
        "expectedDemandDuringLeadTime": expected_demand_during_lead_time,
        "requiredStock": required_stock,
        "reorderQuantity": reorder_quantity,
        "excessStock": excess_stock,
        "recommendationType": recommendation_type,
        "urgency": urgency,
    }


def calculate_financial_impact(
    product: dict[str, Any],
    current_stock: float,
    reorder_data: dict[str, Any],
) -> dict[str, float]:
    expected_demand_during_lead_time = reorder_data["expectedDemandDuringLeadTime"]
    required_stock = reorder_data["requiredStock"]
    reorder_quantity = reorder_data["reorderQuantity"]
    recommendation_type = reorder_data["recommendationType"]

    shortage_units = max(0.0, required_stock - current_stock)
    surplus_units = max(0.0, current_stock - required_stock)
    margin_per_unit = max(0.0, product["sellingPrice"] - product["costPrice"])

    shortage_risk = round(min(1.0, shortage_units / max(required_stock, 1.0)), 2)
    potential_lost_revenue = round(shortage_units * product["sellingPrice"], 2)
    perishability_multiplier = max(
        0.35,
        min(1.0, 10 / max(product["shelfLifeDays"], 1)),
    )
    potential_waste_cost = round(
        surplus_units
        * product["costPrice"]
        * (product["wasteRiskPercentage"] / 100)
        * perishability_multiplier,
        2,
    )

    if recommendation_type == "ORDER":
        estimated_profit_impact = round(
            shortage_units * margin_per_unit - (reorder_quantity * product["costPrice"] * 0.06),
            2,
        )
    elif recommendation_type == "REDUCE":
        estimated_profit_impact = round(potential_waste_cost, 2)
    else:
        estimated_profit_impact = round(
            max(0.0, (expected_demand_during_lead_time - current_stock) * margin_per_unit * 0.5),
            2,
        )

    return {
        "shortageRisk": shortage_risk,
        "potentialLostRevenue": potential_lost_revenue,
        "potentialWasteCost": potential_waste_cost,
        "estimatedProfitImpact": estimated_profit_impact,
    }


def build_explanation(
    product: dict[str, Any],
    current_stock: float,
    reorder_data: dict[str, Any],
    financial_impact: dict[str, float],
) -> tuple[str, str]:
    expected_demand = reorder_data["expectedDemandDuringLeadTime"]
    reorder_quantity = reorder_data["reorderQuantity"]
    recommendation_type = reorder_data["recommendationType"]
    excess_stock = reorder_data["excessStock"]

    if recommendation_type == "ORDER":
        explanation = (
            f"Bijbestellen aanbevolen: {reorder_quantity:g} {product['unit']} "
            f"om de verwachte vraag tijdens de lead time plus safety stock af te dekken."
        )
        no_action_message = (
            f"Als je niets doet, loop je naar verwachting tot "
            f"{financial_impact['potentialLostRevenue']:.2f} euro omzet mis."
        )
    elif recommendation_type == "REDUCE":
        explanation = (
            f"Waarschijnlijk overschot: {product['name']} ligt circa {excess_stock:g} {product['unit']} "
            f"boven de benodigde voorraad en is relatief bederfelijk."
        )
        no_action_message = (
            f"Als je niets doet, riskeer je circa "
            f"{financial_impact['potentialWasteCost']:.2f} euro wastekosten."
        )
    else:
        explanation = (
            f"Geen actie nodig: {current_stock:g} {product['unit']} dekt de verwachte vraag "
            f"van {expected_demand:g} {product['unit']} met voldoende buffer."
        )
        no_action_message = "Als je niets doet, blijft het risico deze periode beperkt."

    return explanation, no_action_message
