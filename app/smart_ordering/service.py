from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
import re
from typing import Any

from sqlalchemy import delete, func, insert, select, update

from .forecast import calculate_suggestion, package_label, recent_usage_summary, summarize_forecast
from .supplier_grouping import group_suggestions_by_supplier
from .types import SmartOrderingProductContext, SmartOrderingSuggestion


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def parse_dt(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def slugify(value: str) -> str:
    return "".join(char.lower() if char.isalnum() else "-" for char in value).strip("-")


def normalize_product_code(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


class SmartOrderingService:
    def __init__(self, operations_service: Any) -> None:
        self.operations = operations_service

    def get_context(self) -> dict[str, Any]:
        snapshot = self._build_snapshot()
        products = self._build_context_products(snapshot)
        return {
            "generatedAt": utc_timestamp(),
            "restaurant": self.operations.get_restaurant()["restaurant"],
            "suppliers": self._supplier_context(),
            "products": [product.to_dict() for product in products],
        }

    def generate_forecast(
        self,
        *,
        days: int,
        include_current_stock: bool,
        include_outstanding_orders: bool,
    ) -> dict[str, Any]:
        snapshot = self._build_snapshot()
        suggestions = self._build_forecast_suggestions(
            snapshot=snapshot,
            days=days,
            include_current_stock=include_current_stock,
            include_outstanding_orders=include_outstanding_orders,
        )
        price_by_product_id = {
            product["productId"]: product["sellingPrice"]
            for product in snapshot["productRows"]
        }
        summary = summarize_forecast(suggestions, price_by_product_id)
        start_date = date.today()
        end_date = start_date + timedelta(days=days - 1)
        return {
            "period": {
                "days": days,
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": summary,
            "suggestions": [item.to_dict() for item in suggestions if item.suggestedQuantity > 0],
        }

    def create_order_draft(
        self,
        *,
        days: int,
        include_current_stock: bool,
        include_outstanding_orders: bool,
        suggestions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        snapshot = self._build_snapshot()
        forecast_suggestions = self._build_forecast_suggestions(
            snapshot=snapshot,
            days=days,
            include_current_stock=include_current_stock,
            include_outstanding_orders=include_outstanding_orders,
        )
        drafts = group_suggestions_by_supplier(forecast_suggestions, suggestions)
        persisted = self._persist_drafts(drafts)
        return {
            "period": {
                "days": days,
                "start": date.today().isoformat(),
                "end": (date.today() + timedelta(days=days - 1)).isoformat(),
            },
            "draftOrders": persisted,
            "summary": {
                "supplierCount": len(persisted),
                "totalProducts": sum(item["totalProducts"] for item in persisted),
                "estimatedTotalCost": round(sum(item["estimatedTotalCost"] for item in persisted), 2),
            },
        }

    def place_orders(self, draft_order_ids: list[str]) -> dict[str, Any]:
        now = datetime.now(UTC)
        placed = []
        with self.operations.engine.begin() as conn:
            rows = conn.execute(
                select(self.operations.purchase_orders).where(
                    self.operations.purchase_orders.c.id.in_(draft_order_ids)
                )
            ).mappings().all()
            existing = {row["id"]: row for row in rows}
            for draft_order_id in draft_order_ids:
                row = existing.get(draft_order_id)
                if row is None:
                    raise ValueError(f"Unknown draftOrderId {draft_order_id}")
                conn.execute(
                    update(self.operations.purchase_orders)
                    .where(self.operations.purchase_orders.c.id == draft_order_id)
                    .values(status="SENT_SIMULATED", updated_at=now)
                )
                placed.append(
                    {
                        "draftOrderId": draft_order_id,
                        "supplierId": row["supplier_id"],
                        "supplierName": self.operations._supplier_name_by_id(row["supplier_id"]),
                        "status": "SENT_SIMULATED",
                        "estimatedTotalCost": row["total_amount"],
                    }
                )
        return {
            "placedAt": utc_timestamp(),
            "orders": placed,
        }

    def _build_context_products(
        self,
        snapshot: dict[str, Any],
    ) -> list[SmartOrderingProductContext]:
        rows = snapshot["productRows"]
        inventory_state = snapshot["inventoryState"]
        outstanding = snapshot["outstandingQuantities"]
        recent_usage_by_product_id = snapshot["recentUsageByProductId"]
        context_products: list[SmartOrderingProductContext] = []
        for row in rows:
            state = inventory_state[row["productId"]]
            recent_days, recent_total, average_daily_usage = recent_usage_by_product_id[
                row["productId"]
            ]
            context_products.append(
                SmartOrderingProductContext(
                    productId=row["productId"],
                    productCode=row["productCode"],
                    productName=row["productName"],
                    category=row["category"],
                    unit=row["unit"],
                    supplierId=row["supplierId"],
                    supplierName=row["supplierName"],
                    currentStock=round(state["currentStock"], 1),
                    outstandingIncomingQuantity=round(outstanding.get(row["productId"], 0.0), 1),
                    recentUsageDays=recent_days,
                    recentUsageTotal=recent_total,
                    averageDailyUsage=average_daily_usage,
                    minimumStock=round(row["minimumStock"], 1),
                    packageQuantity=row["packageQuantity"],
                    packageLabel=package_label(row["packageQuantity"], row["unit"]),
                    unitCost=row["unitCost"],
                    supplierAvailable=bool(row["supplierAvailable"]),
                    stockDataStatus=(
                        "missing"
                        if state["countTimestamp"] is None
                        else "stale"
                        if "stale_stock_count" in state["blocked"]
                        else "ok"
                    ),
                )
            )
        return context_products

    def _build_forecast_suggestions(
        self,
        *,
        snapshot: dict[str, Any],
        days: int,
        include_current_stock: bool,
        include_outstanding_orders: bool,
    ) -> list[SmartOrderingSuggestion]:
        rows = snapshot["productRows"]
        inventory_state = snapshot["inventoryState"]
        outstanding = snapshot["outstandingQuantities"]
        sales_history_by_product_id = snapshot["salesHistoryByProductId"]
        recent_usage_by_product_id = snapshot["recentUsageByProductId"]
        suggestions: list[SmartOrderingSuggestion] = []
        for row in rows:
            state = inventory_state[row["productId"]]
            sales_history = sales_history_by_product_id[row["productId"]]
            recent_days, recent_total, average_daily_usage = recent_usage_by_product_id[
                row["productId"]
            ]
            forecast_product = {
                **row,
                "salesHistory": sales_history,
                "recentUsageDays": recent_days,
                "recentUsageTotal": recent_total,
                "averageDailyUsage": average_daily_usage,
            }
            suggestions.append(
                calculate_suggestion(
                    product=forecast_product,
                    recent_usage_days=recent_days,
                    recent_usage_total=recent_total,
                    average_daily_usage=average_daily_usage,
                    days=days,
                    include_current_stock=include_current_stock,
                    include_outstanding_orders=include_outstanding_orders,
                    current_stock=round(state["currentStock"], 1),
                    outstanding_incoming_quantity=round(outstanding.get(row["productId"], 0.0), 1),
                    has_stock_data=state["countTimestamp"] is not None,
                    stock_is_stale="stale_stock_count" in state["blocked"],
                )
            )
        suggestions.sort(
            key=lambda item: (
                0 if item.suggestedQuantity > 0 else 1,
                0 if item.warnings else 1,
                -item.expectedUsage,
            )
        )
        return suggestions

    def _build_snapshot(self) -> dict[str, Any]:
        source_product_rows = self.operations._fetch_product_rows()
        product_rows = [
            {
                "productId": int(product["id"]),
                "productCode": normalize_product_code(str(product["name"])),
                "productName": str(product["name"]),
                "category": str(product["category"]),
                "unit": str(product["unit"]),
                "supplierId": product["supplier_id"],
                "supplierName": product["supplier_name"],
                "unitCost": float(product["cost_price"]),
                "sellingPrice": float(product["selling_price"]),
                "safetyStock": float(product["safety_stock"]),
                "minimumStock": float(product["safety_stock"]),
                "packageQuantity": float(product["reorder_multiple"] or 1.0),
                "supplierAvailable": bool(product["supplier_active"]),
            }
            for product in source_product_rows
        ]
        inventory_state = self.operations._calculate_inventory_positions(source_product_rows)
        product_ids = [row["productId"] for row in product_rows]
        sales_history_by_product_id = self.operations._sales_history_for_products(product_ids)
        recent_usage_by_product_id = {
            product_id: recent_usage_summary(sales_history_by_product_id.get(product_id, []))
            for product_id in product_ids
        }
        return {
            "productRows": product_rows,
            "inventoryState": inventory_state,
            "outstandingQuantities": self._outstanding_quantities(),
            "salesHistoryByProductId": sales_history_by_product_id,
            "recentUsageByProductId": recent_usage_by_product_id,
        }

    def _persist_drafts(self, drafts: list[Any]) -> list[dict[str, Any]]:
        now = datetime.now(UTC)
        persisted: list[dict[str, Any]] = []
        with self.operations.engine.begin() as conn:
            existing_smart_drafts = conn.execute(
                select(self.operations.purchase_orders.c.id).where(
                    self.operations.purchase_orders.c.id.like("smart-draft-%")
                )
            ).scalars().all()
            for draft_id in existing_smart_drafts:
                conn.execute(
                    delete(self.operations.purchase_order_lines).where(
                        self.operations.purchase_order_lines.c.purchase_order_id == draft_id
                    )
                )
                conn.execute(
                    delete(self.operations.purchase_orders).where(
                        self.operations.purchase_orders.c.id == draft_id
                    )
                )

            for index, draft in enumerate(drafts, start=1):
                draft_id = f"smart-draft-{int(now.timestamp())}-{index}-{slugify(draft.supplierName)}"
                expected_delivery = now + timedelta(days=2 if draft.supplierId else 1)
                conn.execute(
                    insert(self.operations.purchase_orders).values(
                        id=draft_id,
                        supplier_id=draft.supplierId,
                        status="DRAFT",
                        created_at=now,
                        updated_at=now,
                        expected_delivery_date=expected_delivery,
                        total_amount=draft.estimatedTotalCost,
                        total_protected_revenue=0.0,
                        total_prevented_waste=0.0,
                        blocked_reason=draft.deliveryNote,
                        snapshot_run_id=None,
                    )
                )
                conn.execute(
                    insert(self.operations.purchase_order_lines),
                    [
                        {
                            "purchase_order_id": draft_id,
                            "product_id": line.productId,
                            "quantity": line.quantity,
                            "unit_cost": line.unitCost,
                            "total_cost": line.estimatedLineCost,
                            "reason": "Smart ordering draft line",
                            "impact": 0.0,
                            "urgency": "medium" if line.warnings else "low",
                            "linked_advice_id": f"smart-order-{line.productId}",
                        }
                        for line in draft.productLines
                    ],
                )
                persisted_draft = draft.to_dict()
                persisted_draft["draftOrderId"] = draft_id
                persisted_draft["expectedDeliveryDate"] = expected_delivery.date().isoformat()
                persisted.append(persisted_draft)
        return persisted

    def _outstanding_quantities(self) -> dict[int, float]:
        with self.operations.engine.begin() as conn:
            rows = conn.execute(
                select(
                    self.operations.purchase_order_lines.c.product_id,
                    func.coalesce(
                        func.sum(self.operations.purchase_order_lines.c.quantity),
                        0.0,
                    ).label("quantity"),
                )
                .select_from(
                    self.operations.purchase_order_lines.join(
                        self.operations.purchase_orders,
                        self.operations.purchase_orders.c.id
                        == self.operations.purchase_order_lines.c.purchase_order_id,
                    )
                )
                .where(
                    self.operations.purchase_orders.c.status.in_(
                        ("APPROVED", "SENT_SIMULATED")
                    )
                )
                .group_by(self.operations.purchase_order_lines.c.product_id)
            ).mappings().all()
        return {int(row["product_id"]): float(row["quantity"]) for row in rows}

    def _supplier_context(self) -> list[dict[str, Any]]:
        return [
            {
                "supplierId": supplier["id"],
                "supplierName": supplier["name"],
                "active": supplier["active"],
            }
            for supplier in self.operations.get_config_suppliers()
        ]
