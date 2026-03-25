#!/usr/bin/env bash
# EOD (End of Day) レビューを実行する

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "[EOD] Starting end-of-day review at $(date)"

claude -p "$(cat prompts/eod-review.md)" \
    --allowedTools "mcp__claude-trade__*,WebSearch,WebFetch" \
    2>&1 | tee -a "logs/eod-review-$(date +%Y%m%d).log"

echo "[EOD] Review completed at $(date)"
