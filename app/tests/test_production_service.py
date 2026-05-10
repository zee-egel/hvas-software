import os
import unittest
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete

from app.production_service import ProductionOperationsService


class ProductionOperationsServiceTests(unittest.TestCase):
    def setUp(self):
        self.db_url = os.getenv("TEST_DATABASE_URL")
        if not self.db_url:
            self.skipTest("Set TEST_DATABASE_URL to run Postgres-backed production service tests.")
        self.service = ProductionOperationsService(db_url=self.db_url)

    def tearDown(self):
        pass

    def _reset_operational_records(self):
        with self.service.engine.begin() as conn:
            conn.execute(delete(self.service.purchase_order_lines))
            conn.execute(delete(self.service.purchase_orders))
            conn.execute(delete(self.service.advice_runs))
            conn.execute(delete(self.service.import_jobs))
            conn.execute(delete(self.service.sales_transactions))
            conn.execute(delete(self.service.inventory_movements))
            conn.execute(delete(self.service.waste_events))
            conn.execute(delete(self.service.stock_counts))

    def test_bootstrap_snapshot_contains_production_metadata(self):
        snapshot = self.service.get_order_advice()
        self.assertIn("dataFreshness", snapshot)
        self.assertIn("dataCompleteness", snapshot)
        self.assertIn("blockingIssues", snapshot)
        self.assertIn("sourceTimestamps", snapshot)
        self.assertTrue(snapshot["restaurant"]["id"])

    def test_create_and_authenticate_user(self):
        user = self.service.create_user(
            full_name="Alex Chef",
            email="alex@hvas.test",
            company_name="HVAS Kitchens",
            password="supersecure123",
        )
        self.assertEqual(user["email"], "alex@hvas.test")
        authenticated = self.service.authenticate_user(
            email="alex@hvas.test",
            password="supersecure123",
        )
        self.assertEqual(authenticated["fullName"], "Alex Chef")

    def test_sales_import_deduplicates_external_ids(self):
        self._reset_operational_records()
        now = datetime.now(UTC)
        first = self.service.import_sales(
            [
                {
                    "productId": 1,
                    "externalId": "sale-1",
                    "soldAt": now.isoformat(),
                    "quantity": 4,
                    "unitPrice": 12.5,
                }
            ],
            source_system="test-pos",
            recompute=False,
        )
        second = self.service.import_sales(
            [
                {
                    "productId": 1,
                    "externalId": "sale-1",
                    "soldAt": now.isoformat(),
                    "quantity": 4,
                    "unitPrice": 12.5,
                }
            ],
            source_system="test-pos",
            recompute=False,
        )
        self.assertEqual(first["acceptedCount"], 1)
        self.assertEqual(second["acceptedCount"], 0)
        self.assertEqual(second["rejectedCount"], 1)
        self.assertIn("Duplicate externalId", second["errors"][0]["error"])

    def test_inventory_position_uses_counts_receipts_sales_and_waste(self):
        self._reset_operational_records()
        now = datetime.now(UTC)
        self.service.import_inventory_counts(
            [
                {
                    "productId": 1,
                    "externalId": "count-1",
                    "countedAt": (now - timedelta(hours=6)).isoformat(),
                    "quantity": 10,
                    "location": "main",
                }
            ],
            source_system="counts",
            recompute=False,
        )
        self.service.import_receipts(
            [
                {
                    "productId": 1,
                    "externalId": "receipt-1",
                    "receivedAt": (now - timedelta(hours=5)).isoformat(),
                    "quantity": 4,
                    "reference": "po-1",
                }
            ],
            source_system="erp",
            recompute=False,
        )
        self.service.import_sales(
            [
                {
                    "productId": 1,
                    "externalId": "sale-1",
                    "soldAt": (now - timedelta(hours=4)).isoformat(),
                    "quantity": 3,
                    "unitPrice": 14,
                }
            ],
            source_system="pos",
            recompute=False,
        )
        self.service.import_waste(
            [
                {
                    "productId": 1,
                    "externalId": "waste-1",
                    "occurredAt": (now - timedelta(hours=3)).isoformat(),
                    "quantity": 1,
                    "reason": "prep loss",
                }
            ],
            source_system="waste-log",
            recompute=False,
        )
        snapshot = self.service.recompute_advice_snapshot()
        item = next(product for product in snapshot["products"] if product["productId"] == 1)
        self.assertEqual(item["currentStock"], 10.0)
        self.assertEqual(item["provenance"]["salesSinceCount"], 3.0)
        self.assertEqual(item["provenance"]["receiptsSinceCount"], 4.0)
        self.assertEqual(item["provenance"]["wasteSinceCount"], 1.0)

    def test_missing_supplier_mapping_blocks_product(self):
        updated = self.service.patch_product(1, {"supplierId": None})
        self.assertIsNone(updated["supplierId"])
        snapshot = self.service.get_order_advice()
        item = next(product for product in snapshot["products"] if product["productId"] == 1)
        self.assertIn("missing_supplier_mapping", item["provenance"]["blockingIssues"])
        self.assertTrue(
            any(issue["code"] == "missing_supplier_mapping" for issue in snapshot["blockingIssues"])
        )

    def test_stale_counts_surface_warning_in_snapshot(self):
        self._reset_operational_records()
        old_count_time = datetime.now(UTC) - timedelta(days=6)
        self.service.import_inventory_counts(
            [
                {
                    "productId": 1,
                    "externalId": "old-count-1",
                    "countedAt": old_count_time.isoformat(),
                    "quantity": 8,
                    "location": "main",
                }
            ],
            source_system="counts",
            recompute=False,
        )
        snapshot = self.service.recompute_advice_snapshot()
        item = next(product for product in snapshot["products"] if product["productId"] == 1)
        self.assertEqual(snapshot["dataFreshness"]["inventory"], "stale")
        self.assertIn("stale_stock_count", item["provenance"]["blockingIssues"])

    def test_import_historical_dataset_rebuilds_snapshot_from_single_csv(self):
        csv_payload = """date,product_name,supplier_name,category,unit,cost_price,selling_price,safety_stock,lead_time_days,shelf_life_days,sales_qty,stock_on_hand,receipts_qty,waste_qty
2026-05-01,Chicken Breast,Hanos,Protein,kg,7.8,17.5,10,2,4,6,18,4,1
2026-05-02,Chicken Breast,Hanos,Protein,kg,7.8,17.5,10,2,4,8,15,0,0
2026-05-03,Chicken Breast,Hanos,Protein,kg,7.8,17.5,10,2,4,7,12,0,0
2026-05-01,Tomatoes,Bidfood,Produce,kg,2.2,7.2,10,1,4,9,16,5,1
2026-05-02,Tomatoes,Bidfood,Produce,kg,2.2,7.2,10,1,4,10,12,0,1
2026-05-03,Tomatoes,Bidfood,Produce,kg,2.2,7.2,10,1,4,11,9,0,0
"""
        result = self.service.import_historical_dataset(csv_payload, source_system="csv_fixture")
        self.assertTrue(result["success"])
        self.assertEqual(result["rowsProcessed"], 6)
        self.assertGreaterEqual(result["productsTouched"], 2)
        self.assertIn("products", result["snapshot"])
        chicken = next(item for item in result["snapshot"]["products"] if item["productName"] == "Chicken Breast")
        self.assertGreater(chicken["currentStock"], 0)
        self.assertEqual(result["importResults"]["sales"]["acceptedCount"], 6)


if __name__ == "__main__":
    unittest.main()
