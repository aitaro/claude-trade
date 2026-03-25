#!/usr/bin/env bash
# 開発環境を tmux セッションで一括起動
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

# tmux セッション作成
tmux new-session -d -s "$SESSION" -n "scheduler" -x 200 -y 50

# ── Window 0: Scheduler (上) + Docker Logs (下) ──
tmux send-keys -t "$SESSION:scheduler" "cd $PROJECT_DIR && npx tsx src/agent/main.ts scheduler" Enter
tmux split-window -v -t "$SESSION:scheduler" -p 40
tmux send-keys -t "$SESSION:scheduler.1" "cd $PROJECT_DIR && docker compose logs -f" Enter
tmux select-pane -t "$SESSION:scheduler.0"

# ── Window 1: Shell (作業用) ──
tmux new-window -t "$SESSION" -n "shell"
tmux send-keys -t "$SESSION:shell" "cd $PROJECT_DIR" Enter

# ── Window 2: DB ──
tmux new-window -t "$SESSION" -n "db"
tmux send-keys -t "$SESSION:db" "cd $PROJECT_DIR && echo 'task db:psql or task db:signals or open http://localhost:8081'" Enter

# 最初のウィンドウ (scheduler) を選択
tmux select-window -t "$SESSION:scheduler"

echo ""
echo "=== claude-trade dev environment started ==="
echo ""
echo "  tmux session: $SESSION"
echo "  Windows:"
echo "    0:scheduler  - Scheduler (上) + Docker Logs (下)"
echo "    1:shell      - 作業用シェル"
echo "    2:db         - DB操作"
echo ""
echo "  Attach: tmux attach -t $SESSION"
echo "  or:     task dev:attach"
echo ""

# アタッチ
tmux attach-session -t "$SESSION"
