from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

try:
    from settings import CSV_DIR, PRODUCTION_DB_PATH, STATE_PATH
    from production_service import ProductionOperationsService
    from simulation_service import InventorySimulationService
except ImportError:
    from .settings import CSV_DIR, PRODUCTION_DB_PATH, STATE_PATH
    from .production_service import ProductionOperationsService
    from .simulation_service import InventorySimulationService


app = Flask(__name__)
CORS(app)
order_assistant = ProductionOperationsService(db_path=PRODUCTION_DB_PATH)
live_simulation = InventorySimulationService(csv_dir=CSV_DIR, state_path=STATE_PATH)


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


@app.get("/api/restaurant")
def get_restaurant():
    return jsonify(order_assistant.get_restaurant())


@app.get("/api/order-advice")
def get_order_advice():
    return jsonify(order_assistant.get_order_advice())


@app.get("/api/live-simulation")
def get_live_simulation():
    return jsonify(live_simulation.get_state())


@app.post("/api/live-simulation/start")
def start_live_simulation():
    return jsonify(live_simulation.start())


@app.post("/api/live-simulation/stop")
def stop_live_simulation():
    return jsonify(live_simulation.stop())


@app.post("/api/live-simulation/tick")
def tick_live_simulation():
    return jsonify(live_simulation.tick())


@app.post("/api/live-simulation/reset")
def reset_live_simulation():
    return jsonify(live_simulation.reset())


@app.post("/api/live-simulation/config")
def update_live_simulation_config():
    payload = request.get_json() or {}
    return jsonify(live_simulation.update_config(payload))


@app.get("/api/purchase-orders")
def get_purchase_orders():
    return jsonify(order_assistant.get_purchase_orders())


@app.post("/api/purchase-orders/<purchase_order_id>/approve")
def approve_purchase_order(purchase_order_id: str):
    snapshot = order_assistant.approve_purchase_order(purchase_order_id)
    return jsonify({"success": True, "snapshot": snapshot})


@app.post("/api/purchase-orders/<purchase_order_id>/reject")
def reject_purchase_order(purchase_order_id: str):
    snapshot = order_assistant.reject_purchase_order(purchase_order_id)
    return jsonify({"success": True, "snapshot": snapshot})


@app.post("/api/inventory")
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
def import_sales():
    payload = request.get_json() or {}
    items = payload.get("items", [])
    source_system = payload.get("sourceSystem", "manual_api")
    return jsonify(order_assistant.import_sales(items, source_system=source_system, recompute=True))


@app.post("/api/import/inventory-counts")
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
def import_receipts():
    payload = request.get_json() or {}
    items = payload.get("items", [])
    source_system = payload.get("sourceSystem", "manual_api")
    return jsonify(order_assistant.import_receipts(items, source_system=source_system, recompute=True))


@app.post("/api/import/waste")
def import_waste():
    payload = request.get_json() or {}
    items = payload.get("items", [])
    source_system = payload.get("sourceSystem", "manual_api")
    return jsonify(order_assistant.import_waste(items, source_system=source_system, recompute=True))


@app.get("/api/import/status")
def get_import_status():
    return jsonify(order_assistant.get_import_status())


@app.post("/api/import/historical-dataset")
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
def get_config_products():
    return jsonify({"items": order_assistant.get_config_products()})


@app.patch("/api/config/products/<int:product_id>")
def patch_config_product(product_id: int):
    payload = request.get_json() or {}
    return jsonify(order_assistant.patch_product(product_id, payload))


@app.get("/api/config/suppliers")
def get_config_suppliers():
    return jsonify({"items": order_assistant.get_config_suppliers()})


@app.patch("/api/config/suppliers/<int:supplier_id>")
def patch_config_supplier(supplier_id: int):
    payload = request.get_json() or {}
    return jsonify(order_assistant.patch_supplier(supplier_id, payload))


@app.get("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
