#!/usr/bin/env bash
# 開発環境を tmux セッションで一括起動 (田の字レイアウト)
# 人間が後から `tmux attach -t claude-trade` or `task dev:attach` で接続可能

set -euo pipefail

SESSION="claude-trade"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# 既存セッションがあれば再利用
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session '$SESSION' already exists. Attaching..."
    tmux attach-session -t "$SESSION"
    exit 0
fi

# Docker インフラ起動
echo "Starting Docker infrastructure..."
docker compose up -d

# postgres の healthcheck 待ち
echo "Waiting for PostgreSQL..."
until docker compose exec postgres pg_isready -U claude_trade > /dev/null 2>&1; do
    sleep 1
done
echo "PostgreSQL ready."

# ┌──────────────┬──────────────┐
# │  Scheduler   │   API Server │
# ├──────────────┼──────────────┤
# │  Vite (Web)  │  Docker Logs │
# └──────────────┴──────────────┘

# セッション作成 → pane 0 (左上: Scheduler)
tmux new-session -d -s "$SESSION" -n "dev" -x 200 -y 50
tmux send-keys -t "$SESSION:dev" "cd $PROJECT_DIR && npx tsx packages/server/src/agent/main.ts scheduler" Enter

# 右に分割 → pane 1 (右上: API Server)
tmux split-window -h -t "$SESSION:dev"
tmux send-keys -t "$SESSION:dev" "cd $PROJECT_DIR && npx tsx packages/server/src/api/server.ts" Enter

# 右上ペインを下に分割 → pane 2 (右下: Docker Logs)
tmux split-window -v -t "$SESSION:dev"
tmux send-keys -t "$SESSION:dev" "cd $PROJECT_DIR && docker compose logs -f --tail=50" Enter

# 左上ペイン (pane 0) を選択して下に分割 → pane 3 (左下: Vite)
tmux select-pane -t "$SESSION:dev.0"
tmux split-window -v -t "$SESSION:dev"
tmux send-keys -t "$SESSION:dev" "cd $PROJECT_DIR/packages/web && npx vite" Enter

# 左上ペインにフォーカス
tmux select-pane -t "$SESSION:dev.0"

echo ""
echo "=== claude-trade dev environment started ==="
echo ""
echo "  ┌──────────────┬──────────────┐"
echo "  │  Scheduler   │  API :3100   │"
echo "  ├──────────────┼──────────────┤"
echo "  │  Vite :5173  │  Docker Logs │"
echo "  └──────────────┴──────────────┘"
echo ""
echo "  Dashboard: http://localhost:5173"
echo "  pgweb:     http://localhost:8081"
echo ""

# アタッチ
tmux attach-session -t "$SESSION"
