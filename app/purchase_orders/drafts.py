from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any


PURCHASE_ORDER_STATUSES = {
    "DRAFT",
    "NEEDS_REVIEW",
    "APPROVED",
    "SENT_SIMULATED",
    "REJECTED",
}


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def generatePurchaseOrderDrafts(
    product_advice: list[dict[str, Any]],
    stored_purchase_orders: dict[str, Any],
) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in product_advice:
        if item["adviceType"] not in {"ORDER", "NEEDS_REVIEW"} or item["reorderQuantity"] <= 0:
            continue
        grouped.setdefault(item["supplierName"], []).append(item)

    purchase_orders: list[dict[str, Any]] = []
    for supplier_name, items in grouped.items():
        order_id = f"po-{supplier_name.lower().replace(' ', '-')}"
        stored = stored_purchase_orders.get(order_id, {})
        status = stored.get("status")
        if status not in PURCHASE_ORDER_STATUSES:
            status = "NEEDS_REVIEW" if any(item["adviceType"] == "NEEDS_REVIEW" for item in items) else "DRAFT"

        expected_delivery = (datetime.now(UTC).date() + timedelta(days=max(item["leadTimeDays"] for item in items))).isoformat()
        product_lines = []
        total_cost = 0.0
        protected_revenue = 0.0
        prevented_waste = 0.0

        for item in items:
            line_cost = round(item["reorderQuantity"] * item["costPrice"], 2)
            total_cost += line_cost
            protected_revenue += item["financialImpact"]["protectedRevenue"]
            prevented_waste += item["financialImpact"]["potentialWasteCost"]
            product_lines.append(
                {
                    "productId": item["productId"],
                    "productName": item["productName"],
                    "quantity": item["reorderQuantity"],
                    "unit": item["unit"],
                    "unitCost": item["costPrice"],
                    "totalCost": line_cost,
                    "reason": item["explanation"],
                    "linkedAdviceId": item["id"],
                }
            )

        purchase_orders.append(
            {
                "id": order_id,
                "supplierName": supplier_name,
                "status": status,
                "totalEstimatedCost": round(total_cost, 2),
                "totalAmount": round(total_cost, 2),
                "expectedDeliveryDate": expected_delivery,
                "productLines": product_lines,
                "products": [
                    {
                        "productId": line["productId"],
                        "productName": line["productName"],
                        "quantity": line["quantity"],
                        "unit": line["unit"],
                        "lineAmount": line["totalCost"],
                        "reason": line["reason"],
                        "impact": next(item["financialImpact"]["protectedRevenue"] for item in items if item["productId"] == line["productId"]),
                        "urgency": next(item["urgency"] for item in items if item["productId"] == line["productId"]),
                    }
                    for line in product_lines
                ],
                "itemCount": len(product_lines),
                "reason": f"Automatisch voorbereid op basis van forecast, voorraad en lead time voor {supplier_name}.",
                "createdAt": stored.get("createdAt", utc_timestamp()),
                "lastUpdated": stored.get("updatedAt", utc_timestamp()),
                "isSimulated": True,
                "summary": {
                    "totalProtectedRevenue": round(protected_revenue, 2),
                    "totalPreventedWaste": round(prevented_waste, 2),
                },
            }
        )

    purchase_orders.sort(
        key=lambda item: (
            {"NEEDS_REVIEW": 0, "DRAFT": 1, "SENT_SIMULATED": 2, "REJECTED": 3, "APPROVED": 4}.get(item["status"], 5),
            item["expectedDeliveryDate"],
        )
    )
    return purchase_orders

