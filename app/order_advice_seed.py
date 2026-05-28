from __future__ import annotations

from datetime import date, timedelta
import math
import random
from typing import Any

try:
    from data.normalized_product_catalog import PRODUCT_CATALOG
except ImportError:
    from .data.normalized_product_catalog import PRODUCT_CATALOG


WEEKDAY_MULTIPLIERS = {
    0: 0.78,
    1: 0.84,
    2: 0.96,
    3: 1.08,
    4: 1.34,
    5: 1.48,
    6: 1.12,
}


def _season_factor(target_date: date, amplitude: float) -> float:
    day_of_year = target_date.timetuple().tm_yday
    return 1 + math.sin(day_of_year / 365 * 2 * math.pi) * amplitude


def _event_factor(target_date: date, product_id: int) -> float:
    week_bucket = target_date.isocalendar().week % 4
    factor = 1.0
    if target_date.weekday() in (4, 5) and week_bucket == 1:
        factor += 0.12
    if product_id in (4, 5, 13) and target_date.month in (4, 5, 6):
        factor += 0.08
    if product_id in (16, 17, 18) and target_date.weekday() in (4, 5):
        factor += 0.1
    if product_id in (1, 2, 19) and target_date.weekday() == 6:
        factor += 0.06
    return factor


def generate_sales_history(weeks: int = 12) -> list[dict[str, Any]]:
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=weeks * 7 - 1)
    sales: list[dict[str, Any]] = []

    for product in PRODUCT_CATALOG:
        for offset in range((end_date - start_date).days + 1):
            target_date = start_date + timedelta(days=offset)
            rng = random.Random(product["id"] * 100_000 + target_date.toordinal())
            weekday_factor = WEEKDAY_MULTIPLIERS[target_date.weekday()]
            season_factor = _season_factor(target_date, product["seasonality"])
            event_factor = _event_factor(target_date, product["id"])
            noise = 1 + rng.uniform(-product["variability"], product["variability"])
            trend = 1 + math.sin(offset / 14) * 0.03

            quantity = product["baseDailyDemand"] * weekday_factor * season_factor * event_factor * noise * trend
            rounded_quantity = round(max(0.0, quantity), 1)

            sales.append(
                {
                    "productId": product["id"],
                    "date": target_date.isoformat(),
                    "quantitySold": rounded_quantity,
                }
            )

    return sales


def generate_initial_inventory() -> list[dict[str, Any]]:
    return [
        {
            "productId": product["id"],
            "currentStock": float(product["currentStock"]),
        }
        for product in PRODUCT_CATALOG
    ]
