import os


APP_DIR = os.path.dirname(__file__)
DEFAULT_DATA_DIR = os.path.join(APP_DIR, "data")

HIST_DATA_PATH = os.path.join(os.path.expanduser('~'), 'historical_data.csv')
SD_WEEKLY_ORDERS = 160
DB_HOST = 'localhost'
DB_PORT = ''
DB_NAME = 'prims'
DB_USERNAME = 'root'
DB_PASSWORD = ''
CSV_DIR = os.getenv("CSV_DIR", os.path.join(APP_DIR, "csv"))
START_DATE = '2024-01-01'
STATE_PATH = os.getenv("SIMULATION_STATE_PATH", os.path.join(DEFAULT_DATA_DIR, "simulation_state.json"))
ORDER_ASSISTANT_STATE_PATH = os.getenv("ORDER_ASSISTANT_STATE_PATH", os.path.join(DEFAULT_DATA_DIR, "order_assistant_state.json"))
PRODUCTION_DB_PATH = os.getenv("PRODUCTION_DB_PATH", os.path.join(DEFAULT_DATA_DIR, "production_operations.sqlite3"))

DEFAULT_SIM_CONFIG = {
    'order_variance': 18,
    'restock_threshold': 1200,
    'restock_amount': 1700,
    'lookback_weeks': 4,
}
