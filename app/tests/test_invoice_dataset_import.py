import unittest
from tempfile import TemporaryDirectory

from app.production_service import ProductionOperationsService


INVOICE_CSV = """source_file,invoice_number,invoice_date,supplier_name,supplier_kvk,supplier_vat,supplier_iban,customer_name,customer_city,debtor_number,article_number,description,quantity,unit_size,total_units,unit_price,discount,line_total,vat_rate,invoice_total_ex_vat,invoice_vat_total,invoice_total_inc_vat,currency
invoice-1.pdf,1001,2026-05-01,Horeca Supplier,,,NL00BANK0000000000,CAFE UIT KIJKEN,Amsterdam,1269,SKU-1,BRIOCHE BROODJE,10,1,10,1.5,,15,9,15,1.35,16.35,EUR
invoice-2.pdf,1002,2026-05-05,Horeca Supplier,,,NL00BANK0000000000,CAFE UIT KIJKEN,Amsterdam,1269,SKU-1,BRIOCHE BROODJE,12,1,12,1.5,,18,9,18,1.62,19.62,EUR
invoice-3.pdf,1003,2026-05-07,Drank Supplier,,,NL00BANK0000000000,CAFE UIT KIJKEN,Amsterdam,1269,SKU-2,COCA COLA KRAT,6,1,6,10,,60,21,60,12.6,72.6,EUR
"""


class InvoiceDatasetImportTests(unittest.TestCase):
    def test_invoice_csv_rebuilds_snapshot_without_seed_catalog(self):
        with TemporaryDirectory() as tmp:
            service = ProductionOperationsService(
                db_url=f"sqlite:///{tmp}/invoice-import.sqlite3"
            )
            result = service.import_historical_dataset(
                INVOICE_CSV,
                source_system="invoice_fixture",
                reset_existing=True,
            )

        self.assertEqual(result["snapshot"]["restaurant"]["name"], "CAFE UIT KIJKEN")
        self.assertEqual(result["snapshot"]["restaurant"]["location"], "Amsterdam")
        self.assertEqual(result["productsTouched"], 2)
        self.assertGreater(result["importResults"]["sales"]["acceptedCount"], 0)
        self.assertGreater(result["importResults"]["receipts"]["acceptedCount"], 0)
        self.assertGreater(result["importResults"]["inventoryCounts"]["acceptedCount"], 0)
        self.assertEqual(result["snapshot"]["summary"]["productsChecked"], 2)

