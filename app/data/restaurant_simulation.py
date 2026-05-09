from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import math
import random
from typing import Any


WEEKDAY_MULTIPLIERS = {
    0: 0.76,
    1: 0.82,
    2: 0.94,
    3: 1.03,
    4: 1.28,
    5: 1.42,
    6: 1.08,
}


@dataclass(frozen=True)
class FutureContext:
    date: str
    weather: dict[str, Any]
    event: dict[str, Any]
    holiday: dict[str, Any]
    footTrafficIndex: float


RESTAURANT_PROFILE = {
    "id": "hvas-bistro-den-haag",
    "name": "HVAS Bistro",
    "location": "Den Haag Centrum",
    "type": "casual dining / bistro",
    "openingHours": {
        "monday": "11:30-22:00",
        "tuesday": "11:30-22:00",
        "wednesday": "11:30-22:00",
        "thursday": "11:30-22:30",
        "friday": "11:30-23:00",
        "saturday": "11:30-23:00",
        "sunday": "12:00-22:00",
    },
    "serviceMoments": ["lunch", "dinner"],
    "cityContext": {
        "tourism": "mixed city shoppers, offices and leisure traffic",
        "knownDrivers": [
            "weekend foot traffic",
            "warm-weather terrace demand",
            "city-centre events",
            "school holidays",
        ],
    },
}


