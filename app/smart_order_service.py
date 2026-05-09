from __future__ import annotations

from datetime import UTC, date, datetime
import json
from pathlib import Path
from typing import Any

try:
    from adjustments.context_adjustments import applyContextAdjustments
    from data.restaurant_simulation import generateRestaurantSimulation
    from decision.reorder import calculateReorderAdvice
    from evaluation.accuracy import aggregate_accuracy
    from forecasting.forecast_engine import evaluateForecastAccuracy, trainSarimaForecast
    from purchase_orders.drafts import generatePurchaseOrderDrafts, utc_timestamp
except ImportError:
    from .adjustments.context_adjustments import applyContextAdjustments
    from .data.restaurant_simulation import generateRestaurantSimulation
    from .decision.reorder import calculateReorderAdvice
    from .evaluation.accuracy import aggregate_accuracy
    from .forecasting.forecast_engine import evaluateForecastAccuracy, trainSarimaForecast
    from .purchase_orders.drafts import generatePurchaseOrderDrafts, utc_timestamp


def _sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
    advice_rank = {"NEEDS_REVIEW": 0, "ORDER": 1, "REDUCE": 2, "HOLD": 3}
    urgency_rank = {"high": 0, "medium": 1, "low": 2}
    return (
        urgency_rank.get(item["urgency"], 3),
        advice_rank.get(item["adviceType"], 4),
        -max(
            item["financialImpact"]["protectedRevenue"],
            item["financialImpact"]["potentialWasteCost"],
            item["financialImpact"]["estimatedProfitImpact"],
        ),
    )


