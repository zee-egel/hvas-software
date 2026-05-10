from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from io import StringIO
import json
from math import ceil
import re
from typing import Any

import pandas as pd
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.engine import Engine
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from data.restaurant_simulation import RESTAURANT_PROFILE
    from order_advice_seed import PRODUCT_CATALOG, generate_initial_inventory, generate_sales_history
    from order_advice_service import (
        build_explanation,
        calculate_financial_impact,
        calculate_forecast,
        calculate_reorder_quantity,
    )
except ImportError:
    from .data.restaurant_simulation import RESTAURANT_PROFILE
    from .order_advice_seed import PRODUCT_CATALOG, generate_initial_inventory, generate_sales_history
    from .order_advice_service import (
        build_explanation,
        calculate_financial_impact,
        calculate_forecast,
        calculate_reorder_quantity,
    )


PURCHASE_ORDER_OPEN_STATUSES = {"DRAFT", "NEEDS_REVIEW"}
PURCHASE_ORDER_STATUSES = {
    "DRAFT",
    "NEEDS_REVIEW",
    "APPROVED",
    "SENT_SIMULATED",
    "REJECTED",
}
IMPORT_TYPES = {"sales", "inventory-counts", "receipts", "waste"}
COUNT_FRESHNESS_DAYS = 3
MIN_SALES_HISTORY_DAYS = 14


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def parse_dt(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def dt_to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    normalized = value if value.tzinfo else value.replace(tzinfo=UTC)
    return normalized.astimezone(UTC).isoformat().replace("+00:00", "Z")


def round_reorder_quantity(unit: str, quantity: float, reorder_multiple: float) -> float:
    if quantity <= 0:
        return 0.0
    rounded = quantity
    if unit in {"pcs", "bottle", "head", "dozen"}:
      rounded = float(ceil(quantity))
    elif unit in {"kg", "ltr"}:
      rounded = round(ceil(quantity * 2) / 2, 1)
    if reorder_multiple > 0:
      rounded = ceil(rounded / reorder_multiple) * reorder_multiple
    return round(rounded, 1 if unit in {"kg", "ltr"} else 0)


def normalize_column_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


class ProductionOperationsService:
    def __init__(self, db_url: str) -> None:
        self.db_url = db_url
        self.engine: Engine = create_engine(db_url, future=True, pool_pre_ping=True)
        self.metadata = MetaData()
        self._define_tables()
        self.metadata.create_all(self.engine)
        self._bootstrap_if_empty()

    def _define_tables(self) -> None:
        self.suppliers = Table(
            "suppliers",
            self.metadata,
            Column("id", Integer, primary_key=True),
            Column("name", String(255), unique=True, nullable=False),
            Column("default_lead_time_days", Integer, nullable=False, default=2),
            Column("active", Boolean, nullable=False, default=True),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        )
        self.products = Table(
            "products",
            self.metadata,
            Column("id", Integer, primary_key=True),
            Column("name", String(255), nullable=False),
            Column("unit", String(50), nullable=False),
            Column("category", String(120), nullable=False),
            Column("supplier_id", Integer, ForeignKey("suppliers.id")),
            Column("cost_price", Float, nullable=False),
            Column("selling_price", Float, nullable=False),
            Column("waste_risk_percentage", Float, nullable=False),
            Column("safety_stock", Float, nullable=False),
            Column("lead_time_days", Integer, nullable=False),
            Column("shelf_life_days", Integer, nullable=False),
            Column("reorder_multiple", Float, nullable=False, default=1.0),
            Column("active", Boolean, nullable=False, default=True),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        )
        self.stock_counts = Table(
            "stock_counts",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("product_id", Integer, ForeignKey("products.id"), nullable=False),
            Column("source_system", String(120), nullable=False),
            Column("external_id", String(255)),
            Column("counted_at", DateTime(timezone=True), nullable=False),
            Column("quantity", Float, nullable=False),
            Column("location", String(255), nullable=False, default="main"),
            Column("created_at", DateTime(timezone=True), nullable=False),
        )
        self.inventory_movements = Table(
            "inventory_movements",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("product_id", Integer, ForeignKey("products.id"), nullable=False),
            Column("movement_type", String(50), nullable=False),
            Column("source_system", String(120), nullable=False),
            Column("external_id", String(255)),
            Column("moved_at", DateTime(timezone=True), nullable=False),
            Column("quantity_delta", Float, nullable=False),
            Column("reference", String(255)),
            Column("created_at", DateTime(timezone=True), nullable=False),
        )
        self.sales_transactions = Table(
            "sales_transactions",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("product_id", Integer, ForeignKey("products.id"), nullable=False),
            Column("source_system", String(120), nullable=False),
            Column("external_id", String(255), nullable=False),
            Column("sold_at", DateTime(timezone=True), nullable=False),
            Column("quantity", Float, nullable=False),
            Column("unit_price", Float),
            Column("created_at", DateTime(timezone=True), nullable=False),
        )
        self.waste_events = Table(
            "waste_events",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("product_id", Integer, ForeignKey("products.id"), nullable=False),
            Column("source_system", String(120), nullable=False),
            Column("external_id", String(255), nullable=False),
            Column("occurred_at", DateTime(timezone=True), nullable=False),
            Column("quantity", Float, nullable=False),
            Column("reason", String(255)),
            Column("created_at", DateTime(timezone=True), nullable=False),
        )
        self.purchase_orders = Table(
            "purchase_orders",
            self.metadata,
            Column("id", String(255), primary_key=True),
            Column("supplier_id", Integer, ForeignKey("suppliers.id")),
            Column("status", String(50), nullable=False),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
            Column("expected_delivery_date", DateTime(timezone=True), nullable=False),
            Column("total_amount", Float, nullable=False),
            Column("total_protected_revenue", Float, nullable=False),
            Column("total_prevented_waste", Float, nullable=False),
            Column("blocked_reason", String(255)),
            Column("snapshot_run_id", Integer),
        )
        self.purchase_order_lines = Table(
            "purchase_order_lines",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("purchase_order_id", String(255), ForeignKey("purchase_orders.id"), nullable=False),
            Column("product_id", Integer, ForeignKey("products.id"), nullable=False),
            Column("quantity", Float, nullable=False),
            Column("unit_cost", Float, nullable=False),
            Column("total_cost", Float, nullable=False),
            Column("reason", Text, nullable=False),
            Column("impact", Float, nullable=False),
            Column("urgency", String(50), nullable=False),
            Column("linked_advice_id", String(255)),
        )
        self.import_jobs = Table(
            "import_jobs",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("import_type", String(50), nullable=False),
            Column("source_system", String(120), nullable=False),
            Column("status", String(50), nullable=False),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("completed_at", DateTime(timezone=True)),
            Column("record_count", Integer, nullable=False, default=0),
            Column("accepted_count", Integer, nullable=False, default=0),
            Column("rejected_count", Integer, nullable=False, default=0),
            Column("error_summary_json", Text, nullable=False, default="[]"),
        )
        self.advice_runs = Table(
            "advice_runs",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("status", String(50), nullable=False),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("data_freshness_json", Text, nullable=False),
            Column("data_completeness_json", Text, nullable=False),
            Column("source_timestamps_json", Text, nullable=False),
            Column("blocking_issues_json", Text, nullable=False),
            Column("snapshot_json", Text, nullable=False),
        )
        self.users = Table(
            "users",
            self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("full_name", String(255), nullable=False),
            Column("email", String(255), unique=True, nullable=False),
            Column("company_name", String(255), nullable=False),
            Column("password_hash", Text, nullable=False),
            Column("role", String(120), nullable=False, default="operator"),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        )

    def _bootstrap_if_empty(self) -> None:
        with self.engine.begin() as conn:
            has_products = conn.execute(select(func.count()).select_from(self.products)).scalar_one()
        if has_products:
            return
        self._seed_catalog()
        self._seed_bootstrap_imports()
        self.recompute_advice_snapshot()

    def _seed_catalog(self) -> None:
        now = parse_dt(utc_timestamp())
        suppliers_by_name: dict[str, int] = {}
        with self.engine.begin() as conn:
            supplier_names = sorted({product["supplierName"] for product in PRODUCT_CATALOG})
            for name in supplier_names:
                lead_times = [product["leadTimeDays"] for product in PRODUCT_CATALOG if product["supplierName"] == name]
                result = conn.execute(
                    insert(self.suppliers).values(
                        name=name,
                        default_lead_time_days=round(sum(lead_times) / len(lead_times)),
                        active=True,
                        created_at=now,
                        updated_at=now,
                    )
                )
                suppliers_by_name[name] = int(result.inserted_primary_key[0])
            for product in PRODUCT_CATALOG:
                conn.execute(
                    insert(self.products).values(
                        id=product["id"],
                        name=product["name"],
                        unit=product["unit"],
                        category=product["category"],
                        supplier_id=suppliers_by_name[product["supplierName"]],
                        cost_price=product["costPrice"],
                        selling_price=product["sellingPrice"],
                        waste_risk_percentage=product["wasteRiskPercentage"],
                        safety_stock=float(product["safetyStock"]),
                        lead_time_days=int(product["leadTimeDays"]),
                        shelf_life_days=int(product["shelfLifeDays"]),
                        reorder_multiple=float(product.get("reorderMultiple", 1.0)),
                        active=True,
                        created_at=now,
                        updated_at=now,
                    )
                )

    def _seed_bootstrap_imports(self) -> None:
        now = datetime.now(UTC)
        counts = []
        for item in generate_initial_inventory():
            counts.append(
                {
                    "productId": item["productId"],
                    "externalId": f"bootstrap-count-{item['productId']}",
                    "countedAt": (now - timedelta(days=1)).isoformat(),
                    "quantity": item["currentStock"],
                    "location": "main",
                }
            )
        sales = []
        for sale in generate_sales_history(weeks=12):
            product = next(product for product in PRODUCT_CATALOG if product["id"] == sale["productId"])
            sold_at = datetime.fromisoformat(sale["date"]).replace(tzinfo=UTC) + timedelta(hours=12)
            sales.append(
                {
                    "productId": sale["productId"],
                    "externalId": f"bootstrap-sale-{sale['productId']}-{sale['date']}",
                    "soldAt": sold_at.isoformat(),
                    "quantity": sale["quantitySold"],
                    "unitPrice": product["sellingPrice"],
                }
            )
        receipts = []
        waste = []
        for product in PRODUCT_CATALOG:
            receipts.append(
                {
                    "productId": product["id"],
                    "externalId": f"bootstrap-receipt-{product['id']}",
                    "receivedAt": (now - timedelta(days=max(1, product["leadTimeDays"] + 1))).isoformat(),
                    "quantity": max(product["safetyStock"] * 0.3, 1),
                    "reference": "bootstrap receipt",
                }
            )
            waste.append(
                {
                    "productId": product["id"],
                    "externalId": f"bootstrap-waste-{product['id']}",
                    "occurredAt": (now - timedelta(hours=18)).isoformat(),
                    "quantity": round(max(0.0, product["wasteRiskPercentage"] / 1000), 2),
                    "reason": "bootstrap spoilage",
                }
            )
        self.import_inventory_counts(counts, source_system="bootstrap_seed", recompute=False)
        self.import_sales(sales, source_system="bootstrap_seed", recompute=False)
        self.import_receipts(receipts, source_system="bootstrap_seed", recompute=False)
        self.import_waste(waste, source_system="bootstrap_seed", recompute=False)

    def get_health(self) -> dict[str, Any]:
        latest_run = self._latest_advice_run()
        latest_import = self._latest_import_status()
        product_count = len(self._fetch_product_rows())
        return {
            "status": "ok",
            "service": "production-order-advice",
            "generatedAt": utc_timestamp(),
            "dbConnected": True,
            "mode": "production",
            "productsTracked": product_count,
            "latestAdviceRunAt": dt_to_iso(latest_run["created_at"]) if latest_run else None,
            "latestImportCompletedAt": dt_to_iso(latest_import["completed_at"]) if latest_import else None,
            "importPipeline": {
                "status": latest_import["status"] if latest_import else "idle",
                "latestJobId": latest_import["id"] if latest_import else None,
                "latestImportType": latest_import["import_type"] if latest_import else None,
            },
        }

    def create_user(
        self,
        full_name: str,
        email: str,
        company_name: str,
        password: str,
    ) -> dict[str, Any]:
        normalized_email = email.strip().lower()
        if "@" not in normalized_email:
            raise ValueError("Enter a valid work email address.")
        if len(password) < 8:
            raise ValueError("Password must contain at least 8 characters.")
        if not full_name.strip():
            raise ValueError("Full name is required.")
        if not company_name.strip():
            raise ValueError("Company name is required.")

        with self.engine.begin() as conn:
            existing = conn.execute(
                select(self.users).where(func.lower(self.users.c.email) == normalized_email)
            ).mappings().first()
            if existing is not None:
                raise ValueError("An account already exists for that email address.")
            now = parse_dt(utc_timestamp())
            result = conn.execute(
                insert(self.users).values(
                    full_name=full_name.strip(),
                    email=normalized_email,
                    company_name=company_name.strip(),
                    password_hash=generate_password_hash(password),
                    role="admin",
                    created_at=now,
                    updated_at=now,
                )
            )
            user_id = int(result.inserted_primary_key[0])
        return self.get_user_by_id(user_id)

    def authenticate_user(self, email: str, password: str) -> dict[str, Any]:
        normalized_email = email.strip().lower()
        with self.engine.begin() as conn:
            user = conn.execute(
                select(self.users).where(func.lower(self.users.c.email) == normalized_email)
            ).mappings().first()
        if user is None or not check_password_hash(user["password_hash"], password):
            raise ValueError("Invalid email or password.")
        return self._serialize_user(user)

    def get_user_by_id(self, user_id: int) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            user = conn.execute(
                select(self.users).where(self.users.c.id == user_id)
            ).mappings().first()
        if user is None:
            return None
        return self._serialize_user(user)

    def get_restaurant(self) -> dict[str, Any]:
        inventory = self._current_inventory_snapshot()
        return {
            "restaurant": RESTAURANT_PROFILE,
            "generatedAt": utc_timestamp(),
            "inventory": inventory,
            "suppliers": sorted({item["supplierName"] for item in inventory}),
            "contextOutlook": [],
            "metadata": {
                "mode": "production",
                "source": "db-backed operational records",
            },
        }

    def get_purchase_orders(self) -> dict[str, Any]:
        snapshot = self.get_order_advice()
        return {
            "restaurant": snapshot["restaurant"],
            "generatedAt": snapshot["generatedAt"],
            "active": snapshot["purchaseOrders"]["active"],
            "history": snapshot["purchaseOrders"]["history"],
        }

    def get_order_advice(self) -> dict[str, Any]:
        latest_run = self._latest_advice_run()
        if latest_run is None:
            return self.recompute_advice_snapshot()
        snapshot = json.loads(latest_run["snapshot_json"])
        snapshot["sourceTimestamps"]["lastAdviceRunAt"] = dt_to_iso(latest_run["created_at"])
        return snapshot

    def approve_purchase_order(self, purchase_order_id: str) -> dict[str, Any]:
        return self._set_purchase_order_status(purchase_order_id, "SENT_SIMULATED")

    def reject_purchase_order(self, purchase_order_id: str) -> dict[str, Any]:
        return self._set_purchase_order_status(purchase_order_id, "REJECTED")

    def _set_purchase_order_status(self, purchase_order_id: str, status: str) -> dict[str, Any]:
        if status not in PURCHASE_ORDER_STATUSES:
            raise ValueError(f"Unsupported purchase order status {status}")
        now = parse_dt(utc_timestamp())
        with self.engine.begin() as conn:
            existing = conn.execute(
                select(self.purchase_orders).where(self.purchase_orders.c.id == purchase_order_id)
            ).mappings().first()
            if existing is None:
                raise ValueError(f"Unknown purchase order {purchase_order_id}")
            conn.execute(
                update(self.purchase_orders)
                .where(self.purchase_orders.c.id == purchase_order_id)
                .values(status=status, updated_at=now)
            )
        return self.recompute_advice_snapshot()

    def update_inventory(self, updates: list[dict[str, Any]]) -> dict[str, float]:
        now = datetime.now(UTC)
        items = []
        for item in updates:
            items.append(
                {
                    "productId": int(item["productId"]),
                    "externalId": f"manual-count-{item['productId']}-{int(now.timestamp())}",
                    "countedAt": now.isoformat(),
                    "quantity": float(item["currentStock"]),
                    "location": "main",
                }
            )
        result = self.import_inventory_counts(items, source_system="manual_ui", recompute=True)
        updated = {str(item["productId"]): float(item["quantity"]) for item in items}
        return {"updated": updated, "result": result}

    def import_sales(
        self,
        items: list[dict[str, Any]],
        source_system: str = "manual",
        recompute: bool = True,
    ) -> dict[str, Any]:
        return self._run_import_job("sales", items, source_system, self._insert_sales_rows, recompute)

    def import_inventory_counts(
        self,
        items: list[dict[str, Any]],
        source_system: str = "manual",
        recompute: bool = True,
    ) -> dict[str, Any]:
        return self._run_import_job("inventory-counts", items, source_system, self._insert_count_rows, recompute)

    def import_receipts(
        self,
        items: list[dict[str, Any]],
        source_system: str = "manual",
        recompute: bool = True,
    ) -> dict[str, Any]:
        return self._run_import_job("receipts", items, source_system, self._insert_receipt_rows, recompute)

    def import_waste(
        self,
        items: list[dict[str, Any]],
        source_system: str = "manual",
        recompute: bool = True,
    ) -> dict[str, Any]:
        return self._run_import_job("waste", items, source_system, self._insert_waste_rows, recompute)

    def get_import_status(self) -> dict[str, Any]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(self.import_jobs).order_by(self.import_jobs.c.created_at.desc()).limit(20)
            ).mappings().all()
        latest = self._latest_advice_run()
        return {
            "jobs": [
                {
                    "id": row["id"],
                    "importType": row["import_type"],
                    "sourceSystem": row["source_system"],
                    "status": row["status"],
                    "createdAt": dt_to_iso(row["created_at"]),
                    "completedAt": dt_to_iso(row["completed_at"]),
                    "recordCount": row["record_count"],
                    "acceptedCount": row["accepted_count"],
                    "rejectedCount": row["rejected_count"],
                    "errors": json.loads(row["error_summary_json"]),
                }
                for row in rows
            ],
            "latestAdviceRunAt": dt_to_iso(latest["created_at"]) if latest else None,
        }

    def import_historical_dataset(
        self,
        csv_payload: str,
        source_system: str = "historical_dataset",
        reset_existing: bool = True,
    ) -> dict[str, Any]:
        if not csv_payload.strip():
            raise ValueError("Historical dataset CSV is empty.")

        try:
            frame = pd.read_csv(StringIO(csv_payload))
        except Exception as err:  # pragma: no cover - pandas raises multiple parser errors
            raise ValueError(f"Could not parse historical dataset CSV: {err}") from err

        frame.columns = [normalize_column_name(str(column)) for column in frame.columns]
        required_any = {"product_id", "product_name"}
        missing = []
        if "date" not in frame.columns:
            missing.append("date")
        if not required_any.intersection(frame.columns):
            missing.append("product_id or product_name")
        if "sales_qty" not in frame.columns:
            missing.append("sales_qty")
        if missing:
            raise ValueError(
                "Historical dataset is missing required columns: " + ", ".join(missing)
            )

        frame = frame.where(pd.notnull(frame), None)
        if reset_existing:
            self._reset_operational_history()

        sales_items: list[dict[str, Any]] = []
        count_items: list[dict[str, Any]] = []
        receipt_items: list[dict[str, Any]] = []
        waste_items: list[dict[str, Any]] = []
        product_ids: set[int] = set()

        for row in frame.to_dict(orient="records"):
            product_id = self._resolve_or_create_dataset_product(row)
            product_ids.add(product_id)
            row_date = parse_dt(str(row["date"]))
            date_slug = row_date.date().isoformat()

            sales_qty = self._float_value(row.get("sales_qty"))
            if sales_qty > 0:
                sales_items.append(
                    {
                        "productId": product_id,
                        "externalId": f"{source_system}-sale-{product_id}-{date_slug}",
                        "soldAt": row_date.replace(hour=12, minute=0, second=0, microsecond=0).isoformat(),
                        "quantity": sales_qty,
                        "unitPrice": self._float_value(row.get("selling_price")),
                    }
                )

            stock_on_hand = row.get("stock_on_hand")
            if stock_on_hand is not None and str(stock_on_hand).strip() != "":
                count_items.append(
                    {
                        "productId": product_id,
                        "externalId": f"{source_system}-count-{product_id}-{date_slug}",
                        "countedAt": row_date.replace(hour=23, minute=0, second=0, microsecond=0).isoformat(),
                        "quantity": self._float_value(stock_on_hand),
                        "location": str(row.get("location") or "main"),
                    }
                )

            receipts_qty = self._float_value(row.get("receipts_qty"))
            if receipts_qty > 0:
                receipt_items.append(
                    {
                        "productId": product_id,
                        "externalId": f"{source_system}-receipt-{product_id}-{date_slug}",
                        "receivedAt": row_date.replace(hour=8, minute=0, second=0, microsecond=0).isoformat(),
                        "quantity": receipts_qty,
                        "reference": str(row.get("receipt_reference") or "historical dataset"),
                    }
                )

            waste_qty = self._float_value(row.get("waste_qty"))
            if waste_qty > 0:
                waste_items.append(
                    {
                        "productId": product_id,
                        "externalId": f"{source_system}-waste-{product_id}-{date_slug}",
                        "occurredAt": row_date.replace(hour=21, minute=0, second=0, microsecond=0).isoformat(),
                        "quantity": waste_qty,
                        "reason": str(row.get("waste_reason") or "historical dataset"),
                    }
                )

        import_results = {
            "sales": self.import_sales(sales_items, source_system=source_system, recompute=False) if sales_items else None,
            "inventoryCounts": self.import_inventory_counts(count_items, source_system=source_system, recompute=False) if count_items else None,
            "receipts": self.import_receipts(receipt_items, source_system=source_system, recompute=False) if receipt_items else None,
            "waste": self.import_waste(waste_items, source_system=source_system, recompute=False) if waste_items else None,
        }
        snapshot = self.recompute_advice_snapshot()
        return {
            "success": True,
            "sourceSystem": source_system,
            "rowsProcessed": len(frame.index),
            "productsTouched": len(product_ids),
            "importResults": import_results,
            "snapshot": snapshot,
        }

    def get_config_products(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(
                    self.products.c.id,
                    self.products.c.name,
                    self.products.c.unit,
                    self.products.c.category,
                    self.products.c.cost_price,
                    self.products.c.selling_price,
                    self.products.c.waste_risk_percentage,
                    self.products.c.safety_stock,
                    self.products.c.lead_time_days,
                    self.products.c.shelf_life_days,
                    self.products.c.reorder_multiple,
                    self.products.c.active,
                    self.suppliers.c.id.label("supplier_id"),
                    self.suppliers.c.name.label("supplier_name"),
                )
                .select_from(self.products.outerjoin(self.suppliers, self.products.c.supplier_id == self.suppliers.c.id))
                .order_by(self.products.c.name)
            ).mappings().all()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "unit": row["unit"],
                "category": row["category"],
                "costPrice": row["cost_price"],
                "sellingPrice": row["selling_price"],
                "wasteRiskPercentage": row["waste_risk_percentage"],
                "safetyStock": row["safety_stock"],
                "leadTimeDays": row["lead_time_days"],
                "shelfLifeDays": row["shelf_life_days"],
                "reorderMultiple": row["reorder_multiple"],
                "active": row["active"],
                "supplierId": row["supplier_id"],
                "supplierName": row["supplier_name"],
            }
            for row in rows
        ]

    def patch_product(self, product_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        allowed_fields = {
            "name": "name",
            "unit": "unit",
            "category": "category",
            "costPrice": "cost_price",
            "sellingPrice": "selling_price",
            "wasteRiskPercentage": "waste_risk_percentage",
            "safetyStock": "safety_stock",
            "leadTimeDays": "lead_time_days",
            "shelfLifeDays": "shelf_life_days",
            "reorderMultiple": "reorder_multiple",
            "active": "active",
            "supplierId": "supplier_id",
        }
        updates: dict[str, Any] = {}
        for key, column in allowed_fields.items():
            if key in payload:
                updates[column] = payload[key]
        if not updates:
            raise ValueError("No supported product fields to update.")
        updates["updated_at"] = parse_dt(utc_timestamp())
        with self.engine.begin() as conn:
            conn.execute(
                update(self.products)
                .where(self.products.c.id == product_id)
                .values(**updates)
            )
        self.recompute_advice_snapshot()
        return next(item for item in self.get_config_products() if item["id"] == product_id)

    def get_config_suppliers(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(self.suppliers).order_by(self.suppliers.c.name)
            ).mappings().all()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "defaultLeadTimeDays": row["default_lead_time_days"],
                "active": row["active"],
            }
            for row in rows
        ]

    def patch_supplier(self, supplier_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        allowed_fields = {
            "name": "name",
            "defaultLeadTimeDays": "default_lead_time_days",
            "active": "active",
        }
        updates: dict[str, Any] = {}
        for key, column in allowed_fields.items():
            if key in payload:
                updates[column] = payload[key]
        if not updates:
            raise ValueError("No supported supplier fields to update.")
        updates["updated_at"] = parse_dt(utc_timestamp())
        with self.engine.begin() as conn:
            conn.execute(
                update(self.suppliers)
                .where(self.suppliers.c.id == supplier_id)
                .values(**updates)
            )
        self.recompute_advice_snapshot()
        return next(item for item in self.get_config_suppliers() if item["id"] == supplier_id)

    def recompute_advice_snapshot(self) -> dict[str, Any]:
        product_rows = self._fetch_product_rows()
        inventory_state = self._calculate_inventory_positions(product_rows)
        snapshot = self._build_snapshot(product_rows, inventory_state)
        freshness = snapshot["dataFreshness"]
        completeness = snapshot["dataCompleteness"]
        timestamps = snapshot["sourceTimestamps"]
        blocking_issues = snapshot["blockingIssues"]
        now = parse_dt(utc_timestamp())
        with self.engine.begin() as conn:
            result = conn.execute(
                insert(self.advice_runs).values(
                    status="completed",
                    created_at=now,
                    data_freshness_json=json.dumps(freshness),
                    data_completeness_json=json.dumps(completeness),
                    source_timestamps_json=json.dumps(timestamps),
                    blocking_issues_json=json.dumps(blocking_issues),
                    snapshot_json=json.dumps(snapshot),
                )
            )
            run_id = int(result.inserted_primary_key[0])
        self._sync_purchase_orders(snapshot["products"], run_id)
        refreshed = self._latest_advice_run()
        output = json.loads(refreshed["snapshot_json"])
        output["sourceTimestamps"]["lastAdviceRunAt"] = dt_to_iso(refreshed["created_at"])
        return output

    def _run_import_job(
        self,
        import_type: str,
        items: list[dict[str, Any]],
        source_system: str,
        handler: Any,
        recompute: bool,
    ) -> dict[str, Any]:
        if import_type not in IMPORT_TYPES:
            raise ValueError(f"Unsupported import type {import_type}")
        if not isinstance(items, list) or not items:
            raise ValueError(f"{import_type} import requires a non-empty items array.")
        now = parse_dt(utc_timestamp())
        with self.engine.begin() as conn:
            job_result = conn.execute(
                insert(self.import_jobs).values(
                    import_type=import_type,
                    source_system=source_system,
                    status="processing",
                    created_at=now,
                    record_count=len(items),
                    accepted_count=0,
                    rejected_count=0,
                    error_summary_json="[]",
                )
            )
            job_id = int(job_result.inserted_primary_key[0])

        accepted, rejected = handler(items, source_system)
        status = "completed" if not rejected else "completed_with_errors"
        completed_at = parse_dt(utc_timestamp())
        with self.engine.begin() as conn:
            conn.execute(
                update(self.import_jobs)
                .where(self.import_jobs.c.id == job_id)
                .values(
                    status=status,
                    completed_at=completed_at,
                    accepted_count=accepted,
                    rejected_count=len(rejected),
                    error_summary_json=json.dumps(rejected),
                )
            )
        if recompute:
            self.recompute_advice_snapshot()
        return {
            "jobId": job_id,
            "status": status,
            "recordCount": len(items),
            "acceptedCount": accepted,
            "rejectedCount": len(rejected),
            "errors": rejected,
        }

    def _reset_operational_history(self) -> None:
        with self.engine.begin() as conn:
            conn.execute(delete(self.purchase_order_lines))
            conn.execute(delete(self.purchase_orders))
            conn.execute(delete(self.advice_runs))
            conn.execute(delete(self.import_jobs))
            conn.execute(delete(self.sales_transactions))
            conn.execute(delete(self.inventory_movements))
            conn.execute(delete(self.waste_events))
            conn.execute(delete(self.stock_counts))

    def _float_value(self, value: Any, default: float = 0.0) -> float:
        if value is None or value == "":
            return default
        return float(value)

    def _int_value(self, value: Any, default: int) -> int:
        if value is None or value == "":
            return default
        return int(float(value))

    def _resolve_or_create_dataset_product(self, row: dict[str, Any]) -> int:
        product_id = row.get("product_id")
        product_name = (row.get("product_name") or "").strip()

        with self.engine.begin() as conn:
            existing = None
            if product_id not in (None, ""):
                existing = conn.execute(
                    select(self.products).where(self.products.c.id == int(float(product_id)))
                ).mappings().first()
            if existing is None and product_name:
                existing = conn.execute(
                    select(self.products).where(func.lower(self.products.c.name) == product_name.lower())
                ).mappings().first()

            existing_supplier_name = ""
            if existing is not None and existing["supplier_id"] is not None:
                supplier_row = conn.execute(
                    select(self.suppliers.c.name).where(self.suppliers.c.id == existing["supplier_id"])
                ).first()
                existing_supplier_name = supplier_row[0] if supplier_row else ""
            supplier_name = str(
                row.get("supplier_name")
                or row.get("supplier")
                or existing_supplier_name
                or "Dataset Supplier"
            ).strip()
            supplier_id = self._resolve_or_create_supplier(supplier_name, conn, row)
            now = parse_dt(utc_timestamp())

            values = {
                "name": product_name or (existing["name"] if existing else f"Dataset Product {product_id}"),
                "unit": str(row.get("unit") or (existing["unit"] if existing else "pcs")),
                "category": str(row.get("category") or (existing["category"] if existing else "Dataset")),
                "supplier_id": supplier_id,
                "cost_price": self._float_value(row.get("cost_price"), float(existing["cost_price"]) if existing else 1.0),
                "selling_price": self._float_value(row.get("selling_price"), float(existing["selling_price"]) if existing else 3.0),
                "waste_risk_percentage": self._float_value(row.get("waste_risk_percentage"), float(existing["waste_risk_percentage"]) if existing else 12.0),
                "safety_stock": self._float_value(row.get("safety_stock"), float(existing["safety_stock"]) if existing else max(1.0, self._float_value(row.get("stock_on_hand"), 0.0) * 0.2)),
                "lead_time_days": self._int_value(row.get("lead_time_days"), int(existing["lead_time_days"]) if existing else 2),
                "shelf_life_days": self._int_value(row.get("shelf_life_days"), int(existing["shelf_life_days"]) if existing else 7),
                "reorder_multiple": self._float_value(row.get("reorder_multiple"), float(existing["reorder_multiple"]) if existing else 1.0),
                "active": True,
                "updated_at": now,
            }

            if existing is not None:
                conn.execute(
                    update(self.products)
                    .where(self.products.c.id == existing["id"])
                    .values(**values)
                )
                return int(existing["id"])

            next_id = (
                int(float(product_id))
                if product_id not in (None, "")
                else int(
                    conn.execute(select(func.coalesce(func.max(self.products.c.id), 0))).scalar_one()
                )
                + 1
            )
            conn.execute(
                insert(self.products).values(
                    id=next_id,
                    created_at=now,
                    **values,
                )
            )
            return next_id

    def _resolve_or_create_supplier(self, supplier_name: str, conn: Any, row: dict[str, Any]) -> int:
        existing = conn.execute(
            select(self.suppliers).where(func.lower(self.suppliers.c.name) == supplier_name.lower())
        ).mappings().first()
        if existing is not None:
            return int(existing["id"])
        now = parse_dt(utc_timestamp())
        result = conn.execute(
            insert(self.suppliers).values(
                name=supplier_name,
                default_lead_time_days=self._int_value(row.get("lead_time_days"), 2),
                active=True,
                created_at=now,
                updated_at=now,
            )
        )
        return int(result.inserted_primary_key[0])

    def _insert_sales_rows(self, items: list[dict[str, Any]], source_system: str) -> tuple[int, list[dict[str, Any]]]:
        accepted = 0
        rejected: list[dict[str, Any]] = []
        now = parse_dt(utc_timestamp())
        existing = self._existing_external_ids(self.sales_transactions, source_system)
        product_ids = set(self._product_id_map().keys())
        rows = []
        for item in items:
            try:
                product_id = int(item["productId"])
                external_id = str(item["externalId"])
                if product_id not in product_ids:
                    raise ValueError("Unknown productId")
                if external_id in existing:
                    raise ValueError("Duplicate externalId")
                rows.append(
                    {
                        "product_id": product_id,
                        "source_system": source_system,
                        "external_id": external_id,
                        "sold_at": parse_dt(item["soldAt"]),
                        "quantity": float(item["quantity"]),
                        "unit_price": float(item.get("unitPrice", 0.0)),
                        "created_at": now,
                    }
                )
                existing.add(external_id)
                accepted += 1
            except (KeyError, TypeError, ValueError) as err:
                rejected.append({"item": item, "error": str(err)})
        if rows:
            with self.engine.begin() as conn:
                conn.execute(insert(self.sales_transactions), rows)
        return accepted, rejected

    def _insert_count_rows(self, items: list[dict[str, Any]], source_system: str) -> tuple[int, list[dict[str, Any]]]:
        accepted = 0
        rejected: list[dict[str, Any]] = []
        now = parse_dt(utc_timestamp())
        existing = self._existing_external_ids(self.stock_counts, source_system)
        product_ids = set(self._product_id_map().keys())
        rows = []
        for item in items:
            try:
                product_id = int(item["productId"])
                external_id = str(item["externalId"])
                if product_id not in product_ids:
                    raise ValueError("Unknown productId")
                if external_id in existing:
                    raise ValueError("Duplicate externalId")
                rows.append(
                    {
                        "product_id": product_id,
                        "source_system": source_system,
                        "external_id": external_id,
                        "counted_at": parse_dt(item["countedAt"]),
                        "quantity": float(item["quantity"]),
                        "location": str(item.get("location", "main")),
                        "created_at": now,
                    }
                )
                existing.add(external_id)
                accepted += 1
            except (KeyError, TypeError, ValueError) as err:
                rejected.append({"item": item, "error": str(err)})
        if rows:
            with self.engine.begin() as conn:
                conn.execute(insert(self.stock_counts), rows)
        return accepted, rejected

    def _insert_receipt_rows(self, items: list[dict[str, Any]], source_system: str) -> tuple[int, list[dict[str, Any]]]:
        accepted = 0
        rejected: list[dict[str, Any]] = []
        now = parse_dt(utc_timestamp())
        existing = self._existing_external_ids(self.inventory_movements, source_system)
        product_ids = set(self._product_id_map().keys())
        rows = []
        for item in items:
            try:
                product_id = int(item["productId"])
                external_id = str(item["externalId"])
                if product_id not in product_ids:
                    raise ValueError("Unknown productId")
                if external_id in existing:
                    raise ValueError("Duplicate externalId")
                rows.append(
                    {
                        "product_id": product_id,
                        "movement_type": "RECEIPT",
                        "source_system": source_system,
                        "external_id": external_id,
                        "moved_at": parse_dt(item["receivedAt"]),
                        "quantity_delta": float(item["quantity"]),
                        "reference": str(item.get("reference", "receipt")),
                        "created_at": now,
                    }
                )
                existing.add(external_id)
                accepted += 1
            except (KeyError, TypeError, ValueError) as err:
                rejected.append({"item": item, "error": str(err)})
        if rows:
            with self.engine.begin() as conn:
                conn.execute(insert(self.inventory_movements), rows)
        return accepted, rejected

    def _insert_waste_rows(self, items: list[dict[str, Any]], source_system: str) -> tuple[int, list[dict[str, Any]]]:
        accepted = 0
        rejected: list[dict[str, Any]] = []
        now = parse_dt(utc_timestamp())
        existing = self._existing_external_ids(self.waste_events, source_system)
        product_ids = set(self._product_id_map().keys())
        rows = []
        for item in items:
            try:
                product_id = int(item["productId"])
                external_id = str(item["externalId"])
                if product_id not in product_ids:
                    raise ValueError("Unknown productId")
                if external_id in existing:
                    raise ValueError("Duplicate externalId")
                rows.append(
                    {
                        "product_id": product_id,
                        "source_system": source_system,
                        "external_id": external_id,
                        "occurred_at": parse_dt(item["occurredAt"]),
                        "quantity": float(item["quantity"]),
                        "reason": str(item.get("reason", "waste")),
                        "created_at": now,
                    }
                )
                existing.add(external_id)
                accepted += 1
            except (KeyError, TypeError, ValueError) as err:
                rejected.append({"item": item, "error": str(err)})
        if rows:
            with self.engine.begin() as conn:
                conn.execute(insert(self.waste_events), rows)
        return accepted, rejected

    def _existing_external_ids(self, table: Table, source_system: str) -> set[str]:
        if "external_id" not in table.c:
            return set()
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(table.c.external_id).where(table.c.source_system == source_system)
            ).scalars().all()
        return {row for row in rows if row}

    def _product_id_map(self) -> dict[int, dict[str, Any]]:
        return {row["id"]: row for row in self._fetch_product_rows()}

    def _fetch_product_rows(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(
                    self.products.c.id,
                    self.products.c.name,
                    self.products.c.unit,
                    self.products.c.category,
                    self.products.c.cost_price,
                    self.products.c.selling_price,
                    self.products.c.waste_risk_percentage,
                    self.products.c.safety_stock,
                    self.products.c.lead_time_days,
                    self.products.c.shelf_life_days,
                    self.products.c.reorder_multiple,
                    self.products.c.active,
                    self.suppliers.c.id.label("supplier_id"),
                    self.suppliers.c.name.label("supplier_name"),
                    self.suppliers.c.default_lead_time_days.label("supplier_lead_time_days"),
                    self.suppliers.c.active.label("supplier_active"),
                )
                .select_from(self.products.outerjoin(self.suppliers, self.products.c.supplier_id == self.suppliers.c.id))
                .where(self.products.c.active.is_(True))
                .order_by(self.products.c.id)
            ).mappings().all()
        return [dict(row) for row in rows]

    def _calculate_inventory_positions(self, product_rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
        states: dict[int, dict[str, Any]] = {}
        with self.engine.begin() as conn:
            for product in product_rows:
                latest_count = conn.execute(
                    select(self.stock_counts)
                    .where(self.stock_counts.c.product_id == product["id"])
                    .order_by(self.stock_counts.c.counted_at.desc(), self.stock_counts.c.id.desc())
                    .limit(1)
                ).mappings().first()
                if latest_count is None:
                    states[product["id"]] = {
                        "currentStock": 0.0,
                        "countTimestamp": None,
                        "salesSinceCount": 0.0,
                        "receiptsSinceCount": 0.0,
                        "wasteSinceCount": 0.0,
                        "blocked": ["missing_stock_count"],
                    }
                    continue
                count_time = parse_dt(latest_count["counted_at"])
                sales_qty = conn.execute(
                    select(func.coalesce(func.sum(self.sales_transactions.c.quantity), 0.0))
                    .where(self.sales_transactions.c.product_id == product["id"])
                    .where(self.sales_transactions.c.sold_at >= count_time)
                ).scalar_one()
                receipt_qty = conn.execute(
                    select(func.coalesce(func.sum(self.inventory_movements.c.quantity_delta), 0.0))
                    .where(self.inventory_movements.c.product_id == product["id"])
                    .where(self.inventory_movements.c.movement_type == "RECEIPT")
                    .where(self.inventory_movements.c.moved_at >= count_time)
                ).scalar_one()
                waste_qty = conn.execute(
                    select(func.coalesce(func.sum(self.waste_events.c.quantity), 0.0))
                    .where(self.waste_events.c.product_id == product["id"])
                    .where(self.waste_events.c.occurred_at >= count_time)
                ).scalar_one()
                current_stock = round(max(0.0, latest_count["quantity"] + receipt_qty - sales_qty - waste_qty), 1)
                blocked = []
                if count_time < datetime.now(UTC) - timedelta(days=COUNT_FRESHNESS_DAYS):
                    blocked.append("stale_stock_count")
                states[product["id"]] = {
                    "currentStock": current_stock,
                    "countTimestamp": count_time,
                    "salesSinceCount": float(sales_qty),
                    "receiptsSinceCount": float(receipt_qty),
                    "wasteSinceCount": float(waste_qty),
                    "blocked": blocked,
                }
        return states

    def _sales_history_for_product(self, product_id: int) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(
                    func.date(self.sales_transactions.c.sold_at).label("sales_date"),
                    func.sum(self.sales_transactions.c.quantity).label("quantity_sold"),
                )
                .where(self.sales_transactions.c.product_id == product_id)
                .group_by(func.date(self.sales_transactions.c.sold_at))
                .order_by(func.date(self.sales_transactions.c.sold_at))
            ).mappings().all()
        return [
            {
                "productId": product_id,
                "date": str(row["sales_date"]),
                "quantitySold": float(row["quantity_sold"]),
            }
            for row in rows
        ]

    def _build_snapshot(
        self,
        product_rows: list[dict[str, Any]],
        inventory_state: dict[int, dict[str, Any]],
    ) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        blocking_issues: list[dict[str, Any]] = []
        latest_sales_at = self._latest_timestamp(self.sales_transactions.c.sold_at, self.sales_transactions)
        latest_count_at = self._latest_timestamp(self.stock_counts.c.counted_at, self.stock_counts)
        latest_waste_at = self._latest_timestamp(self.waste_events.c.occurred_at, self.waste_events)

        for product in product_rows:
            state = inventory_state[product["id"]]
            sales_history = self._sales_history_for_product(product["id"])
            horizon_days = max(7, product["lead_time_days"] + 2)
            if sales_history:
                forecast = calculate_forecast(
                    {
                        "leadTimeDays": product["lead_time_days"],
                        "safetyStock": product["safety_stock"],
                        "unit": product["unit"],
                        "wasteRiskPercentage": product["waste_risk_percentage"],
                        "sellingPrice": product["selling_price"],
                        "costPrice": product["cost_price"],
                        "shelfLifeDays": product["shelf_life_days"],
                        "name": product["name"],
                    },
                    sales_history,
                    horizon_days=horizon_days,
                )
            else:
                today = date.today()
                forecast = {
                    "expectedDemand": 0.0,
                    "confidenceScore": 35.0,
                    "methodUsed": "no_history",
                    "explanation": "No sales history available yet; forecast held at zero until imports arrive.",
                    "dailyForecast": [
                        {
                            "date": (today + timedelta(days=offset + 1)).isoformat(),
                            "quantity": 0.0,
                        }
                        for offset in range(horizon_days)
                    ],
                    "horizonDays": horizon_days,
                }
            forecast_confidence = float(forecast["confidenceScore"])
            product_blockers = list(state["blocked"])
            if len(sales_history) < MIN_SALES_HISTORY_DAYS:
                product_blockers.append("insufficient_sales_history")
                forecast_confidence = min(forecast_confidence, 48.0)
            if product["supplier_id"] is None or not product["supplier_active"]:
                product_blockers.append("missing_supplier_mapping")
            if "stale_stock_count" in product_blockers:
                forecast_confidence = min(forecast_confidence, 52.0)
            reorder = calculate_reorder_quantity(
                {
                    "leadTimeDays": product["lead_time_days"],
                    "safetyStock": product["safety_stock"],
                    "unit": product["unit"],
                    "wasteRiskPercentage": product["waste_risk_percentage"],
                },
                state["currentStock"],
                forecast,
            )
            reorder["recommendationType"] = (
                "NEEDS_REVIEW"
                if reorder["recommendationType"] == "ORDER" and product_blockers
                else reorder["recommendationType"]
            )
            reorder["reorderQuantity"] = round_reorder_quantity(
                product["unit"],
                reorder["reorderQuantity"],
                float(product["reorder_multiple"] or 1.0),
            )
            financial_impact = calculate_financial_impact(
                {
                    "sellingPrice": product["selling_price"],
                    "costPrice": product["cost_price"],
                    "shelfLifeDays": product["shelf_life_days"],
                    "wasteRiskPercentage": product["waste_risk_percentage"],
                },
                state["currentStock"],
                reorder,
            )
            financial_impact["protectedRevenue"] = round(
                financial_impact["potentialLostRevenue"] * (0.55 if reorder["recommendationType"] in {"ORDER", "NEEDS_REVIEW"} else 0.0),
                2,
            )
            financial_impact["expectedOrderCost"] = round(
                reorder["reorderQuantity"] * product["cost_price"],
                2,
            )
            explanation, no_action = build_explanation(
                {
                    "name": product["name"],
                    "unit": product["unit"],
                    "wasteRiskPercentage": product["waste_risk_percentage"],
                    "shelfLifeDays": product["shelf_life_days"],
                },
                state["currentStock"],
                reorder,
                financial_impact,
            )
            if product_blockers:
                explanation = f"{explanation} Handmatige controle vereist: {', '.join(product_blockers)}."
            product_item = {
                "id": f"advice-{product['id']}",
                "productId": product["id"],
                "productName": product["name"],
                "category": product["category"],
                "unit": product["unit"],
                "supplierName": product["supplier_name"] or "Unmapped supplier",
                "currentStock": state["currentStock"],
                "expectedDemandNext7Days": forecast["expectedDemand"],
                "expectedDemandDuringLeadTime": reorder["expectedDemandDuringLeadTime"],
                "reorderQuantity": reorder["reorderQuantity"],
                "adviceType": reorder["recommendationType"],
                "urgency": "high" if reorder["recommendationType"] in {"ORDER", "NEEDS_REVIEW"} and reorder["requiredStock"] > state["currentStock"] else reorder["urgency"],
                "confidenceScore": round(forecast_confidence, 1),
                "financialImpact": financial_impact,
                "influencingFactors": [],
                "explanation": explanation,
                "whatIfNoAction": no_action,
                "linkedPurchaseOrderId": None,
                "autoOrderStatus": None,
                "recentSalesHistory": [
                    {"date": point["date"], "quantity": float(point["quantitySold"])}
                    for point in sales_history[-14:]
                ],
                "forecast": forecast,
                "baselineForecast": forecast["dailyForecast"],
                "methodUsed": forecast["methodUsed"],
                "modelDiagnostics": {
                    "sourceCountFresh": "stale_stock_count" not in product_blockers,
                    "salesHistoryDays": len(sales_history),
                },
                "forecastHorizonDays": forecast["horizonDays"],
                "product": {
                    "id": product["id"],
                    "name": product["name"],
                    "unit": product["unit"],
                    "costPrice": product["cost_price"],
                    "sellingPrice": product["selling_price"],
                    "wasteRiskPercentage": product["waste_risk_percentage"],
                    "safetyStock": product["safety_stock"],
                    "leadTimeDays": product["lead_time_days"],
                    "shelfLifeDays": product["shelf_life_days"],
                    "category": product["category"],
                    "supplierName": product["supplier_name"] or "Unmapped supplier",
                },
                "advice": reorder["recommendationType"],
                "recommendationType": reorder["recommendationType"],
                "noActionMessage": no_action,
                "requiredStock": reorder["requiredStock"],
                "excessStock": reorder["excessStock"],
                "urgencyScore": round(
                    financial_impact["shortageRisk"] * 50
                    + min(20, product["lead_time_days"] * 4)
                    + max(0, 100 - forecast_confidence) * 0.2,
                    1,
                ),
                "calculationBreakdown": {
                    "expectedDemandDuringLeadTime": reorder["expectedDemandDuringLeadTime"],
                    "safetyStock": product["safety_stock"],
                    "currentStock": state["currentStock"],
                    "requiredStock": reorder["requiredStock"],
                    "leadTimeDays": product["lead_time_days"],
                },
                "provenance": {
                    "sourceCountTimestamp": dt_to_iso(state["countTimestamp"]),
                    "forecastWindowDays": len(sales_history),
                    "blockingIssues": product_blockers,
                    "salesSinceCount": state["salesSinceCount"],
                    "receiptsSinceCount": state["receiptsSinceCount"],
                    "wasteSinceCount": state["wasteSinceCount"],
                },
            }
            items.append(product_item)
            for issue in product_blockers:
                blocking_issues.append(
                    {
                        "code": issue,
                        "severity": "warning" if issue == "stale_stock_count" else "critical",
                        "productId": product["id"],
                        "message": f"{product['name']}: {issue.replace('_', ' ')}",
                    }
                )

        items.sort(key=lambda item: (item["urgency"] != "high", item["advice"] == "HOLD", -item["financialImpact"]["estimatedProfitImpact"]))
        purchase_orders = self._build_purchase_orders(items)
        risk_radar = {
            "shortageWatch": sorted(items, key=lambda item: item["financialImpact"]["potentialLostRevenue"], reverse=True)[:3],
            "wasteWatch": sorted(items, key=lambda item: item["financialImpact"]["potentialWasteCost"], reverse=True)[:3],
            "reviewNeeded": [item for item in items if item["advice"] == "NEEDS_REVIEW"][:3],
        }
        evaluation = self._build_evaluation(items)
        summary = {
            "productsChecked": len(items),
            "urgentActions": len([item for item in items if item["urgency"] == "high"]),
            "purchaseOrdersPrepared": len([order for order in purchase_orders["active"] if order["status"] in PURCHASE_ORDER_OPEN_STATUSES]),
            "protectedRevenue": round(sum(item["financialImpact"]["protectedRevenue"] for item in items), 2),
            "potentialWastePrevented": round(sum(item["financialImpact"]["potentialWasteCost"] for item in items if item["advice"] == "REDUCE"), 2),
            "estimatedProfitImpact": round(sum(max(0.0, item["financialImpact"]["estimatedProfitImpact"]) for item in items), 2),
            "estimatedWeeklySavings": round(sum(max(0.0, item["financialImpact"]["estimatedProfitImpact"]) for item in items), 2),
            "urgentOrdersCount": len([item for item in items if item["advice"] in {"ORDER", "NEEDS_REVIEW"}]),
            "highestWasteRiskCost": round(max((item["financialImpact"]["potentialWasteCost"] for item in items), default=0.0), 2),
            "highestShortageRiskRevenue": round(max((item["financialImpact"]["potentialLostRevenue"] for item in items), default=0.0), 2),
        }
        freshness = {
            "sales": self._freshness_label(latest_sales_at, 1),
            "inventory": self._freshness_label(latest_count_at, COUNT_FRESHNESS_DAYS),
            "waste": self._freshness_label(latest_waste_at, 7),
            "overall": "stale" if any(label == "stale" for label in [self._freshness_label(latest_sales_at, 1), self._freshness_label(latest_count_at, COUNT_FRESHNESS_DAYS)]) else "fresh",
        }
        completeness = {
            "countedProducts": len([item for item in items if item["provenance"]["sourceCountTimestamp"]]),
            "totalProducts": len(items),
            "missingSupplierMappings": len([item for item in items if "missing_supplier_mapping" in item["provenance"]["blockingIssues"]]),
            "sufficientSalesHistoryProducts": len([item for item in items if item["modelDiagnostics"]["salesHistoryDays"] >= MIN_SALES_HISTORY_DAYS]),
        }
        source_timestamps = {
            "lastSalesIngestAt": dt_to_iso(latest_sales_at),
            "lastStockCountAt": dt_to_iso(latest_count_at),
            "lastWasteIngestAt": dt_to_iso(latest_waste_at),
            "lastAdviceRunAt": None,
        }
        snapshot = {
            "restaurant": RESTAURANT_PROFILE,
            "generatedAt": utc_timestamp(),
            "summary": summary,
            "topActions": self._build_top_actions(items, purchase_orders["active"]),
            "riskRadar": risk_radar,
            "productAdvice": items,
            "purchaseOrderDrafts": purchase_orders["active"],
            "purchaseOrderHistory": purchase_orders["history"],
            "evaluation": evaluation,
            "magicSummary": {
                "checkedProducts": summary["productsChecked"],
                "risksFound": len([item for item in items if item["advice"] in {"ORDER", "NEEDS_REVIEW", "REDUCE"}]),
                "draftOrdersCount": summary["purchaseOrdersPrepared"],
                "protectedRevenue": summary["protectedRevenue"],
                "preventedWaste": summary["potentialWastePrevented"],
                "lastUpdateLabel": "production snapshot",
                "message": (
                    f"HVAS analysed {summary['productsChecked']} live products, found "
                    f"{summary['urgentActions']} urgent actions and prepared "
                    f"{summary['purchaseOrdersPrepared']} supplier draft orders."
                ),
            },
            "topUrgentAdvice": [item for item in items if item["advice"] in {"ORDER", "NEEDS_REVIEW"}][:5],
            "biggestWasteRisks": sorted(items, key=lambda item: item["financialImpact"]["potentialWasteCost"], reverse=True)[:5],
            "todaysActions": self._build_top_actions(items, purchase_orders["active"]),
            "purchaseOrders": purchase_orders,
            "filters": {
                "categories": sorted({item["category"] for item in items}),
                "adviceTypes": ["ORDER", "NEEDS_REVIEW", "REDUCE", "HOLD"],
                "urgencyLevels": ["high", "medium", "low"],
            },
            "products": items,
            "dataFreshness": freshness,
            "dataCompleteness": completeness,
            "blockingIssues": blocking_issues,
            "sourceTimestamps": source_timestamps,
        }
        return snapshot

    def _build_purchase_orders(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in items:
            if item["advice"] not in {"ORDER", "NEEDS_REVIEW"} or item["reorderQuantity"] <= 0:
                continue
            grouped[item["supplierName"]].append(item)
        active = []
        with self.engine.begin() as conn:
            existing_orders = {
                row["id"]: row
                for row in conn.execute(select(self.purchase_orders)).mappings().all()
            }
        for supplier_name, supplier_items in grouped.items():
            order_id = f"po-{supplier_name.lower().replace(' ', '-').replace('&', 'and')}"
            existing = existing_orders.get(order_id)
            status = existing["status"] if existing else ("NEEDS_REVIEW" if any("missing" in issue for item in supplier_items for issue in item["provenance"]["blockingIssues"]) else "DRAFT")
            if status not in PURCHASE_ORDER_STATUSES:
                status = "DRAFT"
            expected_delivery = date.today() + timedelta(days=max(item["product"]["leadTimeDays"] for item in supplier_items))
            total_amount = round(sum(item["reorderQuantity"] * item["product"]["costPrice"] for item in supplier_items), 2)
            total_protected = round(sum(item["financialImpact"]["protectedRevenue"] for item in supplier_items), 2)
            total_waste = round(sum(item["financialImpact"]["potentialWasteCost"] for item in supplier_items if item["advice"] == "REDUCE"), 2)
            order = {
                "id": order_id,
                "supplierName": supplier_name,
                "status": status,
                "itemCount": len(supplier_items),
                "totalAmount": total_amount,
                "totalEstimatedCost": total_amount,
                "expectedDeliveryDate": expected_delivery.isoformat(),
                "isSimulated": False,
                "lastUpdated": dt_to_iso(existing["updated_at"]) if existing else utc_timestamp(),
                "createdAt": dt_to_iso(existing["created_at"]) if existing else utc_timestamp(),
                "reason": "Generated from live sales + inventory + waste + receipt data.",
                "products": [],
                "productLines": [],
                "summary": {
                    "totalProtectedRevenue": total_protected,
                    "totalPreventedWaste": total_waste,
                },
            }
            blocked = any("missing_supplier_mapping" in item["provenance"]["blockingIssues"] for item in supplier_items)
            if blocked:
                order["status"] = "NEEDS_REVIEW"
                order["reason"] = "Missing supplier configuration or stale inventory requires manual review."
            for item in supplier_items:
                line = {
                    "productId": item["productId"],
                    "productName": item["productName"],
                    "quantity": item["reorderQuantity"],
                    "unit": item["unit"],
                    "unitCost": item["product"]["costPrice"],
                    "totalCost": round(item["reorderQuantity"] * item["product"]["costPrice"], 2),
                    "lineAmount": round(item["reorderQuantity"] * item["product"]["costPrice"], 2),
                    "reason": item["explanation"],
                    "impact": item["financialImpact"]["protectedRevenue"],
                    "urgency": item["urgency"],
                    "linkedAdviceId": item["id"],
                }
                order["products"].append(line)
                order["productLines"].append(line)
                item["linkedPurchaseOrderId"] = order_id
                item["autoOrderStatus"] = order["status"]
            active.append(order)
        history = self._purchase_order_history(existing_orders)
        return {"active": active, "history": history}

    def _purchase_order_history(self, existing_orders: dict[str, Any]) -> list[dict[str, Any]]:
        history = []
        for row in existing_orders.values():
            if row["status"] in {"SENT_SIMULATED", "REJECTED", "APPROVED"}:
                history.append(
                    {
                        "id": row["id"],
                        "supplierName": self._supplier_name_by_id(row["supplier_id"]),
                        "status": row["status"],
                        "updatedAt": dt_to_iso(row["updated_at"]),
                        "itemCount": self._purchase_order_line_count(row["id"]),
                        "totalAmount": row["total_amount"],
                        "expectedDeliveryDate": row["expected_delivery_date"].date().isoformat(),
                    }
                )
        history.sort(key=lambda item: item["updatedAt"] or "", reverse=True)
        return history[:8]

    def _sync_purchase_orders(self, items: list[dict[str, Any]], run_id: int) -> None:
        purchase_orders = self._build_purchase_orders(items)["active"]
        supplier_ids = self._supplier_name_to_id()
        now = parse_dt(utc_timestamp())
        with self.engine.begin() as conn:
            active_ids = {order["id"] for order in purchase_orders}
            if active_ids:
                existing_active = conn.execute(select(self.purchase_orders.c.id)).scalars().all()
                for existing_id in existing_active:
                    if existing_id not in active_ids and existing_id.startswith("po-"):
                        conn.execute(delete(self.purchase_order_lines).where(self.purchase_order_lines.c.purchase_order_id == existing_id))
                        conn.execute(delete(self.purchase_orders).where(self.purchase_orders.c.id == existing_id))
            for order in purchase_orders:
                existing = conn.execute(
                    select(self.purchase_orders).where(self.purchase_orders.c.id == order["id"])
                ).mappings().first()
                values = {
                    "supplier_id": supplier_ids.get(order["supplierName"]),
                    "status": order["status"],
                    "updated_at": now,
                    "expected_delivery_date": parse_dt(order["expectedDeliveryDate"]),
                    "total_amount": order["totalAmount"],
                    "total_protected_revenue": order["summary"]["totalProtectedRevenue"],
                    "total_prevented_waste": order["summary"]["totalPreventedWaste"],
                    "blocked_reason": None if order["status"] in {"DRAFT", "SENT_SIMULATED"} else order.get("reason"),
                    "snapshot_run_id": run_id,
                }
                if existing is None:
                    conn.execute(
                        insert(self.purchase_orders).values(
                            id=order["id"],
                            created_at=now,
                            **values,
                        )
                    )
                else:
                    conn.execute(
                        update(self.purchase_orders)
                        .where(self.purchase_orders.c.id == order["id"])
                        .values(**values)
                    )
                conn.execute(delete(self.purchase_order_lines).where(self.purchase_order_lines.c.purchase_order_id == order["id"]))
                conn.execute(
                    insert(self.purchase_order_lines),
                    [
                        {
                            "purchase_order_id": order["id"],
                            "product_id": line["productId"],
                            "quantity": line["quantity"],
                            "unit_cost": line.get("unitCost") or 0.0,
                            "total_cost": line.get("totalCost") or line.get("lineAmount") or 0.0,
                            "reason": line["reason"],
                            "impact": line.get("impact") or 0.0,
                            "urgency": line.get("urgency") or "low",
                            "linked_advice_id": line.get("linkedAdviceId"),
                        }
                        for line in order["products"]
                    ],
                )

    def _build_top_actions(self, items: list[dict[str, Any]], orders: list[dict[str, Any]]) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        for order in orders:
            if order["status"] in PURCHASE_ORDER_OPEN_STATUSES:
                actions.append(
                    {
                        "id": f"approve-{order['id']}",
                        "type": "PURCHASE_ORDER",
                        "title": f"Approve supplier draft: {order['supplierName']}",
                        "description": f"{order['itemCount']} products queued for {order['expectedDeliveryDate']} with spend {order['totalAmount']:.2f}.",
                        "impact": order["summary"]["totalProtectedRevenue"],
                        "status": order["status"],
                        "targetId": order["id"],
                    }
                )
        waste_candidate = next((item for item in items if item["advice"] == "REDUCE"), None)
        if waste_candidate:
            actions.append(
                {
                    "id": f"reduce-{waste_candidate['productId']}",
                    "type": "PRODUCT",
                    "title": f"Review waste risk: {waste_candidate['productName']}",
                    "description": waste_candidate["noActionMessage"],
                    "impact": waste_candidate["financialImpact"]["potentialWasteCost"],
                    "status": "WARNING",
                    "targetId": waste_candidate["productId"],
                }
            )
        shortage_candidate = next((item for item in items if item["advice"] in {"ORDER", "NEEDS_REVIEW"}), None)
        if shortage_candidate:
            actions.append(
                {
                    "id": f"order-{shortage_candidate['productId']}",
                    "type": "PRODUCT",
                    "title": f"Replenish {shortage_candidate['productName']}",
                    "description": shortage_candidate["explanation"],
                    "impact": shortage_candidate["financialImpact"]["potentialLostRevenue"],
                    "status": shortage_candidate["urgency"].upper(),
                    "targetId": shortage_candidate["productId"],
                }
            )
        actions.sort(key=lambda item: item["impact"], reverse=True)
        return actions[:4]

    def _build_evaluation(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        by_product = []
        for item in items:
            history = item["recentSalesHistory"]
            if not history:
                metrics = {
                    "mae": 0.0,
                    "rmse": 0.0,
                    "wape": 0.0,
                    "stockoutSimulationRate": 0.0,
                    "wasteSimulationRate": 0.0,
                }
            else:
                recent = [point["quantity"] for point in history[-7:]]
                predicted = item["forecast"]["expectedDemand"] / max(1, item["forecast"]["horizonDays"])
                errors = [abs(predicted - value) for value in recent]
                mae = sum(errors) / len(errors)
                rmse = (sum(error ** 2 for error in errors) / len(errors)) ** 0.5
                total_actual = sum(recent)
                wape = 0.0 if total_actual == 0 else sum(errors) / total_actual
                metrics = {
                    "mae": round(mae, 2),
                    "rmse": round(rmse, 2),
                    "wape": round(wape, 3),
                    "stockoutSimulationRate": round(max(0.0, item["requiredStock"] - item["currentStock"]) / max(item["requiredStock"], 1), 3),
                    "wasteSimulationRate": round(item["excessStock"] / max(item["currentStock"], 1), 3),
                }
            by_product.append({"productId": item["productId"], **metrics})
        if not by_product:
            aggregate = {
                "mae": 0.0,
                "rmse": 0.0,
                "wape": 0.0,
                "stockoutSimulationRate": 0.0,
                "wasteSimulationRate": 0.0,
            }
        else:
            aggregate = {
                "mae": round(sum(item["mae"] for item in by_product) / len(by_product), 2),
                "rmse": round(sum(item["rmse"] for item in by_product) / len(by_product), 2),
                "wape": round(sum(item["wape"] for item in by_product) / len(by_product), 3),
                "stockoutSimulationRate": round(sum(item["stockoutSimulationRate"] for item in by_product) / len(by_product), 3),
                "wasteSimulationRate": round(sum(item["wasteSimulationRate"] for item in by_product) / len(by_product), 3),
            }
        return {"aggregate": aggregate, "byProduct": by_product}

    def _current_inventory_snapshot(self) -> list[dict[str, Any]]:
        products = self._fetch_product_rows()
        inventory_state = self._calculate_inventory_positions(products)
        snapshot = []
        for product in products:
            state = inventory_state[product["id"]]
            snapshot.append(
                {
                    "productId": product["id"],
                    "productName": product["name"],
                    "category": product["category"],
                    "unit": product["unit"],
                    "currentStock": state["currentStock"],
                    "supplierName": product["supplier_name"] or "Unmapped supplier",
                }
            )
        return snapshot

    def _latest_timestamp(self, column: Any, table: Table) -> datetime | None:
        with self.engine.begin() as conn:
            value = conn.execute(select(func.max(column)).select_from(table)).scalar_one()
        return parse_dt(value)

    def _latest_advice_run(self) -> Any:
        with self.engine.begin() as conn:
            return conn.execute(
                select(self.advice_runs).order_by(self.advice_runs.c.created_at.desc(), self.advice_runs.c.id.desc()).limit(1)
            ).mappings().first()

    def _latest_import_status(self) -> Any:
        with self.engine.begin() as conn:
            return conn.execute(
                select(self.import_jobs).order_by(self.import_jobs.c.created_at.desc(), self.import_jobs.c.id.desc()).limit(1)
            ).mappings().first()

    def _supplier_name_to_id(self) -> dict[str, int]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(self.suppliers.c.id, self.suppliers.c.name)).all()
        return {name: supplier_id for supplier_id, name in rows}

    def _supplier_name_by_id(self, supplier_id: int | None) -> str:
        if supplier_id is None:
            return "Unmapped supplier"
        with self.engine.begin() as conn:
            row = conn.execute(
                select(self.suppliers.c.name).where(self.suppliers.c.id == supplier_id)
            ).first()
        return row[0] if row else "Unmapped supplier"

    def _purchase_order_line_count(self, purchase_order_id: str) -> int:
        with self.engine.begin() as conn:
            return int(
                conn.execute(
                    select(func.count()).select_from(self.purchase_order_lines).where(self.purchase_order_lines.c.purchase_order_id == purchase_order_id)
                ).scalar_one()
            )

    def _freshness_label(self, timestamp: datetime | None, max_age_days: int) -> str:
        if timestamp is None:
            return "missing"
        return "fresh" if timestamp >= datetime.now(UTC) - timedelta(days=max_age_days) else "stale"

    def _serialize_user(self, user: Any) -> dict[str, Any]:
        return {
            "id": int(user["id"]),
            "fullName": user["full_name"],
            "email": user["email"],
            "companyName": user["company_name"],
            "role": user["role"],
            "initials": "".join(part[:1].upper() for part in user["full_name"].split()[:2]) or "HV",
        }
