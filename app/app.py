from functools import wraps

from flask import Flask, jsonify, render_template, request, session
from flask_cors import CORS

try:
    from settings import (
        CSV_DIR,
        FRONTEND_ORIGIN,
        PRODUCTION_DB_URL,
        SECRET_KEY,
        SESSION_COOKIE_SAMESITE,
        SESSION_COOKIE_SECURE,
        STATE_PATH,
    )
    from production_service import ProductionOperationsService
    from simulation_service import InventorySimulationService
    from smart_ordering.service import SmartOrderingService
    from smart_ordering.validation import (
        validate_forecast_request,
        validate_order_draft_request,
        validate_place_orders_request,
    )
except ImportError:
    from .settings import (
        CSV_DIR,
        FRONTEND_ORIGIN,
        PRODUCTION_DB_URL,
        SECRET_KEY,
        SESSION_COOKIE_SAMESITE,
        SESSION_COOKIE_SECURE,
        STATE_PATH,
    )
    from .production_service import ProductionOperationsService
    from .simulation_service import InventorySimulationService
    from .smart_ordering.service import SmartOrderingService
    from .smart_ordering.validation import (
        validate_forecast_request,
        validate_order_draft_request,
        validate_place_orders_request,
    )


app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[FRONTEND_ORIGIN])
app.secret_key = SECRET_KEY
app.config["SESSION_COOKIE_SECURE"] = SESSION_COOKIE_SECURE
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = SESSION_COOKIE_SAMESITE
order_assistant = ProductionOperationsService(db_url=PRODUCTION_DB_URL)
smart_ordering = SmartOrderingService(order_assistant)
live_simulation = InventorySimulationService(csv_dir=CSV_DIR, state_path=STATE_PATH)


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


@app.get("/api/restaurant")
@login_required
def get_restaurant():
    return jsonify(order_assistant.get_restaurant())


@app.get("/api/order-advice")
@login_required
def get_order_advice():
    return jsonify(order_assistant.get_order_advice())


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


@app.get("/api/live-simulation")
@login_required
def get_live_simulation():
    return jsonify(live_simulation.get_state())


@app.post("/api/live-simulation/start")
@login_required
def start_live_simulation():
    return jsonify(live_simulation.start())


@app.post("/api/live-simulation/stop")
@login_required
def stop_live_simulation():
    return jsonify(live_simulation.stop())


@app.post("/api/live-simulation/tick")
@login_required
def tick_live_simulation():
    return jsonify(live_simulation.tick())


@app.post("/api/live-simulation/reset")
@login_required
def reset_live_simulation():
    return jsonify(live_simulation.reset())


@app.post("/api/live-simulation/config")
@login_required
def update_live_simulation_config():
    payload = request.get_json() or {}
    return jsonify(live_simulation.update_config(payload))


@app.get("/api/purchase-orders")
@login_required
def get_purchase_orders():
    return jsonify(order_assistant.get_purchase_orders())


@app.post("/api/purchase-orders/<purchase_order_id>/approve")
@login_required
def approve_purchase_order(purchase_order_id: str):
    snapshot = order_assistant.approve_purchase_order(purchase_order_id)
    return jsonify({"success": True, "snapshot": snapshot})


@app.post("/api/purchase-orders/<purchase_order_id>/reject")
@login_required
def reject_purchase_order(purchase_order_id: str):
    snapshot = order_assistant.reject_purchase_order(purchase_order_id)
    return jsonify({"success": True, "snapshot": snapshot})


@app.post("/api/inventory")
@login_required
def update_inventory():
    # Compatibility route for the existing inventory page.
    payload = request.get_json() or {}
    items = payload.get("items", [])
    if not isinstance(items, list) or not items:
        raise ValueError("Inventory updates require a non-empty items array.")
    result = order_assistant.update_inventory(items)
    return jsonify(
        {
            "success": True,
            "updated": result["updated"],
            "importResult": result["result"],
            "orderAdvice": order_assistant.get_order_advice(),
        }
    )


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


@app.get("/api/recipes")
@login_required
def get_recipes():
    return jsonify(live_simulation.get_recipes())


@app.post("/api/recipes")
@login_required
def create_recipe():
    payload = request.get_json() or {}
    name = str(payload.get("name", ""))
    ingredients = payload.get("ingredients", [])
    recipe = live_simulation.add_recipe(name, ingredients)
    return jsonify({"success": True, "id": recipe["id"]})


@app.delete("/api/recipes/<int:recipe_id>")
@login_required
def delete_recipe(recipe_id: int):
    live_simulation.delete_recipe(recipe_id)
    return jsonify({"success": True})


@app.get("/api/ingredients")
@login_required
def get_ingredients():
    return jsonify(live_simulation.get_ingredients())


@app.post("/api/ingredients")
@login_required
def create_ingredient():
    payload = request.get_json() or {}
    name = str(payload.get("name", ""))
    ingredient = live_simulation.add_ingredient(name)
    return jsonify({"success": True, "id": ingredient["id"]})


@app.get("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
