import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

APP_DIR = os.path.dirname(__file__)
DEFAULT_DATA_DIR = os.path.join(APP_DIR, "data")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-hvas-secret-key-change-me")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
# When deployed cross-origin, cookies must be SameSite=None; Secure
SESSION_COOKIE_SAMESITE = "None" if SESSION_COOKIE_SECURE else "Lax"

HIST_DATA_PATH = os.path.join(os.path.expanduser('~'), 'historical_data.csv')
SD_WEEKLY_ORDERS = 160
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "prims")
DB_USERNAME = os.getenv("DB_USERNAME", os.getenv("USER", "postgres"))
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
CSV_DIR = os.getenv("CSV_DIR", os.path.join(APP_DIR, "csv"))
START_DATE = '2024-01-01'
STATE_PATH = os.getenv("SIMULATION_STATE_PATH", os.path.join(DEFAULT_DATA_DIR, "simulation_state.json"))
ORDER_ASSISTANT_STATE_PATH = os.getenv("ORDER_ASSISTANT_STATE_PATH", os.path.join(DEFAULT_DATA_DIR, "order_assistant_state.json"))

def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _postgres_url_from_settings() -> str:
    password = quote_plus(DB_PASSWORD)
    username = quote_plus(DB_USERNAME)
    return f"postgresql+psycopg://{username}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


PRODUCTION_DB_URL = _normalize_database_url(
    os.getenv("DATABASE_URL")
    or os.getenv("PRODUCTION_DB_URL")
    or _postgres_url_from_settings()
)

DEFAULT_SIM_CONFIG = {
    'order_variance': 18,
    'restock_threshold': 1200,
    'restock_amount': 1700,
    'lookback_weeks': 4,
}
