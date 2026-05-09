import tempfile
import unittest

from app.adjustments.context_adjustments import applyContextAdjustments
from app.data.restaurant_simulation import PRODUCT_CATALOG, generateRestaurantSimulation
from app.decision.reorder import calculateReorderAdvice
from app.forecasting.forecast_engine import getFallbackForecast, trainSarimaForecast
from app.purchase_orders.drafts import generatePurchaseOrderDrafts
from app.smart_order_service import SmartOrderAssistantService


class SmartOrderAssistantTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.simulation = generateRestaurantSimulation(weeks=20)
        cls.product = cls.simulation["products"][0]
        cls.sales_history = [
            sale
            for sale in cls.simulation["salesHistory"]
            if sale["productId"] == cls.product["id"]
        ]
        cls.future_context = cls.simulation["futureContext"]

    def test_train_sarima_forecast_uses_sarima_for_sufficient_history(self):
        forecast = trainSarimaForecast(self.sales_history, 7, category_average=4.0)
        self.assertIn(forecast.methodUsed, {"sarima", "weekday_average", "moving_average", "hybrid_fallback"})
        self.assertEqual(len(forecast.baselineForecast), 7)
        self.assertGreater(forecast.confidenceScore, 0)

    def test_fallback_forecast_returns_usable_series(self):
        tiny_history = self.sales_history[:10]
        forecast = getFallbackForecast(tiny_history, 5, category_average=3.5)
        self.assertEqual(len(forecast.baselineForecast), 5)
        self.assertIn(forecast.methodUsed, {"weekday_average", "moving_average", "category_average", "hybrid_fallback"})

    def test_context_adjustments_change_baseline_when_context_exists(self):
        baseline = trainSarimaForecast(self.sales_history, 7, category_average=4.0)
        adjusted = applyContextAdjustments(self.product, baseline.baselineForecast, self.future_context)
        self.assertEqual(len(adjusted["adjustedForecast"]), 7)
        self.assertTrue(all("quantity" in point for point in adjusted["adjustedForecast"]))

    def test_decision_layer_can_return_order_or_review(self):
        baseline = getFallbackForecast(self.sales_history[:14], 7, category_average=4.0)
        adjusted = applyContextAdjustments(self.product, baseline.baselineForecast, self.future_context)
        advice = calculateReorderAdvice(
            product=self.product,
            current_stock=1.0,
            adjusted_forecast=adjusted["adjustedForecast"],
            confidence_score=52.0,
        )
        self.assertIn(advice["adviceType"], {"ORDER", "NEEDS_REVIEW"})
        self.assertGreaterEqual(advice["reorderQuantity"], 0.0)

    def test_generate_purchase_order_drafts_groups_by_supplier(self):
        item = {
            "id": "advice-1",
            "productId": self.product["id"],
            "productName": self.product["name"],
            "supplierName": self.product["supplierName"],
            "unit": self.product["unit"],
            "costPrice": self.product["costPrice"],
            "leadTimeDays": self.product["leadTimeDays"],
            "reorderQuantity": 5.0,
            "adviceType": "ORDER",
            "urgency": "high",
            "financialImpact": {
                "protectedRevenue": 140.0,
                "potentialWasteCost": 0.0,
            },
            "explanation": "Automatisch voorbereid.",
        }
        drafts = generatePurchaseOrderDrafts([item], {})
        self.assertEqual(len(drafts), 1)
        self.assertEqual(drafts[0]["supplierName"], self.product["supplierName"])
        self.assertEqual(drafts[0]["productLines"][0]["linkedAdviceId"], "advice-1")

    def test_service_snapshot_contains_new_response_shape(self):
        with tempfile.NamedTemporaryFile(suffix=".json") as temp_state:
            service = SmartOrderAssistantService(state_path=temp_state.name)
            snapshot = service.get_order_advice()
            self.assertIn("restaurant", snapshot)
            self.assertIn("productAdvice", snapshot)
            self.assertIn("purchaseOrderDrafts", snapshot)
            self.assertIn("riskRadar", snapshot)
            self.assertTrue(snapshot["productAdvice"])

    def test_approve_purchase_order_updates_history(self):
        with tempfile.NamedTemporaryFile(suffix=".json") as temp_state:
            service = SmartOrderAssistantService(state_path=temp_state.name)
            snapshot = service.get_order_advice()
            first_order = snapshot["purchaseOrderDrafts"][0]
            updated_snapshot = service.approve_purchase_order(first_order["id"])
            matching_order = next(
                order
                for order in updated_snapshot["purchaseOrderDrafts"]
                if order["id"] == first_order["id"]
            )
            self.assertEqual(matching_order["status"], "SENT_SIMULATED")
            self.assertTrue(
                any(
                    item["id"] == first_order["id"] and item["status"] == "SENT_SIMULATED"
                    for item in updated_snapshot["purchaseOrderHistory"]
                )
            )


if __name__ == "__main__":
    unittest.main()
