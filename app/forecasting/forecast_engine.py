from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from statistics import mean
from typing import Any
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX


@dataclass
class ForecastResult:
    baselineForecast: list[dict[str, Any]]
    methodUsed: str
    confidenceScore: float
    modelDiagnostics: dict[str, Any]
    forecastHorizonDays: int


def _series_from_sales(sales_history: list[dict[str, Any]]) -> pd.Series:
    frame = pd.DataFrame(sales_history)
    frame["date"] = pd.to_datetime(frame["date"])
    frame = frame.sort_values("date")
    series = pd.Series(frame["quantitySold"].astype(float).values, index=frame["date"])
    series = series.asfreq("D", fill_value=0.0)
    return series


def getFallbackForecast(
    sales_history: list[dict[str, Any]],
    horizon_days: int,
    category_average: float,
) -> ForecastResult:
    series = _series_from_sales(sales_history)
    history = series.tolist()
    weekday_groups = {
        weekday: series[series.index.weekday == weekday].tolist()
        for weekday in range(7)
    }
    baseline: list[dict[str, Any]] = []
    methods_used: list[str] = []
    last_date = series.index.max().date()
    moving_average = mean(history[-14:]) if history else 0.0

    for step in range(1, horizon_days + 1):
        target_date = last_date + pd.Timedelta(days=step)
        weekday_values = weekday_groups.get(target_date.weekday(), [])
        if len(weekday_values) >= 6:
            quantity = mean(weekday_values[-12:])
            methods_used.append("weekday_average")
        elif len(history) >= 10:
            quantity = moving_average
            methods_used.append("moving_average")
        else:
            quantity = category_average
            methods_used.append("category_average")
        baseline.append({"date": target_date.isoformat(), "quantity": round(max(0.0, quantity), 1)})

    method_used = methods_used[0] if len(set(methods_used)) == 1 else "hybrid_fallback"
    confidence = 76.0 if method_used == "weekday_average" else 62.0 if method_used == "moving_average" else 45.0
    return ForecastResult(
        baselineForecast=baseline,
        methodUsed=method_used,
        confidenceScore=confidence,
        modelDiagnostics={"fallback": True, "sampleDays": len(history)},
        forecastHorizonDays=horizon_days,
    )


def trainSarimaForecast(
    sales_history: list[dict[str, Any]],
    horizon_days: int,
    category_average: float,
) -> ForecastResult:
    series = _series_from_sales(sales_history)
    if len(series) < 84 or series.std() < 0.45:
        return getFallbackForecast(sales_history, horizon_days, category_average)

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            warnings.simplefilter("ignore", UserWarning)
            model = SARIMAX(
                series,
                order=(1, 0, 1),
                seasonal_order=(1, 1, 1, 7),
                trend="c",
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
            fitted = model.fit(disp=False)
        forecast_values = fitted.get_forecast(steps=horizon_days).predicted_mean.clip(lower=0.0)
        confidence = max(
            48.0,
            min(
                94.0,
                92.0 - (abs(float(fitted.aic)) / max(250.0, len(series) * 3.2)),
            ),
        )
        last_date = series.index.max().date()
        baseline = [
            {
                "date": (last_date + pd.Timedelta(days=index + 1)).isoformat(),
                "quantity": round(float(value), 1),
            }
            for index, value in enumerate(forecast_values)
        ]
        return ForecastResult(
            baselineForecast=baseline,
            methodUsed="sarima",
            confidenceScore=round(confidence, 1),
            modelDiagnostics={
                "aic": round(float(fitted.aic), 2),
                "bic": round(float(fitted.bic), 2),
                "residualStd": round(float(np.std(fitted.resid)), 3),
            },
            forecastHorizonDays=horizon_days,
        )
    except Exception:
        return getFallbackForecast(sales_history, horizon_days, category_average)


def evaluateForecastAccuracy(
    sales_history: list[dict[str, Any]],
    category_average: float,
    horizon_days: int = 14,
) -> dict[str, float]:
    series = _series_from_sales(sales_history)
    if len(series) <= horizon_days + 14:
        return {"mae": 0.0, "rmse": 0.0, "wape": 0.0, "stockoutSimulationRate": 0.0, "wasteSimulationRate": 0.0}

    train_history = [
        {"date": index.date().isoformat(), "quantitySold": float(value)}
        for index, value in series.iloc[:-horizon_days].items()
    ]
    actual = series.iloc[-horizon_days:].astype(float).tolist()
    result = trainSarimaForecast(train_history, horizon_days, category_average)
    predicted = [point["quantity"] for point in result.baselineForecast]

    absolute_errors = [abs(a - p) for a, p in zip(actual, predicted)]
    squared_errors = [(a - p) ** 2 for a, p in zip(actual, predicted)]
    actual_sum = max(sum(actual), 1.0)
    stockout_rate = sum(1 for a, p in zip(actual, predicted) if p < a * 0.85) / horizon_days
    waste_rate = sum(1 for a, p in zip(actual, predicted) if p > a * 1.2) / horizon_days

    return {
        "mae": round(mean(absolute_errors), 2),
        "rmse": round(sqrt(mean(squared_errors)), 2),
        "wape": round(sum(absolute_errors) / actual_sum, 3),
        "stockoutSimulationRate": round(stockout_rate, 3),
        "wasteSimulationRate": round(waste_rate, 3),
    }
