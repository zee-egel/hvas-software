from functools import wraps
from dataclasses import asdict
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
import sys

from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.settings import (
    BOOTSTRAP_SAMPLE_DATA,
    FRONTEND_DIST_DIR,
    FRONTEND_ORIGIN,
    PRODUCTION_DB_URL,
    SECRET_KEY,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
)
from app.production_service import ProductionOperationsService
from app.scripts.normalize_product_candidates import normalize_rows, parse_rows_from_file
from app.smart_ordering.service import SmartOrderingService
from app.smart_ordering.validation import (
    validate_forecast_request,
    validate_order_draft_request,
    validate_place_orders_request,
)

FRONTEND_DIST = Path(FRONTEND_DIST_DIR)

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[FRONTEND_ORIGIN])
app.secret_key = SECRET_KEY
app.config["SESSION_COOKIE_SECURE"] = SESSION_COOKIE_SECURE
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = SESSION_COOKIE_SAMESITE
order_assistant = ProductionOperationsService(
    db_url=PRODUCTION_DB_URL,
    bootstrap_sample_data=BOOTSTRAP_SAMPLE_DATA,
)
smart_ordering = SmartOrderingService(order_assistant)


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return order_assistant.get_user_by_id(int(user_id))


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"success": False, "error": "Authentication required."}), 401
        return view(*args, **kwargs)

    return wrapped


def personalize_restaurant_payload(payload, user):
    result = deepcopy(payload)
    restaurant = dict(result.get("restaurant") or {})
    onboarding = (user or {}).get("onboardingData") or {}
    location = onboarding.get("restaurantLocation") or {}

    restaurant["name"] = user.get("companyName") or restaurant.get("name")
    if onboarding.get("restaurantType"):
        restaurant["type"] = onboarding["restaurantType"]
    if location.get("city"):
        restaurant["location"] = location["city"]
    elif location.get("postalCodeOrNeighborhood"):
        restaurant["location"] = location["postalCodeOrNeighborhood"]
    result["restaurant"] = restaurant
    return result


@app.errorhandler(ValueError)
def handle_value_error(error):
    return jsonify({"success": False, "error": str(error)}), 400


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    app.logger.exception("Unexpected API error: %s", error)
    return jsonify({"success": False, "error": "Unexpected backend error."}), 500


@app.get("/health")
def get_health():
    return jsonify(order_assistant.get_health())


@app.get("/api/health")
def get_api_health():
    return jsonify(order_assistant.get_health())


@app.get("/api/auth/session")
def get_auth_session():
    user = current_user()
    return jsonify({"authenticated": user is not None, "user": user})


@app.post("/api/auth/signup")
def signup():
    payload = request.get_json() or {}
    user = order_assistant.create_user(
        full_name=str(payload.get("fullName", "")),
        email=str(payload.get("email", "")),
        company_name=str(payload.get("companyName", "")),
        password=str(payload.get("password", "")),
    )
    session["user_id"] = user["id"]
    session.permanent = bool(payload.get("rememberMe", True))
    return jsonify({"success": True, "user": user})


@app.post("/api/auth/login")
def login():
    payload = request.get_json() or {}
    user = order_assistant.authenticate_user(
        email=str(payload.get("email", "")),
        password=str(payload.get("password", "")),
    )
    session["user_id"] = user["id"]
    session.permanent = bool(payload.get("rememberMe", True))
    return jsonify({"success": True, "user": user})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"success": True})


@app.patch("/api/account")
@login_required
def update_account():
    user = current_user()
    payload = request.get_json() or {}
    updated_user = order_assistant.update_user(
        int(user["id"]),
        full_name=payload.get("fullName"),
        company_name=payload.get("companyName"),
        current_password=payload.get("currentPassword"),
        new_password=payload.get("newPassword"),
    )
    return jsonify({"success": True, "user": updated_user})


@app.get("/api/order-advice")
@login_required
def get_order_advice():
    user = current_user()
    return jsonify(personalize_restaurant_payload(order_assistant.get_order_advice(), user))


@app.get("/api/onboarding")
@login_required
def get_onboarding():
    user = current_user()
    return jsonify(order_assistant.get_user_onboarding(int(user["id"])))


@app.put("/api/onboarding")
@login_required
def save_onboarding():
    user = current_user()
    payload = request.get_json() or {}
    onboarding = order_assistant.save_user_onboarding(
        user_id=int(user["id"]),
        onboarding_data=payload.get("data") or {},
        completed=payload.get("completed"),
    )
    refreshed_user = order_assistant.get_user_by_id(int(user["id"]))
    return jsonify({"success": True, "user": refreshed_user, "onboarding": onboarding})


@app.post("/api/onboarding/reset")
@login_required
def reset_onboarding():
    user = current_user()
    onboarding = order_assistant.reset_user_onboarding(int(user["id"]))
    refreshed_user = order_assistant.get_user_by_id(int(user["id"]))
    return jsonify({"success": True, "user": refreshed_user, "onboarding": onboarding})


