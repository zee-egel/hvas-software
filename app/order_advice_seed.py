from __future__ import annotations

from datetime import date, timedelta
import math
import random
from typing import Any


WEEKDAY_MULTIPLIERS = {
    0: 0.78,
    1: 0.84,
    2: 0.96,
    3: 1.08,
    4: 1.34,
    5: 1.48,
    6: 1.12,
}


PRODUCT_CATALOG: list[dict[str, Any]] = [
    {"id": 1, "name": "Chicken Breast", "unit": "kg", "costPrice": 7.8, "sellingPrice": 17.5, "wasteRiskPercentage": 14, "safetyStock": 10, "leadTimeDays": 2, "shelfLifeDays": 4, "category": "Protein", "supplierName": "Hanos", "baseDailyDemand": 7.0, "currentStock": 12.0, "seasonality": 0.04, "variability": 0.12},
    {"id": 2, "name": "Beef Mince", "unit": "kg", "costPrice": 8.9, "sellingPrice": 19.0, "wasteRiskPercentage": 12, "safetyStock": 8, "leadTimeDays": 2, "shelfLifeDays": 4, "category": "Protein", "supplierName": "Hanos", "baseDailyDemand": 5.4, "currentStock": 7.5, "seasonality": 0.03, "variability": 0.11},
    {"id": 3, "name": "Salmon Fillet", "unit": "kg", "costPrice": 14.5, "sellingPrice": 31.0, "wasteRiskPercentage": 18, "safetyStock": 6, "leadTimeDays": 2, "shelfLifeDays": 3, "category": "Protein", "supplierName": "Sligro", "baseDailyDemand": 3.0, "currentStock": 5.0, "seasonality": 0.05, "variability": 0.14},
    {"id": 4, "name": "Romaine Lettuce", "unit": "head", "costPrice": 1.1, "sellingPrice": 4.8, "wasteRiskPercentage": 28, "safetyStock": 12, "leadTimeDays": 1, "shelfLifeDays": 3, "category": "Produce", "supplierName": "Bidfood", "baseDailyDemand": 9.5, "currentStock": 10.0, "seasonality": 0.09, "variability": 0.18},
    {"id": 5, "name": "Tomatoes", "unit": "kg", "costPrice": 2.2, "sellingPrice": 7.2, "wasteRiskPercentage": 24, "safetyStock": 10, "leadTimeDays": 1, "shelfLifeDays": 4, "category": "Produce", "supplierName": "Bidfood", "baseDailyDemand": 8.2, "currentStock": 11.0, "seasonality": 0.07, "variability": 0.16},
    {"id": 6, "name": "Brioche Buns", "unit": "pcs", "costPrice": 0.38, "sellingPrice": 2.0, "wasteRiskPercentage": 16, "safetyStock": 28, "leadTimeDays": 2, "shelfLifeDays": 5, "category": "Bakery", "supplierName": "Hanos", "baseDailyDemand": 18.0, "currentStock": 30.0, "seasonality": 0.03, "variability": 0.1},
    {"id": 7, "name": "Fries", "unit": "kg", "costPrice": 1.9, "sellingPrice": 6.5, "wasteRiskPercentage": 8, "safetyStock": 15, "leadTimeDays": 2, "shelfLifeDays": 20, "category": "Sides", "supplierName": "Sligro", "baseDailyDemand": 13.0, "currentStock": 24.0, "seasonality": 0.02, "variability": 0.08},
    {"id": 8, "name": "Mayonnaise", "unit": "ltr", "costPrice": 2.0, "sellingPrice": 6.0, "wasteRiskPercentage": 6, "safetyStock": 4, "leadTimeDays": 3, "shelfLifeDays": 45, "category": "Sauce", "supplierName": "Sligro", "baseDailyDemand": 2.1, "currentStock": 8.0, "seasonality": 0.01, "variability": 0.05},
    {"id": 9, "name": "Cheddar Cheese", "unit": "kg", "costPrice": 5.7, "sellingPrice": 14.0, "wasteRiskPercentage": 10, "safetyStock": 7, "leadTimeDays": 2, "shelfLifeDays": 12, "category": "Dairy", "supplierName": "Hanos", "baseDailyDemand": 4.4, "currentStock": 10.0, "seasonality": 0.02, "variability": 0.09},
    {"id": 10, "name": "Whole Milk", "unit": "ltr", "costPrice": 1.15, "sellingPrice": 4.2, "wasteRiskPercentage": 20, "safetyStock": 6, "leadTimeDays": 1, "shelfLifeDays": 6, "category": "Dairy", "supplierName": "Bidfood", "baseDailyDemand": 3.2, "currentStock": 4.0, "seasonality": 0.02, "variability": 0.07},
    {"id": 11, "name": "Greek Yogurt", "unit": "kg", "costPrice": 3.9, "sellingPrice": 9.8, "wasteRiskPercentage": 22, "safetyStock": 5, "leadTimeDays": 2, "shelfLifeDays": 7, "category": "Dairy", "supplierName": "Bidfood", "baseDailyDemand": 2.4, "currentStock": 6.0, "seasonality": 0.04, "variability": 0.11},
    {"id": 12, "name": "Eggs", "unit": "dozen", "costPrice": 2.6, "sellingPrice": 7.5, "wasteRiskPercentage": 9, "safetyStock": 8, "leadTimeDays": 2, "shelfLifeDays": 16, "category": "Dairy", "supplierName": "Hanos", "baseDailyDemand": 2.8, "currentStock": 9.0, "seasonality": 0.02, "variability": 0.06},
    {"id": 13, "name": "Avocados", "unit": "pcs", "costPrice": 1.35, "sellingPrice": 5.6, "wasteRiskPercentage": 30, "safetyStock": 12, "leadTimeDays": 2, "shelfLifeDays": 4, "category": "Produce", "supplierName": "Bidfood", "baseDailyDemand": 7.2, "currentStock": 10.0, "seasonality": 0.08, "variability": 0.17},
    {"id": 14, "name": "Onions", "unit": "kg", "costPrice": 1.0, "sellingPrice": 3.2, "wasteRiskPercentage": 7, "safetyStock": 8, "leadTimeDays": 3, "shelfLifeDays": 18, "category": "Produce", "supplierName": "Sligro", "baseDailyDemand": 4.3, "currentStock": 11.0, "seasonality": 0.01, "variability": 0.05},
    {"id": 15, "name": "Mushrooms", "unit": "kg", "costPrice": 3.2, "sellingPrice": 9.4, "wasteRiskPercentage": 26, "safetyStock": 6, "leadTimeDays": 2, "shelfLifeDays": 4, "category": "Produce", "supplierName": "Bidfood", "baseDailyDemand": 3.6, "currentStock": 4.0, "seasonality": 0.03, "variability": 0.12},
    {"id": 16, "name": "Cola", "unit": "bottle", "costPrice": 0.95, "sellingPrice": 3.9, "wasteRiskPercentage": 2, "safetyStock": 18, "leadTimeDays": 4, "shelfLifeDays": 60, "category": "Drinks", "supplierName": "Makro", "baseDailyDemand": 12.0, "currentStock": 40.0, "seasonality": 0.04, "variability": 0.09},
    {"id": 17, "name": "Orange Juice", "unit": "ltr", "costPrice": 1.8, "sellingPrice": 5.2, "wasteRiskPercentage": 14, "safetyStock": 7, "leadTimeDays": 3, "shelfLifeDays": 10, "category": "Drinks", "supplierName": "Makro", "baseDailyDemand": 3.2, "currentStock": 7.0, "seasonality": 0.06, "variability": 0.08},
    {"id": 18, "name": "House Wine", "unit": "bottle", "costPrice": 4.9, "sellingPrice": 19.0, "wasteRiskPercentage": 3, "safetyStock": 10, "leadTimeDays": 4, "shelfLifeDays": 120, "category": "Drinks", "supplierName": "Makro", "baseDailyDemand": 4.6, "currentStock": 12.0, "seasonality": 0.05, "variability": 0.1},
    {"id": 19, "name": "Bacon", "unit": "kg", "costPrice": 6.1, "sellingPrice": 15.5, "wasteRiskPercentage": 13, "safetyStock": 5, "leadTimeDays": 2, "shelfLifeDays": 6, "category": "Protein", "supplierName": "Hanos", "baseDailyDemand": 3.5, "currentStock": 5.0, "seasonality": 0.02, "variability": 0.1},
    {"id": 20, "name": "Penne Pasta", "unit": "kg", "costPrice": 1.6, "sellingPrice": 7.8, "wasteRiskPercentage": 4, "safetyStock": 9, "leadTimeDays": 3, "shelfLifeDays": 90, "category": "Dry Goods", "supplierName": "Sligro", "baseDailyDemand": 5.5, "currentStock": 14.0, "seasonality": 0.01, "variability": 0.07},
]


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
