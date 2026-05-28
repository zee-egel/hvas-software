from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
import json
from math import ceil
from pathlib import Path
from statistics import mean
from typing import Any

import pandas as pd

from app.order_advice_seed import (
    PRODUCT_CATALOG,
    generate_initial_inventory,
    generate_sales_history,
)


PURCHASE_ORDER_STATUSES = {
    "DRAFT",
    "NEEDS_REVIEW",
    "APPROVED",
    "SENT_SIMULATED",
    "REJECTED",
}


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def round_reorder_quantity(unit: str, quantity: float) -> float:
    if quantity <= 0:
        return 0.0
    if unit in {"pcs", "bottle", "head"}:
        return float(ceil(quantity))
    if unit in {"kg", "ltr"}:
        return round(ceil(quantity * 2) / 2, 1)
    if unit == "dozen":
        return float(ceil(quantity))
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

    # POC assumption: demand that cannot be served becomes missed revenue.
    shortage_risk = round(min(1.0, shortage_units / max(required_stock, 1.0)), 2)
    potential_lost_revenue = round(shortage_units * product["sellingPrice"], 2)

    # POC assumption: only the waste-prone share of overstock becomes actual waste.
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
    required_stock = reorder_data["requiredStock"]
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


def generate_purchase_order_draft(
    supplier_name: str,
    items: list[dict[str, Any]],
    state_record: dict[str, Any] | None,
) -> dict[str, Any]:
    purchase_order_id = f"po-{supplier_name.lower().replace(' ', '-').replace('&', 'and')}"
    status = state_record["status"] if state_record else (
        "NEEDS_REVIEW" if any(item["urgency"] == "high" for item in items) else "DRAFT"
    )
    if status not in PURCHASE_ORDER_STATUSES:
        status = "DRAFT"

    total_amount = round(
        sum(item["reorderQuantity"] * item["product"]["costPrice"] for item in items),
        2,
    )
    expected_delivery_date = (
        date.today() + timedelta(days=max(item["product"]["leadTimeDays"] for item in items))
    ).isoformat()
    total_protected_revenue = round(
        sum(item["financialImpact"]["potentialLostRevenue"] for item in items),
        2,
    )
    total_prevented_waste = round(
        sum(item["financialImpact"]["potentialWasteCost"] for item in items if item["recommendationType"] == "REDUCE"),
        2,
    )

    return {
        "id": purchase_order_id,
        "supplierName": supplier_name,
        "status": status,
        "itemCount": len(items),
        "totalAmount": total_amount,
        "expectedDeliveryDate": expected_delivery_date,
        "isSimulated": True,
        "lastUpdated": state_record["updatedAt"] if state_record else utc_timestamp(),
        "products": [
            {
                "productId": item["product"]["id"],
                "productName": item["product"]["name"],
                "quantity": item["reorderQuantity"],
                "unit": item["product"]["unit"],
                "lineAmount": round(item["reorderQuantity"] * item["product"]["costPrice"], 2),
                "reason": item["explanation"],
                "impact": item["financialImpact"]["potentialLostRevenue"],
                "urgency": item["urgency"],
            }
            for item in items
        ],
        "summary": {
            "totalProtectedRevenue": total_protected_revenue,
            "totalPreventedWaste": total_prevented_waste,
        },
    }


