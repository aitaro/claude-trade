#!/usr/bin/env bash
# Stage 2: Deterministic Trading Engine を実行する

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# 市場確認
if ! python scripts/is_market_open.py; then
    echo "[TRADING] Market is closed. Skipping."
    exit 0
fi

echo "[TRADING] Starting trading engine at $(date)"

cd trading-engine
uv run python -m trading_engine.main \
    2>&1 | tee -a "../logs/trading-$(date +%Y%m%d-%H%M%S).log"

echo "[TRADING] Trading engine completed at $(date)"
