from pathlib import Path

from pydantic_settings import BaseSettings


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Paths
    project_root: Path = PROJECT_ROOT
    prompts_dir: Path = PROJECT_ROOT / "prompts"
    strategies_dir: Path = PROJECT_ROOT / "strategies"
    trading_engine_dir: Path = PROJECT_ROOT / "trading-engine"

    # Claude
    model: str = "claude-sonnet-4-6"
    max_turns: int = 50

    # MCP Server
    mcp_server_command: str = "uv"
    mcp_server_dir: str = str(PROJECT_ROOT / "mcp-server")

    # Markets to enable (comma-separated)
    enabled_markets: str = "us,jp,eu,uk"

    model_config = {
        "env_file": str(PROJECT_ROOT / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
