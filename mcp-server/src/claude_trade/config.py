from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL
    postgres_user: str = "claude_trade"
    postgres_password: str = "change_me_in_production"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "claude_trade"

    # IB Gateway
    ib_host: str = "127.0.0.1"
    ib_port: int = 4002
    ib_client_id: int = 1

    # Finnhub
    finnhub_api_key: str = ""

    # Risk
    max_position_pct: float = 10.0
    max_daily_orders: int = 20
    daily_loss_limit_pct: float = 3.0
    live_trading_enabled: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
