#!/usr/bin/env bash
# Stage 1: Research Agent を実行する
# Usage: ./scripts/run-research.sh [premarket|intraday|eod]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MODE="${1:-intraday}"

cd "$PROJECT_DIR"

# 市場確認 (premarket は市場前なのでスキップ)
if [ "$MODE" != "premarket" ]; then
    if ! python scripts/is_market_open.py; then
        echo "[RESEARCH] Market is closed. Skipping."
        exit 0
    fi
fi

echo "[RESEARCH] Starting $MODE research at $(date)"

PROMPT_FILE="prompts/${MODE}-analysis.md"
if [ "$MODE" = "intraday" ]; then
    PROMPT_FILE="prompts/research-loop.md"
fi

if [ ! -f "$PROMPT_FILE" ]; then
    echo "[RESEARCH] Prompt file not found: $PROMPT_FILE"
    exit 1
fi

# Claude Code を agent モードで実行
claude -p "$(cat "$PROMPT_FILE")" \
    --allowedTools "mcp__claude-trade__*,WebSearch,WebFetch" \
    2>&1 | tee -a "logs/research-${MODE}-$(date +%Y%m%d-%H%M%S).log"

echo "[RESEARCH] $MODE research completed at $(date)"