class SmartOrderAssistantService:
    def __init__(self, state_path: str) -> None:
        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.simulation = generateRestaurantSimulation(weeks=52)
        self.restaurant = self.simulation["restaurant"]
        self.products = self.simulation["products"]
        self.sales_history = self.simulation["salesHistory"]
        self.future_context = self.simulation["futureContext"]
        self.sales_by_product = {
            product["id"]: [
                sale for sale in self.sales_history if sale["productId"] == product["id"]
            ]
            for product in self.products
        }
        self.category_averages = self._build_category_averages()
        self.state = self._load_state()
        self._forecast_cache: dict[str, dict[int, dict[str, Any]]] = {}
        self._evaluation_cache: dict[str, dict[str, Any]] = {}

    def get_health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "service": "smart-order-assistant",
            "generatedAt": utc_timestamp(),
            "restaurantId": self.restaurant["id"],
        }

    def get_restaurant(self) -> dict[str, Any]:
        inventory_map = self.state["inventory"]
        return {
            "restaurant": self.restaurant,
            "generatedAt": utc_timestamp(),
            "inventory": [
                {
                    "productId": product["id"],
                    "productName": product["name"],
                    "category": product["category"],
                    "unit": product["unit"],
                    "currentStock": inventory_map[str(product["id"])],
                    "supplierName": product["supplierName"],
                }
                for product in self.products
            ],
            "suppliers": sorted({product["supplierName"] for product in self.products}),
            "contextOutlook": self.future_context,
            "metadata": self.simulation["metadata"],
        }

    def get_order_advice(self) -> dict[str, Any]:
        product_advice = self._build_product_advice()
        purchase_order_drafts = generatePurchaseOrderDrafts(
            product_advice,
            self.state["purchaseOrders"],
        )
        purchase_history = sorted(
            self.state["orderHistory"],
            key=lambda item: item["updatedAt"],
            reverse=True,
        )[:8]

        order_map = {order["id"]: order for order in purchase_order_drafts}
        for item in product_advice:
            linked_order = next(
                (
                    order
                    for order in purchase_order_drafts
                    if any(line["linkedAdviceId"] == item["id"] for line in order["productLines"])
                ),
                None,
            )
            if linked_order is not None:
                item["linkedPurchaseOrderId"] = linked_order["id"]
                item["autoOrderStatus"] = linked_order["status"]

        product_advice.sort(key=_sort_key)
        top_actions = self._build_top_actions(product_advice, purchase_order_drafts)
        risk_radar = self._build_risk_radar(product_advice)
        evaluation = self._evaluate_products()

        summary = {
            "productsChecked": len(product_advice),
            "urgentActions": len([item for item in product_advice if item["urgency"] == "high"]),
            "purchaseOrdersPrepared": len(
                [order for order in purchase_order_drafts if order["status"] in {"DRAFT", "NEEDS_REVIEW"}]
            ),
            "protectedRevenue": round(sum(item["financialImpact"]["protectedRevenue"] for item in product_advice), 2),
            "potentialWastePrevented": round(sum(item["financialImpact"]["potentialWasteCost"] for item in product_advice if item["adviceType"] == "REDUCE"), 2),
            "estimatedProfitImpact": round(sum(max(0.0, item["financialImpact"]["estimatedProfitImpact"]) for item in product_advice), 2),
            "estimatedWeeklySavings": round(sum(max(0.0, item["financialImpact"]["estimatedProfitImpact"]) for item in product_advice), 2),
            "urgentOrdersCount": len([item for item in product_advice if item["adviceType"] in {"ORDER", "NEEDS_REVIEW"}]),
            "highestWasteRiskCost": round(max((item["financialImpact"]["potentialWasteCost"] for item in product_advice), default=0.0), 2),
            "highestShortageRiskRevenue": round(max((item["financialImpact"]["potentialLostRevenue"] for item in product_advice), default=0.0), 2),
        }

        response = {
            "restaurant": self.restaurant,
            "generatedAt": utc_timestamp(),
            "summary": summary,
            "topActions": top_actions,
            "riskRadar": risk_radar,
            "productAdvice": product_advice,
            "purchaseOrderDrafts": purchase_order_drafts,
            "purchaseOrderHistory": purchase_history,
            "evaluation": evaluation,
            # Compatibility layer for the current frontend structure.
            "magicSummary": {
                "checkedProducts": summary["productsChecked"],
                "risksFound": len([item for item in product_advice if item["adviceType"] in {"ORDER", "NEEDS_REVIEW", "REDUCE"}]),
                "draftOrdersCount": summary["purchaseOrdersPrepared"],
                "protectedRevenue": summary["protectedRevenue"],
                "preventedWaste": summary["potentialWastePrevented"],
                "lastUpdateLabel": "vandaag",
                "message": (
                    f"HVAS heeft {summary['productsChecked']} producten gecontroleerd, "
                    f"{summary['urgentActions']} urgente acties gevonden en {summary['purchaseOrdersPrepared']} conceptorders voorbereid."
                ),
            },
            "topUrgentAdvice": [item for item in product_advice if item["adviceType"] in {"ORDER", "NEEDS_REVIEW"}][:5],
            "biggestWasteRisks": sorted(product_advice, key=lambda item: item["financialImpact"]["potentialWasteCost"], reverse=True)[:5],
            "todaysActions": top_actions,
            "purchaseOrders": {"active": purchase_order_drafts, "history": purchase_history},
            "filters": {
                "categories": sorted({item["category"] for item in product_advice}),
                "adviceTypes": ["ORDER", "NEEDS_REVIEW", "REDUCE", "HOLD"],
                "urgencyLevels": ["high", "medium", "low"],
            },
            "products": product_advice,
        }

        _ = order_map
        return response

    def get_purchase_orders(self) -> dict[str, Any]:
        snapshot = self.get_order_advice()
        return {
            "restaurant": snapshot["restaurant"],
            "generatedAt": snapshot["generatedAt"],
            "active": snapshot["purchaseOrderDrafts"],
            "history": snapshot["purchaseOrderHistory"],
        }

    def approve_purchase_order(self, purchase_order_id: str) -> dict[str, Any]:
        active = self.get_purchase_orders()["active"]
        match = next((item for item in active if item["id"] == purchase_order_id), None)
        if match is None:
            raise ValueError(f"Unknown purchase order {purchase_order_id}")
        now = utc_timestamp()
        self.state["purchaseOrders"][purchase_order_id] = {
            "status": "SENT_SIMULATED",
            "createdAt": self.state["purchaseOrders"].get(purchase_order_id, {}).get("createdAt", now),
            "updatedAt": now,
        }
        self._upsert_order_history(match, "SENT_SIMULATED", now)
        self._save_state()
        return self.get_order_advice()

    def reject_purchase_order(self, purchase_order_id: str) -> dict[str, Any]:
        active = self.get_purchase_orders()["active"]
        match = next((item for item in active if item["id"] == purchase_order_id), None)
        if match is None:
            raise ValueError(f"Unknown purchase order {purchase_order_id}")
        now = utc_timestamp()
        self.state["purchaseOrders"][purchase_order_id] = {
            "status": "REJECTED",
            "createdAt": self.state["purchaseOrders"].get(purchase_order_id, {}).get("createdAt", now),
            "updatedAt": now,
        }
        self._upsert_order_history(match, "REJECTED", now)
        self._save_state()
        return self.get_order_advice()

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

    def _build_product_advice(self) -> list[dict[str, Any]]:
        forecast_payload = self._get_forecasts_for_today()
        inventory_map = self.state["inventory"]
        items: list[dict[str, Any]] = []
        for product in self.products:
            forecast = forecast_payload[product["id"]]
            current_stock = float(inventory_map[str(product["id"])])
            reorder = calculateReorderAdvice(
                product=product,
                current_stock=current_stock,
                adjusted_forecast=forecast["adjustedForecast"],
                confidence_score=forecast["confidenceScore"],
            )
            explanation, no_action = self._build_explanation(
                product=product,
                current_stock=current_stock,
                forecast=forecast,
                reorder=reorder,
            )
            advice_item = {
                "id": f"advice-{product['id']}",
                "productId": product["id"],
                "productName": product["name"],
                "category": product["category"],
                "unit": product["unit"],
                "supplierName": product["supplierName"],
                "costPrice": product["costPrice"],
                "sellingPrice": product["sellingPrice"],
                "leadTimeDays": product["leadTimeDays"],
                "shelfLifeDays": product["shelfLifeDays"],
                "safetyStock": product["safetyStock"],
                "reorderMultiple": product["reorderMultiple"],
                "currentStock": round(current_stock, 1),
                **reorder,
                "confidenceScore": forecast["confidenceScore"],
                "baselineForecast": forecast["baselineForecast"],
                "forecastHorizonDays": forecast["forecastHorizonDays"],
                "methodUsed": forecast["methodUsed"],
                "modelDiagnostics": forecast["modelDiagnostics"],
                "influencingFactors": forecast["influencingFactors"],
                "explanation": explanation,
                "whatIfNoAction": no_action,
                "linkedPurchaseOrderId": None,
                "autoOrderStatus": None,
                "recentSalesHistory": [
                    {
                        "date": point["date"],
                        "quantity": float(point["quantitySold"]),
                    }
                    for point in self.sales_by_product[product["id"]][-14:]
                ],
                "forecast": {
                    "expectedDemand": reorder["expectedDemandNext7Days"],
                    "confidenceScore": forecast["confidenceScore"],
                    "methodUsed": forecast["methodUsed"],
                    "explanation": explanation,
                    "dailyForecast": [
                        {"date": point["date"], "quantity": point["quantity"]}
                        for point in forecast["adjustedForecast"]
                    ],
                    "baselineForecast": forecast["baselineForecast"],
                    "horizonDays": forecast["forecastHorizonDays"],
                },
                "product": {
                    key: product[key]
                    for key in (
                        "id",
                        "name",
                        "unit",
                        "costPrice",
                        "sellingPrice",
                        "wasteRiskPercentage",
                        "safetyStock",
                        "leadTimeDays",
                        "shelfLifeDays",
                        "category",
                        "supplierName",
                    )
                },
                "advice": reorder["adviceType"],
                "recommendationType": reorder["adviceType"],
                "noActionMessage": no_action,
                "calculationBreakdown": {
                    "expectedDemandDuringLeadTime": reorder["expectedDemandDuringLeadTime"],
                    "safetyStock": product["safetyStock"],
                    "currentStock": round(current_stock, 1),
                    "requiredStock": reorder["requiredStock"],
                    "leadTimeDays": product["leadTimeDays"],
                },
                "urgencyScore": round(
                    reorder["financialImpact"]["shortageRisk"] * 50
                    + (25 if reorder["adviceType"] in {"ORDER", "NEEDS_REVIEW"} else 10 if reorder["adviceType"] == "REDUCE" else 0)
                    + (15 if forecast["confidenceScore"] < 55 else 0)
                    + min(10, product["wasteRiskPercentage"] * 0.4),
                    1,
                ),
            }
            items.append(advice_item)
        return items

    def _build_explanation(
        self,
        product: dict[str, Any],
        current_stock: float,
        forecast: dict[str, Any],
        reorder: dict[str, Any],
    ) -> tuple[str, str]:
        factors = forecast["influencingFactors"]
        factor_text = ", ".join(factor["label"].lower() for factor in factors[:3]) if factors else "het recente verkooppatroon"

        if reorder["adviceType"] in {"ORDER", "NEEDS_REVIEW"}:
            explanation = (
                f"HVAS verwacht extra vraag naar {product['name'].lower()} door {factor_text}. "
                f"De huidige voorraad is lager dan de verwachte vraag tijdens de levertijd."
            )
            if reorder["adviceType"] == "NEEDS_REVIEW":
                explanation += " De forecast is minder zeker, dus deze bestelling vraagt extra controle."
            what_if = (
                f"Als je niets doet, is er naar schatting {reorder['requiredStock'] - current_stock:.1f} {product['unit']} tekort "
                f"en loop je ongeveer {reorder['financialImpact']['potentialLostRevenue']:.0f} euro omzet mis."
            )
        elif reorder["adviceType"] == "REDUCE":
            explanation = (
                f"HVAS verwacht voldoende vraag, maar de voorraad van {product['name'].lower()} ligt ruim boven de behoefte voor de komende week."
            )
            what_if = (
                f"Als je niets doet, riskeer je ongeveer {reorder['financialImpact']['potentialWasteCost']:.0f} euro waste door bederf of overschot."
            )
        else:
            explanation = f"Waarschijnlijk genoeg voorraad: {product['name'].lower()} dekt de komende vraag met safety stock."
            what_if = "Als je niets doet, blijft het risico voorlopig beperkt."

        return explanation, what_if

    def _build_top_actions(
        self,
        product_advice: list[dict[str, Any]],
        purchase_order_drafts: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        for order in purchase_order_drafts:
            if order["status"] in {"DRAFT", "NEEDS_REVIEW"}:
                actions.append(
                    {
                        "id": f"approve-{order['id']}",
                        "type": "PURCHASE_ORDER",
                        "title": f"Goedkeuren: bestelling bij {order['supplierName']}",
                        "description": f"{order['itemCount']} producten staan klaar voor levering op {order['expectedDeliveryDate']}.",
                        "impact": order["summary"]["totalProtectedRevenue"],
                        "status": order["status"],
                        "targetId": order["id"],
                    }
                )
        for item in product_advice:
            if item["adviceType"] == "REDUCE":
                actions.append(
                    {
                        "id": f"reduce-{item['productId']}",
                        "type": "PRODUCT",
                        "title": f"Controleer waste-risico: {item['productName']}",
                        "description": item["whatIfNoAction"],
                        "impact": item["financialImpact"]["potentialWasteCost"],
                        "status": item["adviceType"],
                        "targetId": item["productId"],
                    }
                )
                break
        for item in product_advice:
            if item["adviceType"] in {"ORDER", "NEEDS_REVIEW"}:
                actions.append(
                    {
                        "id": f"order-{item['productId']}",
                        "type": "PRODUCT",
                        "title": f"Bestel extra {item['productName'].lower()}",
                        "description": item["explanation"],
                        "impact": item["financialImpact"]["protectedRevenue"],
                        "status": item["urgency"].upper(),
                        "targetId": item["productId"],
                    }
                )
                break
        actions.sort(key=lambda item: item["impact"], reverse=True)
        return actions[:4]

    def _build_risk_radar(self, product_advice: list[dict[str, Any]]) -> dict[str, Any]:
        shortage = sorted(
            product_advice,
            key=lambda item: item["financialImpact"]["potentialLostRevenue"],
            reverse=True,
        )[:3]
        waste = sorted(
            product_advice,
            key=lambda item: item["financialImpact"]["potentialWasteCost"],
            reverse=True,
        )[:3]
        return {
            "shortageWatch": shortage,
            "wasteWatch": waste,
            "reviewNeeded": [item for item in product_advice if item["adviceType"] == "NEEDS_REVIEW"][:3],
        }

    def _evaluate_products(self) -> dict[str, Any]:
        cache_key = date.today().isoformat()
        if cache_key in self._evaluation_cache:
            return self._evaluation_cache[cache_key]

        product_metrics = []
        for product in self.products:
            metrics = evaluateForecastAccuracy(
                self.sales_by_product[product["id"]],
                self.category_averages[product["category"]],
                horizon_days=14,
            )
            product_metrics.append({"productId": product["id"], **metrics})

        evaluation = {
            "aggregate": aggregate_accuracy(product_metrics),
            "byProduct": product_metrics,
        }
        self._evaluation_cache[cache_key] = evaluation
        return evaluation

    def _get_forecasts_for_today(self) -> dict[int, dict[str, Any]]:
        cache_key = date.today().isoformat()
        if cache_key in self._forecast_cache:
            return self._forecast_cache[cache_key]

        results: dict[int, dict[str, Any]] = {}
        for product in self.products:
            baseline = trainSarimaForecast(
                self.sales_by_product[product["id"]],
                horizon_days=7,
                category_average=self.category_averages[product["category"]],
            )
            adjusted = applyContextAdjustments(product, baseline.baselineForecast, self.future_context)
            results[product["id"]] = {
                "baselineForecast": baseline.baselineForecast,
                "adjustedForecast": adjusted["adjustedForecast"],
                "methodUsed": baseline.methodUsed,
                "confidenceScore": baseline.confidenceScore,
                "modelDiagnostics": baseline.modelDiagnostics,
                "forecastHorizonDays": baseline.forecastHorizonDays,
                "influencingFactors": adjusted["influencingFactors"],
            }

        self._forecast_cache[cache_key] = results
        return results

    def _build_category_averages(self) -> dict[str, float]:
        grouped: dict[str, list[float]] = {}
        for product in self.products:
            grouped.setdefault(product["category"], []).append(product["baseDailyDemand"])
        return {category: round(sum(values) / len(values), 1) for category, values in grouped.items()}

    def _upsert_order_history(self, purchase_order: dict[str, Any], status: str, updated_at: str) -> None:
        record = {
            "id": purchase_order["id"],
            "supplierName": purchase_order["supplierName"],
            "status": status,
            "updatedAt": updated_at,
            "itemCount": purchase_order["itemCount"],
            "totalAmount": purchase_order["totalEstimatedCost"],
            "expectedDeliveryDate": purchase_order["expectedDeliveryDate"],
        }
        history = self.state["orderHistory"]
        existing_index = next((index for index, item in enumerate(history) if item["id"] == record["id"]), None)
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

        inventory = payload.get("inventory", {})
        default_inventory = self._default_state()["inventory"]
        if not inventory:
            inventory = default_inventory
        else:
            inventory = {
                **default_inventory,
                **{str(key): float(value) for key, value in inventory.items()},
            }
        purchase_orders = payload.get("purchaseOrders", {})
        order_history = payload.get("orderHistory", [])
        return {
            "inventory": {str(key): float(value) for key, value in inventory.items()},
            "purchaseOrders": purchase_orders,
            "orderHistory": order_history,
            "updatedAt": payload.get("updatedAt", utc_timestamp()),
        }

    def _default_state(self) -> dict[str, Any]:
        return {
            "inventory": {
                str(item["productId"]): float(item["currentStock"])
                for item in self.simulation["inventory"]
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