PRODUCT_CATALOG: list[dict[str, Any]] = [
    {"id": 1, "name": "Kipfilet", "unit": "kg", "category": "Protein", "supplierName": "Hanos", "costPrice": 8.1, "sellingPrice": 21.5, "shelfLifeDays": 4, "safetyStock": 9.0, "leadTimeDays": 2, "wasteRiskPercentage": 14, "perishability": 0.72, "reorderMultiple": 0.5, "baseDailyDemand": 6.2, "volatility": 0.09, "weatherTag": "neutral", "servicePattern": "dinner", "eventSensitivity": 0.10, "currentStock": 10.5},
    {"id": 2, "name": "Rundvlees", "unit": "kg", "category": "Protein", "supplierName": "Hanos", "costPrice": 10.5, "sellingPrice": 25.0, "shelfLifeDays": 4, "safetyStock": 7.0, "leadTimeDays": 2, "wasteRiskPercentage": 13, "perishability": 0.70, "reorderMultiple": 0.5, "baseDailyDemand": 4.5, "volatility": 0.08, "weatherTag": "cold", "servicePattern": "dinner", "eventSensitivity": 0.08, "currentStock": 6.5},
    {"id": 3, "name": "Zalmfilet", "unit": "kg", "category": "Protein", "supplierName": "Sligro", "costPrice": 15.2, "sellingPrice": 32.5, "shelfLifeDays": 3, "safetyStock": 5.5, "leadTimeDays": 2, "wasteRiskPercentage": 19, "perishability": 0.84, "reorderMultiple": 0.5, "baseDailyDemand": 2.9, "volatility": 0.10, "weatherTag": "warm", "servicePattern": "dinner", "eventSensitivity": 0.10, "currentStock": 4.0},
    {"id": 4, "name": "Garnalen", "unit": "kg", "category": "Protein", "supplierName": "Sligro", "costPrice": 13.4, "sellingPrice": 29.5, "shelfLifeDays": 3, "safetyStock": 4.0, "leadTimeDays": 2, "wasteRiskPercentage": 18, "perishability": 0.82, "reorderMultiple": 0.5, "baseDailyDemand": 2.2, "volatility": 0.12, "weatherTag": "warm", "servicePattern": "dinner", "eventSensitivity": 0.12, "currentStock": 3.0},
    {"id": 5, "name": "Sla", "unit": "head", "category": "Produce", "supplierName": "Bidfood", "costPrice": 1.2, "sellingPrice": 5.4, "shelfLifeDays": 3, "safetyStock": 12.0, "leadTimeDays": 1, "wasteRiskPercentage": 29, "perishability": 0.90, "reorderMultiple": 1.0, "baseDailyDemand": 10.5, "volatility": 0.16, "weatherTag": "warm", "servicePattern": "lunch", "eventSensitivity": 0.09, "currentStock": 11.0},
    {"id": 6, "name": "Tomaat", "unit": "kg", "category": "Produce", "supplierName": "Bidfood", "costPrice": 2.4, "sellingPrice": 7.8, "shelfLifeDays": 4, "safetyStock": 9.0, "leadTimeDays": 1, "wasteRiskPercentage": 24, "perishability": 0.82, "reorderMultiple": 0.5, "baseDailyDemand": 7.4, "volatility": 0.13, "weatherTag": "warm", "servicePattern": "all_day", "eventSensitivity": 0.08, "currentStock": 9.5},
    {"id": 7, "name": "Ui", "unit": "kg", "category": "Produce", "supplierName": "Bidfood", "costPrice": 1.1, "sellingPrice": 3.4, "shelfLifeDays": 16, "safetyStock": 7.0, "leadTimeDays": 2, "wasteRiskPercentage": 8, "perishability": 0.20, "reorderMultiple": 0.5, "baseDailyDemand": 3.8, "volatility": 0.05, "weatherTag": "neutral", "servicePattern": "all_day", "eventSensitivity": 0.04, "currentStock": 8.0},
    {"id": 8, "name": "Paprika", "unit": "kg", "category": "Produce", "supplierName": "Bidfood", "costPrice": 2.8, "sellingPrice": 8.2, "shelfLifeDays": 5, "safetyStock": 6.0, "leadTimeDays": 2, "wasteRiskPercentage": 20, "perishability": 0.65, "reorderMultiple": 0.5, "baseDailyDemand": 4.4, "volatility": 0.09, "weatherTag": "warm", "servicePattern": "all_day", "eventSensitivity": 0.07, "currentStock": 5.0},
    {"id": 9, "name": "Brood", "unit": "pcs", "category": "Bakery", "supplierName": "Hanos", "costPrice": 0.52, "sellingPrice": 2.1, "shelfLifeDays": 3, "safetyStock": 24.0, "leadTimeDays": 1, "wasteRiskPercentage": 18, "perishability": 0.75, "reorderMultiple": 6.0, "baseDailyDemand": 16.0, "volatility": 0.10, "weatherTag": "neutral", "servicePattern": "lunch", "eventSensitivity": 0.06, "currentStock": 26.0},
    {"id": 10, "name": "Friet", "unit": "kg", "category": "Sides", "supplierName": "Sligro", "costPrice": 1.9, "sellingPrice": 6.8, "shelfLifeDays": 25, "safetyStock": 14.0, "leadTimeDays": 2, "wasteRiskPercentage": 7, "perishability": 0.10, "reorderMultiple": 1.0, "baseDailyDemand": 12.5, "volatility": 0.07, "weatherTag": "neutral", "servicePattern": "dinner", "eventSensitivity": 0.07, "currentStock": 20.0},
    {"id": 11, "name": "Pasta", "unit": "kg", "category": "Dry Goods", "supplierName": "Sligro", "costPrice": 1.7, "sellingPrice": 8.4, "shelfLifeDays": 120, "safetyStock": 8.0, "leadTimeDays": 3, "wasteRiskPercentage": 4, "perishability": 0.05, "reorderMultiple": 1.0, "baseDailyDemand": 4.9, "volatility": 0.06, "weatherTag": "cold", "servicePattern": "dinner", "eventSensitivity": 0.05, "currentStock": 12.0},
    {"id": 12, "name": "Rijst", "unit": "kg", "category": "Dry Goods", "supplierName": "Sligro", "costPrice": 1.4, "sellingPrice": 6.4, "shelfLifeDays": 180, "safetyStock": 7.0, "leadTimeDays": 3, "wasteRiskPercentage": 4, "perishability": 0.04, "reorderMultiple": 1.0, "baseDailyDemand": 3.6, "volatility": 0.05, "weatherTag": "neutral", "servicePattern": "all_day", "eventSensitivity": 0.04, "currentStock": 10.0},
    {"id": 13, "name": "Mayonaise", "unit": "ltr", "category": "Sauce", "supplierName": "Makro", "costPrice": 2.2, "sellingPrice": 6.2, "shelfLifeDays": 45, "safetyStock": 4.0, "leadTimeDays": 3, "wasteRiskPercentage": 6, "perishability": 0.08, "reorderMultiple": 0.5, "baseDailyDemand": 1.8, "volatility": 0.04, "weatherTag": "neutral", "servicePattern": "all_day", "eventSensitivity": 0.03, "currentStock": 6.0},
    {"id": 14, "name": "Room", "unit": "ltr", "category": "Dairy", "supplierName": "Bidfood", "costPrice": 1.9, "sellingPrice": 6.4, "shelfLifeDays": 7, "safetyStock": 4.0, "leadTimeDays": 1, "wasteRiskPercentage": 18, "perishability": 0.58, "reorderMultiple": 0.5, "baseDailyDemand": 2.2, "volatility": 0.07, "weatherTag": "cold", "servicePattern": "dinner", "eventSensitivity": 0.05, "currentStock": 3.0},
    {"id": 15, "name": "Eieren", "unit": "dozen", "category": "Dairy", "supplierName": "Hanos", "costPrice": 2.8, "sellingPrice": 7.8, "shelfLifeDays": 18, "safetyStock": 7.0, "leadTimeDays": 2, "wasteRiskPercentage": 10, "perishability": 0.22, "reorderMultiple": 1.0, "baseDailyDemand": 2.5, "volatility": 0.05, "weatherTag": "neutral", "servicePattern": "lunch", "eventSensitivity": 0.04, "currentStock": 8.0},
    {"id": 16, "name": "Huiswijn", "unit": "bottle", "category": "Drinks", "supplierName": "Makro", "costPrice": 5.1, "sellingPrice": 20.0, "shelfLifeDays": 240, "safetyStock": 10.0, "leadTimeDays": 4, "wasteRiskPercentage": 3, "perishability": 0.02, "reorderMultiple": 6.0, "baseDailyDemand": 4.8, "volatility": 0.10, "weatherTag": "warm", "servicePattern": "dinner", "eventSensitivity": 0.14, "currentStock": 14.0},
    {"id": 17, "name": "Bier", "unit": "bottle", "category": "Drinks", "supplierName": "Makro", "costPrice": 1.05, "sellingPrice": 4.6, "shelfLifeDays": 180, "safetyStock": 18.0, "leadTimeDays": 4, "wasteRiskPercentage": 2, "perishability": 0.02, "reorderMultiple": 12.0, "baseDailyDemand": 13.0, "volatility": 0.12, "weatherTag": "warm", "servicePattern": "all_day", "eventSensitivity": 0.18, "currentStock": 34.0},
    {"id": 18, "name": "Frisdrank", "unit": "bottle", "category": "Drinks", "supplierName": "Makro", "costPrice": 0.92, "sellingPrice": 3.8, "shelfLifeDays": 180, "safetyStock": 16.0, "leadTimeDays": 4, "wasteRiskPercentage": 2, "perishability": 0.02, "reorderMultiple": 12.0, "baseDailyDemand": 10.8, "volatility": 0.08, "weatherTag": "warm", "servicePattern": "all_day", "eventSensitivity": 0.10, "currentStock": 28.0},
    {"id": 19, "name": "Koffiebonen", "unit": "kg", "category": "Drinks", "supplierName": "Makro", "costPrice": 8.4, "sellingPrice": 28.0, "shelfLifeDays": 90, "safetyStock": 3.0, "leadTimeDays": 5, "wasteRiskPercentage": 4, "perishability": 0.06, "reorderMultiple": 1.0, "baseDailyDemand": 1.6, "volatility": 0.04, "weatherTag": "cold", "servicePattern": "lunch", "eventSensitivity": 0.03, "currentStock": 4.0},
    {"id": 20, "name": "Boter", "unit": "kg", "category": "Dairy", "supplierName": "Hanos", "costPrice": 4.6, "sellingPrice": 12.8, "shelfLifeDays": 20, "safetyStock": 3.0, "leadTimeDays": 2, "wasteRiskPercentage": 8, "perishability": 0.14, "reorderMultiple": 0.5, "baseDailyDemand": 1.4, "volatility": 0.04, "weatherTag": "neutral", "servicePattern": "all_day", "eventSensitivity": 0.02, "currentStock": 3.5},
    {"id": 21, "name": "Cheesecake", "unit": "pcs", "category": "Dessert", "supplierName": "Bidfood", "costPrice": 1.8, "sellingPrice": 6.9, "shelfLifeDays": 4, "safetyStock": 8.0, "leadTimeDays": 2, "wasteRiskPercentage": 21, "perishability": 0.74, "reorderMultiple": 4.0, "baseDailyDemand": 5.2, "volatility": 0.09, "weatherTag": "neutral", "servicePattern": "dinner", "eventSensitivity": 0.08, "currentStock": 9.0},
    {"id": 22, "name": "Citroen", "unit": "kg", "category": "Produce", "supplierName": "Bidfood", "costPrice": 2.3, "sellingPrice": 6.4, "shelfLifeDays": 7, "safetyStock": 3.0, "leadTimeDays": 2, "wasteRiskPercentage": 12, "perishability": 0.36, "reorderMultiple": 0.5, "baseDailyDemand": 1.9, "volatility": 0.06, "weatherTag": "warm", "servicePattern": "all_day", "eventSensitivity": 0.06, "currentStock": 3.0},
    {"id": 23, "name": "Yoghurt", "unit": "kg", "category": "Dairy", "supplierName": "Bidfood", "costPrice": 4.0, "sellingPrice": 10.5, "shelfLifeDays": 7, "safetyStock": 4.0, "leadTimeDays": 2, "wasteRiskPercentage": 20, "perishability": 0.66, "reorderMultiple": 0.5, "baseDailyDemand": 2.1, "volatility": 0.07, "weatherTag": "warm", "servicePattern": "lunch", "eventSensitivity": 0.04, "currentStock": 4.5},
    {"id": 24, "name": "Aioli", "unit": "ltr", "category": "Sauce", "supplierName": "Makro", "costPrice": 2.8, "sellingPrice": 7.1, "shelfLifeDays": 30, "safetyStock": 2.0, "leadTimeDays": 3, "wasteRiskPercentage": 8, "perishability": 0.12, "reorderMultiple": 0.5, "baseDailyDemand": 1.2, "volatility": 0.05, "weatherTag": "neutral", "servicePattern": "all_day", "eventSensitivity": 0.03, "currentStock": 2.0},
]