@app.post("/api/data-setup/normalize-products")
@login_required
def normalize_data_setup_products():
    upload = request.files.get("file")
    kind = str(request.form.get("kind", "")).strip().lower()
    if upload is None or not upload.filename:
        raise ValueError("Document upload requires a file.")
    if kind not in {"invoice", "product-list"}:
        raise ValueError("Unsupported document kind.")

    suffix = ""
    if "." in upload.filename:
        suffix = "." + upload.filename.rsplit(".", 1)[-1].lower()

    with NamedTemporaryFile(delete=True, suffix=suffix) as temp_file:
        temp_file.write(upload.read())
        temp_file.flush()
        rows = parse_rows_from_file(Path(temp_file.name))
        candidates = normalize_rows(rows)

    return jsonify(
        {
            "success": True,
            "candidates": [asdict(candidate) for candidate in candidates],
            "document": {
                "name": upload.filename,
                "kind": kind,
                "uploadedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            },
        }
    )


@app.get("/api/smart-ordering/context")
@login_required
def get_smart_ordering_context():
    return jsonify(smart_ordering.get_context())


@app.post("/api/smart-ordering/forecast")
@login_required
def create_smart_ordering_forecast():
    payload = request.get_json() or {}
    validated = validate_forecast_request(payload)
    return jsonify(
        smart_ordering.generate_forecast(
            days=validated["days"],
            include_current_stock=validated["includeCurrentStock"],
            include_outstanding_orders=validated["includeOutstandingOrders"],
        )
    )


@app.post("/api/smart-ordering/order-draft")
@login_required
def create_smart_ordering_order_draft():
    payload = request.get_json() or {}
    validated = validate_order_draft_request(payload)
    return jsonify(
        smart_ordering.create_order_draft(
            days=validated["days"],
            include_current_stock=validated["includeCurrentStock"],
            include_outstanding_orders=validated["includeOutstandingOrders"],
            suggestions=validated["suggestions"],
        )
    )


@app.post("/api/smart-ordering/place-orders")
@login_required
def place_smart_ordering_orders():
    payload = request.get_json() or {}
    draft_order_ids = validate_place_orders_request(payload)
    return jsonify(smart_ordering.place_orders(draft_order_ids))


@app.post("/api/purchase-orders/<purchase_order_id>/approve")
@login_required
def approve_purchase_order(purchase_order_id: str):
    snapshot = order_assistant.approve_purchase_order(purchase_order_id)
    return jsonify({"success": True, "snapshot": snapshot})


@app.post("/api/import/sales")
@login_required
def import_sales():
    payload = request.get_json() or {}
    items = payload.get("items", [])
    source_system = payload.get("sourceSystem", "manual_api")
    return jsonify(order_assistant.import_sales(items, source_system=source_system, recompute=True))


@app.post("/api/import/inventory-counts")
@login_required
def import_inventory_counts():
    payload = request.get_json() or {}
    items = payload.get("items", [])
    source_system = payload.get("sourceSystem", "manual_api")
    return jsonify(
        order_assistant.import_inventory_counts(
            items,
            source_system=source_system,
            recompute=True,
        )
    )


@app.post("/api/import/receipts")
@login_required
def import_receipts():
    payload = request.get_json() or {}
    items = payload.get("items", [])
    source_system = payload.get("sourceSystem", "manual_api")
    return jsonify(order_assistant.import_receipts(items, source_system=source_system, recompute=True))


@app.post("/api/import/waste")
@login_required
def import_waste():
    payload = request.get_json() or {}
    items = payload.get("items", [])
    source_system = payload.get("sourceSystem", "manual_api")
    return jsonify(order_assistant.import_waste(items, source_system=source_system, recompute=True))


@app.get("/api/import/status")
@login_required
def get_import_status():
    return jsonify(order_assistant.get_import_status())


@app.post("/api/import/historical-dataset")
@login_required
def import_historical_dataset():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        raise ValueError("Historical dataset upload requires a CSV file.")
    source_system = request.form.get("sourceSystem", "historical_dataset")
    payload = upload.read().decode("utf-8-sig")
    return jsonify(
        order_assistant.import_historical_dataset(
            payload,
            source_system=source_system,
            reset_existing=True,
        )
    )


@app.get("/api/config/products")
@login_required
def get_config_products():
    return jsonify({"items": order_assistant.get_config_products()})


@app.patch("/api/config/products/<int:product_id>")
@login_required
def patch_config_product(product_id: int):
    payload = request.get_json() or {}
    return jsonify(order_assistant.patch_product(product_id, payload))


@app.get("/api/config/suppliers")
@login_required
def get_config_suppliers():
    return jsonify({"items": order_assistant.get_config_suppliers()})


@app.patch("/api/config/suppliers/<int:supplier_id>")
@login_required
def patch_config_supplier(supplier_id: int):
    payload = request.get_json() or {}
    return jsonify(order_assistant.patch_supplier(supplier_id, payload))


@app.get("/")
@app.get("/<path:path>")
def index(path: str = ""):
    if path.startswith(("api/", "health")):
        return jsonify({"success": False, "error": "Not found."}), 404

    candidate = FRONTEND_DIST / path
    if path and candidate.is_file():
        return send_from_directory(FRONTEND_DIST, path)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        return send_from_directory(FRONTEND_DIST, "index.html")

    return (
        jsonify(
            {
                "success": False,
                "error": "Frontend build is missing. Build the Vite app before serving the SPA.",
            }
        ),
        503,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
