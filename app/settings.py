import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

APP_DIR = os.path.dirname(__file__)
DEFAULT_DATA_DIR = os.path.join(APP_DIR, "data")
DEFAULT_PRODUCTION_DB_PATH = os.path.join(DEFAULT_DATA_DIR, "production_operations.sqlite3")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-hvas-secret-key-change-me")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
# When deployed cross-origin, cookies must be SameSite=None; Secure
SESSION_COOKIE_SAMESITE = "None" if SESSION_COOKIE_SECURE else "Lax"
FRONTEND_DIST_DIR = os.getenv("FRONTEND_DIST_DIR", os.path.join(APP_DIR, "frontend_dist"))

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
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and "+" not in url.partition("://")[0]:
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def _postgres_url_from_settings() -> str:
    password = quote_plus(DB_PASSWORD)
    username = quote_plus(DB_USERNAME)
    return f"postgresql+psycopg2://{username}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def _sqlite_url_from_settings() -> str:
    return f"sqlite:///{DEFAULT_PRODUCTION_DB_PATH}"


def _has_explicit_postgres_settings() -> bool:
    return any(
        key in os.environ
        for key in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USERNAME", "DB_PASSWORD")
    )


PRODUCTION_DB_URL = _normalize_database_url(
    os.getenv("DATABASE_URL")
    or os.getenv("PRODUCTION_DB_URL")
    or (_postgres_url_from_settings() if _has_explicit_postgres_settings() else _sqlite_url_from_settings())
)


def _default_bootstrap_sample_data() -> bool:
    # Keep local sqlite development convenient, but start with a blank workspace
    # in production-style Postgres deployments such as Railway.
    return PRODUCTION_DB_URL.startswith("sqlite")


BOOTSTRAP_SAMPLE_DATA = os.getenv(
    "BOOTSTRAP_SAMPLE_DATA",
    "true" if _default_bootstrap_sample_data() else "false",
).lower() == "true"

DEFAULT_SIM_CONFIG = {
    'order_variance': 18,
    'restock_threshold': 1200,
    'restock_amount': 1700,
    'lookback_weeks': 4,
}