class SmartOrderAssistantService:
    def __init__(self, state_path: str) -> None:
        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.products = [dict(product) for product in PRODUCT_CATALOG]
        self.sales_history = generate_sales_history(weeks=12)
        self.state = self._load_state()

    def get_order_advice(self) -> dict[str, Any]:
        products = self._build_product_advice()
        purchase_orders = self._build_purchase_orders(products)
        top_urgent = [item for item in products if item["recommendationType"] == "ORDER"][:3]
        biggest_waste_risks = sorted(
            products,
            key=lambda item: item["financialImpact"]["potentialWasteCost"],
            reverse=True,
        )[:3]
        todays_actions = self._build_todays_actions(products, purchase_orders)

        estimated_weekly_savings = round(
            sum(
                max(0.0, item["financialImpact"]["estimatedProfitImpact"])
                for item in products
                if item["recommendationType"] in {"ORDER", "REDUCE"}
            ),
            2,
        )
        protected_revenue = round(
            sum(item["financialImpact"]["potentialLostRevenue"] for item in products if item["recommendationType"] == "ORDER"),
            2,
        )
        prevented_waste = round(
            sum(item["financialImpact"]["potentialWasteCost"] for item in products if item["recommendationType"] == "REDUCE"),
            2,
        )
        draft_orders = [
            order for order in purchase_orders["active"] if order["status"] in {"DRAFT", "NEEDS_REVIEW"}
        ]
        risks_found = len(
            [item for item in products if item["recommendationType"] in {"ORDER", "REDUCE"}]
        )

        return {
            "generatedAt": utc_timestamp(),
            "magicSummary": {
                "checkedProducts": len(products),
                "risksFound": risks_found,
                "draftOrdersCount": len(draft_orders),
                "protectedRevenue": protected_revenue,
                "preventedWaste": prevented_waste,
                "lastUpdateLabel": "vandaag",
                "message": (
                    f"HVAS heeft {len(products)} producten gecontroleerd, "
                    f"{risks_found} risico's gevonden en {len(draft_orders)} conceptorders voorbereid."
                ),
            },
            "summary": {
                "estimatedWeeklySavings": estimated_weekly_savings,
                "urgentOrdersCount": len([item for item in products if item["recommendationType"] == "ORDER"]),
                "highestWasteRiskCost": round(
                    max((item["financialImpact"]["potentialWasteCost"] for item in products), default=0.0),
                    2,
                ),
                "highestShortageRiskRevenue": round(
                    max((item["financialImpact"]["potentialLostRevenue"] for item in products), default=0.0),
                    2,
                ),
            },
            "topUrgentAdvice": top_urgent,
            "biggestWasteRisks": biggest_waste_risks,
            "todaysActions": todays_actions,
            "purchaseOrders": purchase_orders,
            "filters": {
                "categories": sorted({item["product"]["category"] for item in products}),
                "adviceTypes": ["ORDER", "REDUCE", "HOLD"],
                "urgencyLevels": ["high", "medium", "low"],
            },
            "products": products,
        }

    def get_purchase_orders(self) -> dict[str, Any]:
        snapshot = self.get_order_advice()
        return {
            "generatedAt": snapshot["generatedAt"],
            "active": snapshot["purchaseOrders"]["active"],
            "history": snapshot["purchaseOrders"]["history"],
        }

    def update_inventory(self, updates: list[dict[str, Any]]) -> dict[str, float]:
        updated: dict[str, float] = {}
        product_ids = {product["id"] for product in self.products}
        for item in updates:
            product_id = int(item["productId"])
            if product_id not in product_ids:
                raise ValueError(f"Unknown productId {product_id}")
            current_stock = round(max(0.0, float(item["currentStock"])), 1)
            self.state["inventory"][str(product_id)] = current_stock
            updated[str(product_id)] = current_stock
        self.state["updatedAt"] = utc_timestamp()
        self._save_state()
        return updated

    def approve_purchase_order(self, purchase_order_id: str) -> dict[str, Any]:
        active_orders = self.get_purchase_orders()["active"]
        match = next((order for order in active_orders if order["id"] == purchase_order_id), None)
        if match is None:
            raise ValueError(f"Unknown purchase order {purchase_order_id}")

        now = utc_timestamp()
        self.state["purchaseOrders"][purchase_order_id] = {
            "status": "SENT_SIMULATED",
            "updatedAt": now,
        }
        self._upsert_order_history(match, "SENT_SIMULATED", now)
        self._save_state()
        return self.get_order_advice()

    def reject_purchase_order(self, purchase_order_id: str) -> dict[str, Any]:
        active_orders = self.get_purchase_orders()["active"]
        match = next((order for order in active_orders if order["id"] == purchase_order_id), None)
        if match is None:
            raise ValueError(f"Unknown purchase order {purchase_order_id}")

        now = utc_timestamp()
        self.state["purchaseOrders"][purchase_order_id] = {
            "status": "REJECTED",
            "updatedAt": now,
        }
        self._upsert_order_history(match, "REJECTED", now)
        self._save_state()
        return self.get_order_advice()

    def _build_product_advice(self) -> list[dict[str, Any]]:
        items = []
        inventory = self.state["inventory"]
        for product in self.products:
            product_sales = [
                sale for sale in self.sales_history if sale["productId"] == product["id"]
            ]
            horizon_days = max(3, min(7, int(product["leadTimeDays"]) + 2))
            current_stock = float(inventory.get(str(product["id"]), 0.0))
            forecast = calculate_forecast(product, product_sales, horizon_days)
            reorder_data = calculate_reorder_quantity(product, current_stock, forecast)
            financial_impact = calculate_financial_impact(product, current_stock, reorder_data)
            explanation, no_action_message = build_explanation(
                product,
                current_stock,
                reorder_data,
                financial_impact,
            )
            recent_sales_history = [
                {
                    "date": sale["date"],
                    "quantity": float(sale["quantitySold"]),
                }
                for sale in product_sales[-14:]
            ]

            urgency_score = (
                financial_impact["shortageRisk"] * 55
                + min(25, product["leadTimeDays"] * 6)
                + min(20, product["wasteRiskPercentage"] * 0.4)
            )
            item = {
                "product": {
                    key: value
                    for key, value in product.items()
                    if key not in {"baseDailyDemand", "currentStock", "seasonality", "variability"}
                },
                "currentStock": round(current_stock, 1),
                "recentSalesHistory": recent_sales_history,
                "forecast": forecast,
                **reorder_data,
                "advice": reorder_data["recommendationType"],
                "urgencyScore": round(urgency_score, 1),
                "explanation": explanation,
                "noActionMessage": no_action_message,
                "financialImpact": financial_impact,
                "autoOrderStatus": None,
                "linkedPurchaseOrderId": None,
                "calculationBreakdown": {
                    "expectedDemandDuringLeadTime": reorder_data["expectedDemandDuringLeadTime"],
                    "safetyStock": product["safetyStock"],
                    "currentStock": round(current_stock, 1),
                    "requiredStock": reorder_data["requiredStock"],
                    "leadTimeDays": product["leadTimeDays"],
                },
            }
            items.append(item)

        items.sort(
            key=lambda item: (
                {"high": 0, "medium": 1, "low": 2}[item["urgency"]],
                {"ORDER": 0, "REDUCE": 1, "HOLD": 2}[item["recommendationType"]],
                -item["financialImpact"]["estimatedProfitImpact"],
            )
        )
        return items

    def _build_purchase_orders(self, product_items: list[dict[str, Any]]) -> dict[str, Any]:
        grouped: dict[str, list[dict[str, Any]]] = {}
        for item in product_items:
            if item["recommendationType"] != "ORDER" or item["reorderQuantity"] <= 0:
                continue
            grouped.setdefault(item["product"]["supplierName"], []).append(item)

        active_orders = []
        for supplier_name, items in grouped.items():
            purchase_order_id = f"po-{supplier_name.lower().replace(' ', '-').replace('&', 'and')}"
            state_record = self.state["purchaseOrders"].get(purchase_order_id)
            order = generate_purchase_order_draft(supplier_name, items, state_record)
            active_orders.append(order)
            for item in items:
                item["linkedPurchaseOrderId"] = order["id"]
                item["autoOrderStatus"] = order["status"]

        history = sorted(
            self.state["orderHistory"],
            key=lambda item: item["updatedAt"],
            reverse=True,
        )[:8]

        active_orders.sort(
            key=lambda order: (
                {"NEEDS_REVIEW": 0, "DRAFT": 1, "REJECTED": 2, "APPROVED": 3, "SENT_SIMULATED": 4}.get(order["status"], 5),
                order["expectedDeliveryDate"],
            )
        )

        return {
            "active": active_orders,
            "history": history,
        }

    def _build_todays_actions(
        self,
        products: list[dict[str, Any]],
        purchase_orders: dict[str, Any],
    ) -> list[dict[str, Any]]:
        actions = []
        for order in purchase_orders["active"]:
            if order["status"] in {"DRAFT", "NEEDS_REVIEW"}:
                actions.append(
                    {
                        "id": f"approve-{order['id']}",
                        "type": "PURCHASE_ORDER",
                        "title": f"Goedkeuren: bestelling bij {order['supplierName']}",
                        "description": (
                            f"{order['itemCount']} producten klaargezet voor "
                            f"{order['expectedDeliveryDate']} met een inkoopwaarde van {order['totalAmount']:.2f} euro."
                        ),
                        "impact": order["summary"]["totalProtectedRevenue"],
                        "status": order["status"],
                        "targetId": order["id"],
                    }
                )

        waste_candidate = next(
            (item for item in products if item["recommendationType"] == "REDUCE"),
            None,
        )
        if waste_candidate is not None:
            actions.append(
                {
                    "id": f"waste-{waste_candidate['product']['id']}",
                    "type": "PRODUCT",
                    "title": f"Controleer waste-risico: {waste_candidate['product']['name']}",
                    "description": waste_candidate["noActionMessage"],
                    "impact": waste_candidate["financialImpact"]["potentialWasteCost"],
                    "status": "WARNING",
                    "targetId": waste_candidate["product"]["id"],
                }
            )

        friday_peak_candidate = next(
            (item for item in products if item["recommendationType"] == "ORDER"),
            None,
        )
        if friday_peak_candidate is not None:
            actions.append(
                {
                    "id": f"product-{friday_peak_candidate['product']['id']}",
                    "type": "PRODUCT",
                    "title": f"Bestel extra {friday_peak_candidate['product']['name'].lower()}",
                    "description": friday_peak_candidate["explanation"],
                    "impact": friday_peak_candidate["financialImpact"]["potentialLostRevenue"],
                    "status": friday_peak_candidate["urgency"].upper(),
                    "targetId": friday_peak_candidate["product"]["id"],
                }
            )

        return sorted(actions, key=lambda item: item["impact"], reverse=True)[:3]

    def _upsert_order_history(
        self,
        purchase_order: dict[str, Any],
        status: str,
        updated_at: str,
    ) -> None:
        history = self.state["orderHistory"]
        record = {
            "id": purchase_order["id"],
            "supplierName": purchase_order["supplierName"],
            "status": status,
            "updatedAt": updated_at,
            "itemCount": purchase_order["itemCount"],
            "totalAmount": purchase_order["totalAmount"],
            "expectedDeliveryDate": purchase_order["expectedDeliveryDate"],
        }
        existing_index = next(
            (index for index, item in enumerate(history) if item["id"] == purchase_order["id"]),
            None,
        )
        if existing_index is None:
            history.append(record)
        else:
            history[existing_index] = record

    def _load_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            state = self._default_state()
            self._write_state(state)
            return state

        try:
            with self.state_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            state = self._default_state()
            self._write_state(state)
            return state

        inventory_payload = payload.get("inventory", {})
        if inventory_payload and all(isinstance(key, str) for key in inventory_payload):
            inventory = {str(key): float(value) for key, value in inventory_payload.items()}
        else:
            inventory = {
                str(item["productId"]): float(item["currentStock"])
                for item in generate_initial_inventory()
            }

        purchase_orders = payload.get("purchaseOrders", {})
        order_history = payload.get("orderHistory", [])
        return {
            "inventory": inventory,
            "purchaseOrders": purchase_orders,
            "orderHistory": order_history,
            "updatedAt": payload.get("updatedAt", utc_timestamp()),
        }

    def _default_state(self) -> dict[str, Any]:
        return {
            "inventory": {
                str(item["productId"]): float(item["currentStock"])
                for item in generate_initial_inventory()
            },
            "purchaseOrders": {},
            "orderHistory": [],
            "updatedAt": utc_timestamp(),
        }

    def _save_state(self) -> None:
        self._write_state(self.state)

    def _write_state(self, state: dict[str, Any]) -> None:
        with self.state_path.open("w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2)
