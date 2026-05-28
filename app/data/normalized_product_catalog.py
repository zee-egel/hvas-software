from __future__ import annotations

import csv
from collections import OrderedDict, defaultdict
from pathlib import Path
import re
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
NORMALIZED_PRODUCTS_CSV = REPO_ROOT / "frontend" / "hvas-products-normalized.csv"


def _read_rows() -> list[dict[str, str]]:
    with NORMALIZED_PRODUCTS_CSV.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _humanize_product_code(product_code: str) -> str:
    parts = [part for part in product_code.replace("-", "_").split("_") if part]
    acronyms = {"kg", "cl", "ml", "mm", "st", "l", "xl", "xxl", "m", "x"}
    rendered: list[str] = []
    for part in parts:
        if part.isdigit():
            rendered.append(part)
        elif part in acronyms:
            rendered.append(part.upper())
        else:
            rendered.append(part.capitalize())
    return " ".join(rendered)


def _infer_category(product_code: str, description: str) -> str:
    haystack = f"{product_code} {description}".lower()
    if any(token in haystack for token in ["cola", "fanta", "sprite", "minute_maid", "chauffontaine", "koolzuur"]):
        return "Drinks"
    if any(token in haystack for token in ["bier", "wijn"]):
        return "Drinks"
    if "brioche" in haystack:
        return "Bakery"
    if any(token in haystack for token in ["mayo", "mayonnaise", "ketchup", "saus"]):
        return "Sauce"
    if any(token in haystack for token in ["kaas", "parmezaan"]):
        return "Dairy"
    if any(token in haystack for token in ["patat", "frituur"]):
        return "Frozen"
    if any(token in haystack for token in ["handschoenen", "servetten", "tork", "embalage"]):
        return "Supplies"
    return "Dry Goods"


def _infer_unit(product_code: str, description: str, category: str) -> str:
    haystack = f"{product_code} {description}".lower()
    if category == "Drinks":
        return "bottle"
    if re.search(r"(\d+(?:[.,]\d+)?)\s*kg", haystack):
        return "kg"
    if re.search(r"(\d+(?:[.,]\d+)?)\s*l\b", haystack):
        return "ltr"
    if category == "Frozen":
        return "kg"
    return "pcs"


def _infer_reorder_multiple(product_code: str, description: str, unit: str) -> float:
    haystack = f"{product_code} {description}".lower()
    if unit == "bottle":
        pack = re.search(r"(\d+)\s*x\s*0[.,]\d+", haystack)
        if pack:
            return float(pack.group(1))
        if "krat_24" in haystack or "24_x" in haystack:
            return 24.0
    st_match = re.search(r"(\d+)\s*st\b", haystack)
    if st_match and unit == "pcs":
        count = int(st_match.group(1))
        if 1 < count <= 500:
            return float(count)
    return 1.0 if unit in {"pcs", "bottle"} else 0.5


def _category_defaults(category: str) -> dict[str, Any]:
    defaults = {
        "Bakery": {"lead": 2, "shelf": 5, "waste": 16.0, "markup": 2.8, "seasonality": 0.03, "variability": 0.10},
        "Drinks": {"lead": 3, "shelf": 120, "waste": 3.0, "markup": 2.5, "seasonality": 0.05, "variability": 0.09},
        "Sauce": {"lead": 3, "shelf": 30, "waste": 8.0, "markup": 2.1, "seasonality": 0.02, "variability": 0.06},
        "Dairy": {"lead": 2, "shelf": 12, "waste": 12.0, "markup": 2.2, "seasonality": 0.03, "variability": 0.08},
        "Frozen": {"lead": 3, "shelf": 120, "waste": 5.0, "markup": 2.0, "seasonality": 0.02, "variability": 0.07},
        "Supplies": {"lead": 4, "shelf": 240, "waste": 1.0, "markup": 1.4, "seasonality": 0.01, "variability": 0.04},
        "Dry Goods": {"lead": 3, "shelf": 120, "waste": 4.0, "markup": 2.0, "seasonality": 0.02, "variability": 0.06},
    }
    return defaults.get(category, defaults["Dry Goods"])


def load_product_catalog() -> list[dict[str, Any]]:
    rows = _read_rows()
    grouped: "OrderedDict[str, list[dict[str, str]]]" = OrderedDict()
    for row in rows:
        product_code = (row.get("product_id") or "").strip()
        if not product_code:
            continue
        grouped.setdefault(product_code, []).append(row)

    catalog: list[dict[str, Any]] = []
    for index, (product_code, product_rows) in enumerate(grouped.items(), start=1):
        description = next(
            ((row.get("description") or "").strip() for row in product_rows if (row.get("description") or "").strip()),
            product_code,
        )
        supplier_name = next(
            ((row.get("supplier_name") or "").strip() for row in product_rows if (row.get("supplier_name") or "").strip()),
            "Dataset Supplier",
        )
        category = _infer_category(product_code, description)
        unit = _infer_unit(product_code, description, category)
        defaults = _category_defaults(category)

        positive_quantities = []
        unit_prices = []
        for row in product_rows:
            try:
                quantity = float((row.get("total_units") or row.get("quantity") or "0").replace(",", "."))
            except ValueError:
                quantity = 0.0
            if quantity > 0:
                positive_quantities.append(quantity)
            try:
                unit_price = float((row.get("unit_price") or "0").replace(",", "."))
            except ValueError:
                unit_price = 0.0
            if unit_price > 0:
                unit_prices.append(unit_price)

        average_quantity = sum(positive_quantities) / len(positive_quantities) if positive_quantities else 1.0
        average_unit_price = sum(unit_prices) / len(unit_prices) if unit_prices else 1.0
        reorder_multiple = _infer_reorder_multiple(product_code, description, unit)
        safety_stock = max(reorder_multiple, round(average_quantity * 1.6, 1))
        base_daily_demand = round(max(0.2, average_quantity / 3.5), 1)
        current_stock = round(max(safety_stock * 1.15, average_quantity * 1.8), 1)
        selling_price = round(max(average_unit_price * defaults["markup"], average_unit_price + 1.0), 2)

        catalog.append(
            {
                "id": index,
                "productCode": product_code,
                "name": _humanize_product_code(product_code),
                "sourceDescription": description,
                "unit": unit,
                "category": category,
                "supplierName": supplier_name,
                "costPrice": round(average_unit_price, 2),
                "sellingPrice": selling_price,
                "shelfLifeDays": defaults["shelf"],
                "safetyStock": safety_stock,
                "leadTimeDays": defaults["lead"],
                "wasteRiskPercentage": defaults["waste"],
                "reorderMultiple": reorder_multiple,
                "baseDailyDemand": base_daily_demand,
                "currentStock": current_stock,
                "seasonality": defaults["seasonality"],
                "variability": defaults["variability"],
                "volatility": defaults["variability"],
                "weatherTag": "warm" if category == "Drinks" else "cold" if category in {"Frozen", "Dry Goods"} else "neutral",
                "servicePattern": "all_day",
                "eventSensitivity": 0.08 if category == "Drinks" else 0.04,
                "perishability": min(0.9, round(defaults["waste"] / 30, 2)),
            }
        )
    return catalog


def catalog_fingerprint(catalog: list[dict[str, Any]]) -> str:
    return "|".join(f"{item['id']}:{item['productCode']}:{item['name']}" for item in catalog)


PRODUCT_CATALOG = load_product_catalog()
