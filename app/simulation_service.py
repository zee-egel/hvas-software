from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class SimulationConfig:
    order_variance: int = 18
    restock_threshold: int = 1200
    restock_amount: int = 1700
    lookback_weeks: int = 4
    usage_variance_pct: int = 8
    waste_variance_pct: int = 3
    learning_rate_pct: int = 22


class InventorySimulationService:
    def __init__(
        self,
        csv_dir: str,
        state_path: str,
        default_config: dict[str, int] | None = None,
    ) -> None:
        self.csv_dir = Path(csv_dir)
        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)

        config = default_config or {}
        self.config = SimulationConfig(**config)
        self.base_orders = self._read_csv("orders.csv")
        self.ingredients_df = self._read_csv("ingredients.csv")
        self.inventory_df = self._read_csv("inventory.csv")
        self.recipes_df = self._read_csv("recipes.csv")

        self.generated_orders: list[dict[str, int]] = []
        self.accuracy_history: list[float] = []
        self.last_tick = self._empty_tick()
        self.current_week = self._starting_week()
        self.inventory_levels = self._inventory_from_csv()
        self.usage_profiles: dict[str, dict[str, float]] = {}
        self.running = False

        self._load_runtime_state()

    def get_state(self) -> dict[str, Any]:
        usage_summary = self._usage_summary()
        return {
            "predicted_food_orders": self.last_tick["predicted_food_orders"],
            "food_orders_this_week": self.last_tick["food_orders_this_week"],
            "model_accuracy": self.accuracy_history,
            "inventory": self.get_inventory_json(),
            "restocked_ingredients": self.last_tick["restocked_ingredients"],
            "current_week": self.current_week,
            "current_time": datetime.now().strftime("%H:%M:%S"),
            "config": asdict(self.config),
            "is_running": self.running,
            "predicted_orders": self.last_tick["predicted_food_orders"],
            "actual_orders": self.last_tick["food_orders_this_week"],
            "accuracy_history": self.accuracy_history,
            "ingredient_usage": self.last_tick["ingredient_usage"],
            "variance_summary": usage_summary,
            "recent_events": self.last_tick["recent_events"],
            "generated_at": datetime.now().isoformat(),
        }

    def start(self) -> dict[str, Any]:
        self.running = True
        self._save_runtime_state()
        return self.get_state()

    def stop(self) -> dict[str, Any]:
        self.running = False
        self._save_runtime_state()
        return self.get_state()

    def tick(self) -> dict[str, Any]:
        predictions = self._forecast_by_recipe()
        actual_orders = self._simulate_actual_orders(predictions)
        accuracy = self._calculate_accuracy(predictions, actual_orders)

        self.accuracy_history.append(accuracy)
        self._record_generated_orders(actual_orders)
        restocked, ingredient_usage, recent_events = self._apply_inventory_updates(
            actual_orders,
        )

        self.last_tick = {
            "predicted_food_orders": self._recipe_name_map(predictions),
            "food_orders_this_week": self._recipe_name_map(actual_orders),
            "restocked_ingredients": restocked,
            "ingredient_usage": ingredient_usage,
            "recent_events": recent_events,
        }

        self.current_week += 1
        self._save_runtime_state()
        return self.get_state()

    def reset(self) -> dict[str, Any]:
        self.generated_orders = []
        self.accuracy_history = []
        self.last_tick = self._empty_tick()
        self.current_week = self._starting_week()
        self.inventory_levels = self._inventory_from_csv()
        self.usage_profiles = {}
        self.running = False
        self._save_runtime_state()
        return self.get_state()

    def update_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.config.order_variance = max(0, min(100, int(payload.get("order_variance", self.config.order_variance))))
        self.config.restock_threshold = max(0, int(payload.get("restock_threshold", self.config.restock_threshold)))
        self.config.restock_amount = max(1, int(payload.get("restock_amount", self.config.restock_amount)))
        self.config.lookback_weeks = max(2, min(12, int(payload.get("lookback_weeks", self.config.lookback_weeks))))
        self.config.usage_variance_pct = max(1, min(40, int(payload.get("usage_variance_pct", self.config.usage_variance_pct))))
        self.config.waste_variance_pct = max(0, min(20, int(payload.get("waste_variance_pct", self.config.waste_variance_pct))))
        self.config.learning_rate_pct = max(5, min(80, int(payload.get("learning_rate_pct", self.config.learning_rate_pct))))
        self._save_runtime_state()
        return asdict(self.config)

    def get_ingredients(self) -> list[dict[str, Any]]:
        return [
            {"id": int(row["ingredient_id"]), "name": row["ingredient_name"]}
            for _, row in self.ingredients_df.sort_values("ingredient_id").iterrows()
        ]

    def add_ingredient(self, name: str) -> dict[str, Any]:
        trimmed = name.strip()
        if not trimmed:
            raise ValueError("Ingredient name is required.")
        if self.ingredients_df["ingredient_name"].str.lower().eq(trimmed.lower()).any():
            raise ValueError("Ingredient already exists.")

        ingredient_id = int(self.ingredients_df["ingredient_id"].max()) + 1 if not self.ingredients_df.empty else 1
        self.ingredients_df = pd.concat(
            [
                self.ingredients_df,
                pd.DataFrame([{"ingredient_id": ingredient_id, "ingredient_name": trimmed}]),
            ],
            ignore_index=True,
        )
        self.inventory_levels[ingredient_id] = float(self.config.restock_amount)
        self._sync_inventory_df()
        self._persist_catalog_data()
        self._save_runtime_state()
        return {"id": ingredient_id, "name": trimmed}

    def get_recipes(self) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for recipe_id, group in self.recipes_df.groupby("recipe_id", sort=True):
            first = group.iloc[0]
            ingredients = []
            for _, row in group.iterrows():
                ingredient_name = self._ingredient_name(int(row["ingredient_id"]))
                ingredients.append(
                    {
                        "ingredientId": int(row["ingredient_id"]),
                        "name": ingredient_name,
                        "quantity": float(row["quantity"]),
                    }
                )
            result.append(
                {
                    "id": int(recipe_id),
                    "name": first["recipe_name"],
                    "ingredients": ingredients,
                }
            )
        return result

    def add_recipe(self, name: str, ingredients: list[dict[str, Any]]) -> dict[str, Any]:
        trimmed = name.strip()
        if not trimmed:
            raise ValueError("Recipe name is required.")
        if not ingredients:
            raise ValueError("At least one ingredient is required.")

        recipe_id = int(self.recipes_df["recipe_id"].max()) + 1 if not self.recipes_df.empty else 1
        rows = []
        seen_ingredients: set[int] = set()
        for ingredient in ingredients:
            ingredient_id = int(ingredient["ingredientId"])
            quantity = float(ingredient["quantity"])
            if ingredient_id in seen_ingredients:
                raise ValueError("Duplicate ingredients are not allowed in a recipe.")
            if ingredient_id not in set(self.ingredients_df["ingredient_id"].astype(int).tolist()):
                raise ValueError(f"Ingredient {ingredient_id} does not exist.")
            rows.append(
                {
                    "recipe_id": recipe_id,
                    "recipe_name": trimmed,
                    "ingredient_id": ingredient_id,
                    "quantity": quantity,
                }
            )
            seen_ingredients.add(ingredient_id)

        self.recipes_df = pd.concat([self.recipes_df, pd.DataFrame(rows)], ignore_index=True)
        self._persist_catalog_data()
        return {"id": recipe_id, "name": trimmed}

    def delete_recipe(self, recipe_id: int) -> None:
        recipe_name = self._recipe_name(recipe_id)
        self.recipes_df = self.recipes_df[self.recipes_df["recipe_id"] != recipe_id].copy()
        self.generated_orders = [row for row in self.generated_orders if row["recipe_id"] != recipe_id]
        self.last_tick["predicted_food_orders"] = {
            name: value
            for name, value in self.last_tick["predicted_food_orders"].items()
            if name != recipe_name
        }
        self.last_tick["food_orders_this_week"] = {
            name: value
            for name, value in self.last_tick["food_orders_this_week"].items()
            if name != recipe_name
        }
        self._persist_catalog_data()
        self._save_runtime_state()

    def get_inventory_json(self) -> dict[str, int]:
        inventory: dict[str, int] = {}
        for ingredient_id, quantity in sorted(self.inventory_levels.items()):
            inventory[self._ingredient_name(ingredient_id)] = int(round(quantity))
        return inventory

    def _forecast_by_recipe(self) -> dict[int, int]:
        predictions: dict[int, int] = {}
        history = self._all_orders()
        recipe_ids = sorted(self.recipes_df["recipe_id"].dropna().astype(int).unique().tolist())

        for recipe_id in recipe_ids:
            recipe_history = (
                history[history["recipe_id"] == recipe_id]
                .sort_values("week")["num_orders"]
                .astype(float)
                .tolist()
            )
            if not recipe_history:
                predictions[recipe_id] = 0
                continue

            lookback = recipe_history[-self.config.lookback_weeks :]
            weights = np.arange(1, len(lookback) + 1, dtype=float)
            weighted_average = float(np.average(lookback, weights=weights))
            slope = 0.0
            if len(lookback) >= 3:
                x_axis = np.arange(len(lookback), dtype=float)
                slope = float(np.polyfit(x_axis, np.array(lookback, dtype=float), 1)[0])

            prediction = max(0, int(round(weighted_average + slope)))
            predictions[recipe_id] = prediction

        return predictions

    def _simulate_actual_orders(self, predictions: dict[int, int]) -> dict[int, int]:
        actual_orders: dict[int, int] = {}
        rng = np.random.default_rng()
        for recipe_id, predicted in predictions.items():
            scale = max(1.0, predicted * (self.config.order_variance / 100))
            actual = int(round(rng.normal(loc=predicted, scale=scale)))
            actual_orders[recipe_id] = max(0, actual)
        return actual_orders

    def _calculate_accuracy(self, predicted: dict[int, int], actual: dict[int, int]) -> float:
        recipe_ids = sorted(set(predicted) | set(actual))
        if not recipe_ids:
            return 100.0

        percentage_errors = []
        for recipe_id in recipe_ids:
            actual_value = actual.get(recipe_id, 0)
            predicted_value = predicted.get(recipe_id, 0)
            denominator = max(1, actual_value)
            percentage_errors.append(abs(predicted_value - actual_value) / denominator)

        accuracy = 100 - (sum(percentage_errors) / len(percentage_errors) * 100)
        return round(max(0.0, min(100.0, accuracy)), 2)

    def _apply_inventory_updates(
        self,
        actual_orders: dict[int, int],
    ) -> tuple[dict[str, int], list[dict[str, Any]], list[str]]:
        consumption: dict[int, float] = {}
        usage_rows: dict[int, dict[str, Any]] = {}
        for recipe_id, order_count in actual_orders.items():
            recipe_rows = self.recipes_df[self.recipes_df["recipe_id"] == recipe_id]
            for _, row in recipe_rows.iterrows():
                ingredient_id = int(row["ingredient_id"])
                expected_used = float(row["quantity"]) * order_count
                actual_used, observed_multiplier = self._simulate_usage(
                    recipe_id=recipe_id,
                    ingredient_id=ingredient_id,
                    expected_used=expected_used,
                )
                consumption[ingredient_id] = consumption.get(ingredient_id, 0.0) + actual_used
                self._learn_usage_profile(
                    recipe_id=recipe_id,
                    ingredient_id=ingredient_id,
                    observed_multiplier=observed_multiplier,
                )
                if ingredient_id not in usage_rows:
                    usage_rows[ingredient_id] = {
                        "ingredientId": ingredient_id,
                        "ingredientName": self._ingredient_name(ingredient_id),
                        "expectedUsage": 0.0,
                        "actualUsage": 0.0,
                        "learnedMultiplier": 1.0,
                        "confidence": 0.0,
                    }
                profile = self._get_usage_profile(recipe_id, ingredient_id)
                usage_rows[ingredient_id]["expectedUsage"] += expected_used
                usage_rows[ingredient_id]["actualUsage"] += actual_used
                usage_rows[ingredient_id]["learnedMultiplier"] = round(
                    profile["learned_multiplier"],
                    3,
                )
                usage_rows[ingredient_id]["confidence"] = round(
                    min(1.0, profile["observations"] / 8.0),
                    2,
                )

        for ingredient_id, used in consumption.items():
            current = self.inventory_levels.get(ingredient_id, 0.0)
            self.inventory_levels[ingredient_id] = current - used

        restocked: dict[str, int] = {}
        for ingredient_id, quantity in sorted(self.inventory_levels.items()):
            added = 0
            while quantity < self.config.restock_threshold:
                quantity += self.config.restock_amount
                added += self.config.restock_amount
            self.inventory_levels[ingredient_id] = quantity
            if added > 0:
                restocked[self._ingredient_name(ingredient_id)] = added

        self._sync_inventory_df()
        self._save_runtime_state()
        ingredient_usage = []
        for row in usage_rows.values():
            variance_pct = 0.0
            if row["expectedUsage"] > 0:
                variance_pct = ((row["actualUsage"] - row["expectedUsage"]) / row["expectedUsage"]) * 100
            ingredient_usage.append(
                {
                    **row,
                    "expectedUsage": round(row["expectedUsage"], 2),
                    "actualUsage": round(row["actualUsage"], 2),
                    "variancePct": round(variance_pct, 1),
                }
            )
        ingredient_usage.sort(
            key=lambda item: abs(item["variancePct"]),
            reverse=True,
        )
        recent_events = self._build_recent_events(ingredient_usage, restocked)
        return restocked, ingredient_usage[:8], recent_events

    def _record_generated_orders(self, actual_orders: dict[int, int]) -> None:
        for recipe_id, order_count in actual_orders.items():
            self.generated_orders.append(
                {
                    "week": self.current_week,
                    "recipe_id": recipe_id,
                    "num_orders": order_count,
                }
            )

    def _all_orders(self) -> pd.DataFrame:
        generated = pd.DataFrame(self.generated_orders)
        if generated.empty:
            return self.base_orders.copy()
        return pd.concat([self.base_orders, generated], ignore_index=True)

    def _starting_week(self) -> int:
        if self.base_orders.empty:
            return 1
        return int(self.base_orders["week"].max()) + 1

    def _inventory_from_csv(self) -> dict[int, float]:
        return {
            int(row["ingredient_id"]): float(row["quantity"])
            for _, row in self.inventory_df.iterrows()
        }

    def _load_runtime_state(self) -> None:
        if not self.state_path.exists():
            self._save_runtime_state()
            return

        try:
            with self.state_path.open("r", encoding="utf-8") as handle:
                state = json.load(handle)
        except (json.JSONDecodeError, OSError):
            self._save_runtime_state()
            return

        config = state.get("config", {})
        self.config = SimulationConfig(
            order_variance=int(config.get("order_variance", self.config.order_variance)),
            restock_threshold=int(config.get("restock_threshold", self.config.restock_threshold)),
            restock_amount=int(config.get("restock_amount", self.config.restock_amount)),
            lookback_weeks=int(config.get("lookback_weeks", self.config.lookback_weeks)),
            usage_variance_pct=int(config.get("usage_variance_pct", self.config.usage_variance_pct)),
            waste_variance_pct=int(config.get("waste_variance_pct", self.config.waste_variance_pct)),
            learning_rate_pct=int(config.get("learning_rate_pct", self.config.learning_rate_pct)),
        )
        self.current_week = int(state.get("current_week", self.current_week))
        self.accuracy_history = [float(value) for value in state.get("accuracy_history", [])]
        self.last_tick = self._normalize_last_tick(state.get("last_tick"))
        self.running = bool(state.get("running", False))
        self.generated_orders = [
            {
                "week": int(row["week"]),
                "recipe_id": int(row["recipe_id"]),
                "num_orders": int(row["num_orders"]),
            }
            for row in state.get("generated_orders", [])
        ]
        inventory = state.get("inventory_levels")
        if inventory:
            self.inventory_levels = {int(key): float(value) for key, value in inventory.items()}
        usage_profiles = state.get("usage_profiles", {})
        self.usage_profiles = {
            str(key): {
                "learned_multiplier": float(value.get("learned_multiplier", 1.0)),
                "observations": float(value.get("observations", 0.0)),
            }
            for key, value in usage_profiles.items()
        }
        # Persist normalized state so older schema files do not keep breaking newer UI/API fields.
        self._save_runtime_state()

    def _save_runtime_state(self) -> None:
        payload = {
            "current_week": self.current_week,
            "config": asdict(self.config),
            "accuracy_history": self.accuracy_history,
            "generated_orders": self.generated_orders,
            "last_tick": self.last_tick,
            "inventory_levels": self.inventory_levels,
            "usage_profiles": self.usage_profiles,
            "running": self.running,
        }
        with self.state_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

    def _persist_catalog_data(self) -> None:
        self.ingredients_df.sort_values("ingredient_id").to_csv(
            self.csv_dir / "ingredients.csv",
            index=False,
            encoding="utf-8-sig",
        )
        self.inventory_df.sort_values("ingredient_id").to_csv(
            self.csv_dir / "inventory.csv",
            index=False,
            encoding="utf-8-sig",
        )
        self.recipes_df.sort_values(["recipe_id", "ingredient_id"]).to_csv(
            self.csv_dir / "recipes.csv",
            index=False,
            encoding="utf-8-sig",
        )

    def _sync_inventory_df(self) -> None:
        self.inventory_df = pd.DataFrame(
            [
                {"ingredient_id": ingredient_id, "quantity": quantity}
                for ingredient_id, quantity in sorted(self.inventory_levels.items())
            ]
        )
        self._persist_catalog_data()

    def _recipe_name_map(self, values: dict[int, int]) -> dict[str, int]:
        return {self._recipe_name(recipe_id): value for recipe_id, value in values.items()}

    def _ingredient_name(self, ingredient_id: int) -> str:
        match = self.ingredients_df[self.ingredients_df["ingredient_id"] == ingredient_id]
        if match.empty:
            return f"Ingredient {ingredient_id}"
        return str(match.iloc[0]["ingredient_name"])

    def _recipe_name(self, recipe_id: int) -> str:
        match = self.recipes_df[self.recipes_df["recipe_id"] == recipe_id]
        if match.empty:
            return f"Recipe {recipe_id}"
        return str(match.iloc[0]["recipe_name"])

    def _empty_tick(self) -> dict[str, dict[str, int]]:
        return {
            "predicted_food_orders": {},
            "food_orders_this_week": {},
            "restocked_ingredients": {},
            "ingredient_usage": [],
            "recent_events": [],
        }

    def _normalize_last_tick(self, last_tick: dict[str, Any] | None) -> dict[str, Any]:
        normalized = self._empty_tick()
        if not isinstance(last_tick, dict):
            return normalized
        normalized["predicted_food_orders"] = {
            str(key): int(value)
            for key, value in (last_tick.get("predicted_food_orders") or {}).items()
        }
        normalized["food_orders_this_week"] = {
            str(key): int(value)
            for key, value in (last_tick.get("food_orders_this_week") or {}).items()
        }
        normalized["restocked_ingredients"] = {
            str(key): int(value)
            for key, value in (last_tick.get("restocked_ingredients") or {}).items()
        }
        ingredient_usage = last_tick.get("ingredient_usage") or []
        if isinstance(ingredient_usage, list):
            normalized["ingredient_usage"] = ingredient_usage
        recent_events = last_tick.get("recent_events") or []
        if isinstance(recent_events, list):
            normalized["recent_events"] = [str(event) for event in recent_events]
        return normalized

    def _usage_profile_key(self, recipe_id: int, ingredient_id: int) -> str:
        return f"{recipe_id}:{ingredient_id}"

    def _get_usage_profile(self, recipe_id: int, ingredient_id: int) -> dict[str, float]:
        key = self._usage_profile_key(recipe_id, ingredient_id)
        profile = self.usage_profiles.get(key)
        if profile is None:
            profile = {"learned_multiplier": 1.0, "observations": 0.0}
            self.usage_profiles[key] = profile
        return profile

    def _simulate_usage(
        self,
        recipe_id: int,
        ingredient_id: int,
        expected_used: float,
    ) -> tuple[float, float]:
        if expected_used <= 0:
            return 0.0, 1.0
        profile = self._get_usage_profile(recipe_id, ingredient_id)
        rng = np.random.default_rng(seed=(self.current_week * 10_000) + (recipe_id * 100) + ingredient_id)
        base_variance = self._base_usage_variance(expected_used)
        portion_multiplier = rng.normal(
            loc=profile["learned_multiplier"],
            scale=base_variance,
        )
        waste_multiplier = 1 + rng.uniform(0, self.config.waste_variance_pct / 100)
        observed_multiplier = max(0.85, min(1.3, portion_multiplier)) * waste_multiplier
        actual_used = max(0.0, expected_used * observed_multiplier)
        return actual_used, observed_multiplier

    def _base_usage_variance(self, expected_used: float) -> float:
        configured = self.config.usage_variance_pct / 100
        return max(0.015, min(0.18, configured * (0.6 if expected_used >= 100 else 0.8 if expected_used >= 30 else 1.0)))

    def _learn_usage_profile(
        self,
        recipe_id: int,
        ingredient_id: int,
        observed_multiplier: float,
    ) -> None:
        profile = self._get_usage_profile(recipe_id, ingredient_id)
        learning_rate = self.config.learning_rate_pct / 100
        current = profile["learned_multiplier"]
        profile["learned_multiplier"] = max(
            0.9,
            min(1.25, current + (observed_multiplier - current) * learning_rate),
        )
        profile["observations"] = profile.get("observations", 0.0) + 1

    def _usage_summary(self) -> dict[str, Any]:
        rows = self.last_tick["ingredient_usage"]
        if not rows:
            return {
                "average_usage_skew_pct": 0.0,
                "average_absolute_skew_pct": 0.0,
                "most_volatile_ingredient": None,
                "low_stock_ingredients": [],
            }
        avg_skew = sum(row["variancePct"] for row in rows) / len(rows)
        avg_abs_skew = sum(abs(row["variancePct"]) for row in rows) / len(rows)
        most_volatile = max(rows, key=lambda row: abs(row["variancePct"]))
        low_stock = [
            name
            for name, quantity in self.get_inventory_json().items()
            if quantity < self.config.restock_threshold + int(self.config.restock_amount * 0.3)
        ][:5]
        return {
            "average_usage_skew_pct": round(avg_skew, 1),
            "average_absolute_skew_pct": round(avg_abs_skew, 1),
            "most_volatile_ingredient": most_volatile,
            "low_stock_ingredients": low_stock,
        }

    def _build_recent_events(
        self,
        ingredient_usage: list[dict[str, Any]],
        restocked: dict[str, int],
    ) -> list[str]:
        events: list[str] = []
        if ingredient_usage:
            top = ingredient_usage[0]
            direction = "above" if top["variancePct"] >= 0 else "below"
            events.append(
                f"{top['ingredientName']} ran {abs(top['variancePct']):.1f}% {direction} recipe expectation."
            )
        if restocked:
            first_name = next(iter(restocked))
            events.append(
                f"Auto-restocked {first_name} by {restocked[first_name]} units to protect service."
            )
        if not events:
            events.append("Service ran close to recipe expectations this cycle.")
        return events[:3]

    def _read_csv(self, name: str) -> pd.DataFrame:
        frame = pd.read_csv(self.csv_dir / name, encoding="utf-8-sig")
        frame.columns = [column.strip() for column in frame.columns]
        return frame
