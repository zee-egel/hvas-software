from __future__ import annotations

from typing import Any, Protocol


class WeatherDataSource(Protocol):
    def get_weather(self, target_date: str) -> dict[str, Any]: ...


class EventsDataSource(Protocol):
    def get_event(self, target_date: str) -> dict[str, Any]: ...


class FootTrafficDataSource(Protocol):
    def get_foot_traffic(self, target_date: str) -> float: ...


class HolidayDataSource(Protocol):
    def get_holiday(self, target_date: str) -> dict[str, Any]: ...


class SalesDataSource(Protocol):
    def get_sales(self, product_id: int) -> list[dict[str, Any]]: ...


class InventoryDataSource(Protocol):
    def get_inventory(self, product_id: int) -> float: ...


def calculateWeatherFactor(product: dict[str, Any], context: dict[str, Any]) -> tuple[float, list[dict[str, str]]]:
    factors: list[dict[str, str]] = []
    factor = 1.0
    weather = context["weather"]
    warm = weather["temperatureC"] >= 20 and weather["sunshineHours"] >= 5
    rainy = weather["rainfallMm"] >= 4
    cold = weather["temperatureC"] <= 8

    if product["weatherTag"] == "warm" and warm:
        factor = 1.12
        factors.append({"label": "Warm weer", "direction": "increase", "impact": "medium"})
    elif product["weatherTag"] == "warm" and rainy:
        factor = 0.92
        factors.append({"label": "Regen dempt terrasvraag", "direction": "decrease", "impact": "medium"})
    elif product["weatherTag"] == "cold" and (cold or rainy):
        factor = 1.10
        factors.append({"label": "Koud comfort-weer", "direction": "increase", "impact": "medium"})
    elif product["weatherTag"] == "cold" and warm:
        factor = 0.94
        factors.append({"label": "Warm weer drukt comfortvraag", "direction": "decrease", "impact": "low"})

    return factor, factors


def calculateEventFactor(product: dict[str, Any], context: dict[str, Any]) -> tuple[float, list[dict[str, str]]]:
    event = context["event"]
    if not event.get("name"):
        return 1.0, []
    impact = 1 + ((event["impact"] - 1) * (0.45 + product["eventSensitivity"]))
    return impact, [{"label": event["name"], "direction": "increase", "impact": "high" if impact >= 1.1 else "medium"}]


def calculateFootTrafficFactor(product: dict[str, Any], context: dict[str, Any]) -> tuple[float, list[dict[str, str]]]:
    index = float(context["footTrafficIndex"])
    factor = min(1.2, max(0.88, 0.94 + ((index - 1.0) * 0.65)))
    if factor > 1.05:
        return factor, [{"label": "Drukke binnenstad", "direction": "increase", "impact": "high"}]
    if factor < 0.97:
        return factor, [{"label": "Rustiger voetverkeer", "direction": "decrease", "impact": "low"}]
    return factor, []


def calculateHolidayFactor(context: dict[str, Any]) -> tuple[float, list[dict[str, str]]]:
    holiday = context["holiday"]
    if not holiday.get("name"):
        return 1.0, []
    return holiday["impact"], [{"label": holiday["name"], "direction": "increase", "impact": "medium"}]


def calculateProductContextFactor(product: dict[str, Any], context: dict[str, Any]) -> tuple[float, list[dict[str, str]]]:
    factors: list[dict[str, str]] = []
    service_factor = 1.0
    weekday = context["weather"]["date"]
    if product["servicePattern"] == "lunch" and context["footTrafficIndex"] >= 1.05:
        service_factor *= 1.04
        factors.append({"label": "Sterke lunchdrukte", "direction": "increase", "impact": "medium"})
    if product["servicePattern"] == "dinner" and context["event"]["impact"] > 1.0:
        service_factor *= 1.05
        factors.append({"label": "Drukkere avondservice", "direction": "increase", "impact": "medium"})
    if product["category"] == "Drinks" and context["weather"]["temperatureC"] >= 21:
        service_factor *= 1.08
        factors.append({"label": "Terrasvraag", "direction": "increase", "impact": "high"})
    if product["category"] == "Dessert" and context["weather"]["temperatureC"] <= 7:
        service_factor *= 0.97
        factors.append({"label": "Minder dessertvraag", "direction": "decrease", "impact": "low"})
    _ = weekday
    return service_factor, factors


def applyContextAdjustments(
    product: dict[str, Any],
    baseline_forecast: list[dict[str, Any]],
    future_context: list[dict[str, Any]],
) -> dict[str, Any]:
    adjusted_forecast: list[dict[str, Any]] = []
    influencing_factors: list[dict[str, str]] = []

    for baseline_point, context_point in zip(baseline_forecast, future_context):
        context = {
            "weather": context_point["weather"],
            "event": context_point["event"],
            "holiday": context_point["holiday"],
            "footTrafficIndex": context_point["footTrafficIndex"],
        }
        weather_factor, weather_labels = calculateWeatherFactor(product, context)
        event_factor, event_labels = calculateEventFactor(product, context)
        foot_traffic_factor, traffic_labels = calculateFootTrafficFactor(product, context)
        holiday_factor, holiday_labels = calculateHolidayFactor(context)
        product_factor, product_labels = calculateProductContextFactor(product, context)

        combined_factor = weather_factor * event_factor * foot_traffic_factor * holiday_factor * product_factor
        adjusted_forecast.append(
            {
                "date": baseline_point["date"],
                "baselineQuantity": baseline_point["quantity"],
                "quantity": round(max(0.0, baseline_point["quantity"] * combined_factor), 1),
            }
        )
        influencing_factors.extend(weather_labels + event_labels + traffic_labels + holiday_labels + product_labels)

    unique: list[dict[str, str]] = []
    seen = set()
    for factor in influencing_factors:
        key = (factor["label"], factor["direction"], factor["impact"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(factor)

    return {
        "adjustedForecast": adjusted_forecast,
        "influencingFactors": unique[:5],
    }

