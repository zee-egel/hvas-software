import json
import tempfile
import unittest

from app.settings import CSV_DIR
from app.simulation_service import InventorySimulationService


class InventorySimulationServiceTests(unittest.TestCase):
    def test_tick_returns_usage_variance_and_learning_state(self):
        with tempfile.NamedTemporaryFile(suffix=".json") as temp_state:
            service = InventorySimulationService(csv_dir=CSV_DIR, state_path=temp_state.name)
            service.start()
            snapshot = service.tick()

            self.assertTrue(snapshot["is_running"])
            self.assertIn("ingredient_usage", snapshot)
            self.assertIn("variance_summary", snapshot)
            self.assertIn("recent_events", snapshot)
            self.assertGreaterEqual(snapshot["current_week"], 2)
            self.assertTrue(isinstance(snapshot["accuracy_history"], list))
            if snapshot["ingredient_usage"]:
                first = snapshot["ingredient_usage"][0]
                self.assertIn("variancePct", first)
                self.assertIn("learnedMultiplier", first)

    def test_reset_clears_runtime_and_stops_simulation(self):
        with tempfile.NamedTemporaryFile(suffix=".json") as temp_state:
            service = InventorySimulationService(csv_dir=CSV_DIR, state_path=temp_state.name)
            service.start()
            service.tick()
            snapshot = service.reset()

            self.assertFalse(snapshot["is_running"])
            self.assertEqual(snapshot["predicted_orders"], {})
            self.assertEqual(snapshot["actual_orders"], {})
            self.assertEqual(snapshot["accuracy_history"], [])
            self.assertEqual(snapshot["ingredient_usage"], [])

    def test_loads_legacy_state_without_new_tick_fields(self):
        legacy_state = {
            "current_week": 15,
            "config": {
                "order_variance": 18,
                "restock_threshold": 1200,
                "restock_amount": 1700,
                "lookback_weeks": 4,
            },
            "accuracy_history": [100.0],
            "generated_orders": [{"week": 5, "recipe_id": 1, "num_orders": 1}],
            "last_tick": {
                "predicted_food_orders": {"Pasta": 1},
                "food_orders_this_week": {"Pasta": 0},
                "restocked_ingredients": {},
            },
            "inventory_levels": {"1": 6760.0},
        }
        with tempfile.NamedTemporaryFile(suffix=".json", mode="w+", encoding="utf-8") as temp_state:
            json.dump(legacy_state, temp_state)
            temp_state.flush()

            service = InventorySimulationService(csv_dir=CSV_DIR, state_path=temp_state.name)
            snapshot = service.get_state()

            self.assertEqual(snapshot["ingredient_usage"], [])
            self.assertEqual(snapshot["recent_events"], [])


if __name__ == "__main__":
    unittest.main()
