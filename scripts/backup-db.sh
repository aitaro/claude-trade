#!/usr/bin/env bash
# PostgreSQL DB バックアップ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

mkdir -p "$BACKUP_DIR"

source "$PROJECT_DIR/.env" 2>/dev/null || true

FILENAME="claude_trade_$(date +%Y%m%d_%H%M%S).sql.gz"

docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-claude_trade}" "${POSTGRES_DB:-claude_trade}" \
    | gzip > "$BACKUP_DIR/$FILENAME"

echo "[BACKUP] Created: $BACKUP_DIR/$FILENAME"

# 30日以上前のバックアップを削除
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "[BACKUP] Cleaned up old backups"
