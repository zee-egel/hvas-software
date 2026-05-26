import unittest

from app.smart_ordering.forecast import calculate_suggestion
from app.smart_ordering.supplier_grouping import group_suggestions_by_supplier
from app.smart_ordering.types import SmartOrderingSuggestion


def build_product(**overrides):
    product = {
        "productId": 1,
        "productName": "Tomaat",
        "category": "Produce",
        "unit": "kg",
        "supplierId": 2,
        "supplierName": "Bidfood",
        "unitCost": 2.4,
        "sellingPrice": 7.8,
        "minimumStock": 6.0,
        "packageQuantity": 0.5,
        "supplierAvailable": True,
        "safetyStock": 6.0,
        "salesHistory": [{"quantitySold": 5.0} for _ in range(20)],
    }
    product.update(overrides)
    return product


class SmartOrderingForecastTests(unittest.TestCase):
    def test_respects_selected_days(self):
        suggestion = calculate_suggestion(
            product=build_product(),
            recent_usage_days=20,
            recent_usage_total=100.0,
            average_daily_usage=5.0,
            days=4,
            include_current_stock=False,
            include_outstanding_orders=False,
            current_stock=0.0,
            outstanding_incoming_quantity=0.0,
            has_stock_data=True,
            stock_is_stale=False,
        )
        self.assertEqual(suggestion.expectedUsage, 20.0)

    def test_subtracts_current_stock_when_enabled(self):
        suggestion = calculate_suggestion(
            product=build_product(),
            recent_usage_days=20,
            recent_usage_total=100.0,
            average_daily_usage=5.0,
            days=4,
            include_current_stock=True,
            include_outstanding_orders=False,
            current_stock=8.0,
            outstanding_incoming_quantity=0.0,
            has_stock_data=True,
            stock_is_stale=False,
        )
        self.assertLess(suggestion.requiredQuantity, 26.0)

    def test_subtracts_outstanding_orders_when_enabled(self):
        suggestion = calculate_suggestion(
            product=build_product(),
            recent_usage_days=20,
            recent_usage_total=100.0,
            average_daily_usage=5.0,
            days=4,
            include_current_stock=False,
            include_outstanding_orders=True,
            current_stock=0.0,
            outstanding_incoming_quantity=4.0,
            has_stock_data=True,
            stock_is_stale=False,
        )
        self.assertLess(suggestion.requiredQuantity, 26.0)

    def test_rounds_up_to_package_size(self):
        suggestion = calculate_suggestion(
            product=build_product(packageQuantity=6.0, unit="pcs", salesHistory=[{"quantitySold": 2.0} for _ in range(20)]),
            recent_usage_days=20,
            recent_usage_total=40.0,
            average_daily_usage=2.0,
            days=4,
            include_current_stock=False,
            include_outstanding_orders=False,
            current_stock=0.0,
            outstanding_incoming_quantity=0.0,
            has_stock_data=True,
            stock_is_stale=False,
        )
        self.assertEqual(suggestion.suggestedQuantity % 6.0, 0.0)

    def test_creates_missing_supplier_warning(self):
        suggestion = calculate_suggestion(
            product=build_product(supplierId=None, supplierName=None),
            recent_usage_days=20,
            recent_usage_total=100.0,
            average_daily_usage=5.0,
            days=4,
            include_current_stock=False,
            include_outstanding_orders=False,
            current_stock=0.0,
            outstanding_incoming_quantity=0.0,
            has_stock_data=True,
            stock_is_stale=False,
        )
        self.assertIn("NO_SUPPLIER_LINKED", suggestion.warnings)

    def test_creates_low_confidence_warning(self):
        suggestion = calculate_suggestion(
            product=build_product(salesHistory=[{"quantitySold": 8.0}, {"quantitySold": 1.0}]),
            recent_usage_days=2,
            recent_usage_total=9.0,
            average_daily_usage=4.5,
            days=4,
            include_current_stock=False,
            include_outstanding_orders=False,
            current_stock=0.0,
            outstanding_incoming_quantity=0.0,
            has_stock_data=False,
            stock_is_stale=False,
        )
        self.assertIn("LOW_CONFIDENCE", suggestion.warnings)

    def test_groups_lines_by_supplier_correctly(self):
        suggestions = [
            SmartOrderingSuggestion(
                productId=1,
                productName="Tomaat",
                category="Produce",
                unit="kg",
                supplierId=2,
                supplierName="Bidfood",
                expectedUsage=20.0,
                averageDailyUsage=5.0,
                currentStock=3.0,
                outstandingIncomingQuantity=0.0,
                safetyBuffer=3.0,
                requiredQuantity=20.0,
                suggestedQuantity=20.0,
                packageQuantity=0.5,
                packageLabel="0.5 kg",
                estimatedLineCost=48.0,
                confidenceScore=81.0,
                confidence="high",
                warnings=[],
                stockDataStatus="ok",
                supplierAvailable=True,
                minimumStock=6.0,
            ),
            SmartOrderingSuggestion(
                productId=2,
                productName="Sla",
                category="Produce",
                unit="head",
                supplierId=2,
                supplierName="Bidfood",
                expectedUsage=12.0,
                averageDailyUsage=3.0,
                currentStock=4.0,
                outstandingIncomingQuantity=0.0,
                safetyBuffer=2.0,
                requiredQuantity=10.0,
                suggestedQuantity=10.0,
                packageQuantity=1.0,
                packageLabel="1 head",
                estimatedLineCost=12.0,
                confidenceScore=79.0,
                confidence="high",
                warnings=[],
                stockDataStatus="ok",
                supplierAvailable=True,
                minimumStock=6.0,
            ),
        ]
        drafts = group_suggestions_by_supplier(
            suggestions,
            [
                {"productId": 1, "accepted": True, "quantity": 20, "unit": "kg", "supplierId": 2},
                {"productId": 2, "accepted": True, "quantity": 10, "unit": "head", "supplierId": 2},
            ],
        )
        self.assertEqual(len(drafts), 1)
        self.assertEqual(drafts[0].supplierName, "Bidfood")
        self.assertEqual(drafts[0].totalProducts, 2)


if __name__ == "__main__":
    unittest.main()
