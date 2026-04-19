import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Aero-Twin Backend")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://asuser:aspass123@db:5432/aerotwin_dev",
    )


settings = Settings()
