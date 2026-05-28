from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import math
import random
from typing import Any

try:
    from data.normalized_product_catalog import PRODUCT_CATALOG
except ImportError:
    from .normalized_product_catalog import PRODUCT_CATALOG


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