def _seasonal_temperature(target_date: date) -> float:
    return 13 + math.sin((target_date.timetuple().tm_yday - 80) / 365 * 2 * math.pi) * 9


def _rain_probability(target_date: date) -> float:
    return 0.35 + max(0.0, math.sin((target_date.timetuple().tm_yday + 40) / 365 * 2 * math.pi)) * 0.25


def _holiday_windows(year: int) -> list[tuple[date, date, str]]:
    return [
        (date(year, 2, 15), date(year, 2, 23), "Voorjaarsvakantie"),
        (date(year, 4, 26), date(year, 5, 5), "Meivakantie"),
        (date(year, 7, 12), date(year, 8, 25), "Zomervakantie"),
        (date(year, 10, 18), date(year, 10, 26), "Herfstvakantie"),
        (date(year, 12, 20), date(year + 1, 1, 4), "Kerstvakantie"),
    ]


def _event_info(target_date: date) -> dict[str, Any]:
    week_of_month = ((target_date.day - 1) // 7) + 1
    if target_date.weekday() in (4, 5) and week_of_month == 1:
        return {"name": "Binnenstad weekendfestival", "impact": 1.12}
    if target_date.weekday() == 3 and week_of_month == 3:
        return {"name": "Zakelijk congres", "impact": 1.08}
    if target_date.month in (6, 7, 8) and target_date.weekday() in (5, 6):
        return {"name": "Zomerse boulevarddrukte", "impact": 1.10}
    return {"name": None, "impact": 1.0}


def _holiday_info(target_date: date) -> dict[str, Any]:
    for start, end, label in _holiday_windows(target_date.year):
        if start <= target_date <= end:
            return {"name": label, "impact": 1.06}
    if target_date.month == 12 and target_date.day in (24, 25, 26, 31):
        return {"name": "Feestdagen", "impact": 1.14}
    return {"name": None, "impact": 1.0}


def build_daily_context(target_date: date) -> dict[str, Any]:
    temperature = round(_seasonal_temperature(target_date), 1)
    rain_probability = _rain_probability(target_date)
    rng = random.Random(10_000 + target_date.toordinal())
    rainfall_mm = round(max(0.0, rain_probability * rng.uniform(0.0, 7.0)), 1)
    sunshine_hours = round(max(0.0, 7.5 - rainfall_mm * 0.5 + rng.uniform(-1.0, 1.5)), 1)
    wind_kmh = round(14 + rng.uniform(-5.0, 9.0), 1)
    weekend_factor = 1.0 if target_date.weekday() < 4 else 1.06 if target_date.weekday() == 4 else 1.14
    event = _event_info(target_date)
    holiday = _holiday_info(target_date)
    foot_traffic_index = round(
        min(
            1.45,
            max(
                0.72,
                weekend_factor
                * event["impact"]
                * holiday["impact"]
                * (1.03 if sunshine_hours >= 6 else 0.97 if rainfall_mm >= 4 else 1.0),
            ),
        ),
        2,
    )

    return {
        "date": target_date.isoformat(),
        "temperatureC": temperature,
        "rainfallMm": rainfall_mm,
        "sunshineHours": sunshine_hours,
        "windKmh": wind_kmh,
        "eventName": event["name"],
        "eventImpact": event["impact"],
        "holidayName": holiday["name"],
        "holidayImpact": holiday["impact"],
        "footTrafficIndex": foot_traffic_index,
    }


def _weather_product_factor(product: dict[str, Any], context: dict[str, Any]) -> float:
    factor = 1.0
    warm_weather = context["temperatureC"] >= 20 and context["sunshineHours"] >= 5
    cold_wet_weather = context["temperatureC"] <= 8 or context["rainfallMm"] >= 5

    if product["weatherTag"] == "warm" and warm_weather:
        factor += 0.12
    if product["weatherTag"] == "warm" and cold_wet_weather:
        factor -= 0.08
    if product["weatherTag"] == "cold" and cold_wet_weather:
        factor += 0.10
    if product["weatherTag"] == "cold" and warm_weather:
        factor -= 0.06
    return factor


def _service_pattern_factor(product: dict[str, Any], target_date: date) -> float:
    if product["servicePattern"] == "lunch":
        return 1.08 if target_date.weekday() < 5 else 0.92
    if product["servicePattern"] == "dinner":
        return 0.96 if target_date.weekday() < 3 else 1.07
    return 1.0


def _generate_daily_sales(product: dict[str, Any], target_date: date, context: dict[str, Any], day_index: int) -> float:
    rng = random.Random(product["id"] * 100_000 + target_date.toordinal())
    weekday_factor = WEEKDAY_MULTIPLIERS[target_date.weekday()]
    service_factor = _service_pattern_factor(product, target_date)
    weather_factor = _weather_product_factor(product, context)
    foot_traffic_factor = context["footTrafficIndex"]
    event_factor = 1 + ((context["eventImpact"] - 1) * (0.4 + product["eventSensitivity"]))
    holiday_factor = 1 + ((context["holidayImpact"] - 1) * 0.6)
    annual_trend = 1 + math.sin(day_index / 42) * 0.025
    noise = 1 + rng.uniform(-product["volatility"], product["volatility"])

    quantity = (
        product["baseDailyDemand"]
        * weekday_factor
        * service_factor
        * weather_factor
        * foot_traffic_factor
        * event_factor
        * holiday_factor
        * annual_trend
        * noise
    )
    return round(max(0.0, quantity), 1)


def generateRestaurantSimulation(weeks: int = 52) -> dict[str, Any]:
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=weeks * 7 - 1)
    context_history: list[dict[str, Any]] = []
    sales_history: list[dict[str, Any]] = []

    all_days = [start_date + timedelta(days=offset) for offset in range((end_date - start_date).days + 1)]
    contexts_by_date = {}
    for day_index, target_date in enumerate(all_days):
        context = build_daily_context(target_date)
        contexts_by_date[target_date.isoformat()] = context
        context_history.append(context)
        for product in PRODUCT_CATALOG:
            sales_history.append(
                {
                    "productId": product["id"],
                    "date": target_date.isoformat(),
                    "quantitySold": _generate_daily_sales(product, target_date, context, day_index),
                }
            )

    inventory = [
        {"productId": product["id"], "currentStock": float(product["currentStock"])}
        for product in PRODUCT_CATALOG
    ]
    future_context = [
        FutureContext(
            date=(date.today() + timedelta(days=offset)).isoformat(),
            weather=build_daily_context(date.today() + timedelta(days=offset)),
            event={
                "name": build_daily_context(date.today() + timedelta(days=offset))["eventName"],
                "impact": build_daily_context(date.today() + timedelta(days=offset))["eventImpact"],
            },
            holiday={
                "name": build_daily_context(date.today() + timedelta(days=offset))["holidayName"],
                "impact": build_daily_context(date.today() + timedelta(days=offset))["holidayImpact"],
            },
            footTrafficIndex=build_daily_context(date.today() + timedelta(days=offset))["footTrafficIndex"],
        ).__dict__
        for offset in range(1, 8)
    ]

    return {
        "restaurant": RESTAURANT_PROFILE,
        "products": [dict(product) for product in PRODUCT_CATALOG],
        "inventory": inventory,
        "salesHistory": sales_history,
        "contextHistory": context_history,
        "futureContext": future_context,
        "metadata": {
            "weeksSimulated": weeks,
            "generatedFor": end_date.isoformat(),
            "scenario": "HVAS Bistro in Den Haag Centrum with lunch+dinner demand drivers.",
        },
    }
