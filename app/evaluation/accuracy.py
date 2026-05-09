from __future__ import annotations

from statistics import mean
from typing import Any


def aggregate_accuracy(product_metrics: list[dict[str, Any]]) -> dict[str, float]:
    if not product_metrics:
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "wape": 0.0,
            "stockoutSimulationRate": 0.0,
            "wasteSimulationRate": 0.0,
        }

    return {
        "mae": round(mean(item["mae"] for item in product_metrics), 2),
        "rmse": round(mean(item["rmse"] for item in product_metrics), 2),
        "wape": round(mean(item["wape"] for item in product_metrics), 3),
        "stockoutSimulationRate": round(mean(item["stockoutSimulationRate"] for item in product_metrics), 3),
        "wasteSimulationRate": round(mean(item["wasteSimulationRate"] for item in product_metrics), 3),
    }

