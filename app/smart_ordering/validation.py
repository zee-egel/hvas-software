from __future__ import annotations

from typing import Any


def validate_forecast_request(payload: dict[str, Any]) -> dict[str, Any]:
    days = int(payload.get("days", 4))
    if days < 1 or days > 14:
        raise ValueError("days must be between 1 and 14.")
    return {
        "days": days,
        "includeCurrentStock": bool(payload.get("includeCurrentStock", True)),
        "includeOutstandingOrders": bool(payload.get("includeOutstandingOrders", True)),
    }


def validate_order_draft_request(payload: dict[str, Any]) -> dict[str, Any]:
    forecast = validate_forecast_request(payload)
    suggestions = payload.get("suggestions", [])
    if not isinstance(suggestions, list) or not suggestions:
        raise ValueError("suggestions must be a non-empty array.")
    normalized = []
    for item in suggestions:
        if not isinstance(item, dict):
            raise ValueError("each suggestion override must be an object.")
        if "productId" not in item:
            raise ValueError("each suggestion override requires productId.")
        normalized.append(
            {
                "productId": int(item["productId"]),
                "accepted": bool(item.get("accepted", False)),
                "quantity": float(item.get("quantity", 0)),
                "unit": str(item.get("unit", "")),
                "supplierId": item.get("supplierId"),
            }
        )
    return {
        **forecast,
        "suggestions": normalized,
    }


def validate_place_orders_request(payload: dict[str, Any]) -> list[str]:
    draft_order_ids = payload.get("draftOrderIds", [])
    if not isinstance(draft_order_ids, list) or not draft_order_ids:
        raise ValueError("draftOrderIds must be a non-empty array.")
    normalized = [str(item).strip() for item in draft_order_ids if str(item).strip()]
    if not normalized:
        raise ValueError("draftOrderIds must contain at least one valid id.")
    return normalized
