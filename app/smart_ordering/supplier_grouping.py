from __future__ import annotations

from collections import defaultdict
from typing import Any

from .types import SmartOrderingSuggestion, SupplierOrderDraft, SupplierOrderLine


def group_suggestions_by_supplier(
    suggestions: list[SmartOrderingSuggestion],
    selected_lines: list[dict[str, Any]],
) -> list[SupplierOrderDraft]:
    suggestions_by_product = {item.productId: item for item in suggestions}
    grouped: dict[tuple[int | None, str], list[SupplierOrderLine]] = defaultdict(list)

    for selected in selected_lines:
        if not selected["accepted"]:
            continue
        suggestion = suggestions_by_product.get(int(selected["productId"]))
        if suggestion is None:
            continue
        quantity = max(0.0, float(selected["quantity"]))
        if quantity <= 0:
            continue
        supplier_name = suggestion.supplierName or "No supplier linked"
        grouped[(suggestion.supplierId, supplier_name)].append(
            SupplierOrderLine(
                productId=suggestion.productId,
                productCode=suggestion.productCode,
                productName=suggestion.productName,
                quantity=quantity,
                unit=suggestion.unit,
                supplierId=suggestion.supplierId,
                supplierName=supplier_name,
                unitCost=round(
                    suggestion.estimatedLineCost / suggestion.suggestedQuantity,
                    2,
                ) if suggestion.suggestedQuantity > 0 else 0.0,
                estimatedLineCost=round(
                    quantity
                    * (
                        suggestion.estimatedLineCost / suggestion.suggestedQuantity
                        if suggestion.suggestedQuantity > 0
                        else 0.0
                    ),
                    2,
                ),
                packageQuantity=suggestion.packageQuantity,
                packageLabel=suggestion.packageLabel,
                warnings=suggestion.warnings,
            )
        )

    drafts: list[SupplierOrderDraft] = []
    for (supplier_id, supplier_name), lines in grouped.items():
        drafts.append(
            SupplierOrderDraft(
                draftOrderId="",
                supplierId=supplier_id,
                supplierName=supplier_name,
                status="DRAFT",
                deliveryNote=(
                    "No supplier integration is available yet. Review manually before sending."
                    if supplier_id is None
                    else "Prepared for simulated placement. Supplier API can be connected later."
                ),
                estimatedTotalCost=round(sum(line.estimatedLineCost for line in lines), 2),
                totalProducts=len(lines),
                productLines=sorted(lines, key=lambda line: line.productName),
            )
        )

    drafts.sort(key=lambda draft: (draft.supplierName == "No supplier linked", draft.supplierName))
    return drafts
