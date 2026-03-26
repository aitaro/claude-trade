#!/usr/bin/env bash
# 開発環境を tmux セッションで一括起動
# GCE の PostgreSQL + IB Gateway に SSH トンネルで接続

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

# ┌──────────────┬──────────────┐
# │  SSH Tunnel  │   API Server │
# ├──────────────┼──────────────┤
# │  Vite (Web)  │   Shell      │
# └──────────────┴──────────────┘

# セッション作成 → pane 0 (左上: SSH Tunnel)
tmux new-session -d -s "$SESSION" -n "dev" -x 200 -y 50
tmux send-keys -t "$SESSION:dev" "echo '==> SSH Tunnel to GCE (PostgreSQL:5432 + IB Gateway:4002)' && gcloud compute ssh claude-trade --project=aitaro-claude-trade --zone=europe-west2-a -- -L 5432:localhost:5432 -L 4002:localhost:4002 -N" Enter

# 右に分割 → pane 1 (右上: API Server)
tmux split-window -h -t "$SESSION:dev"
tmux send-keys -t "$SESSION:dev" "sleep 3 && cd $PROJECT_DIR && pnpm exec tsx --watch packages/server/src/api/server.ts" Enter

# 右上ペインを下に分割 → pane 2 (右下: Shell)
tmux split-window -v -t "$SESSION:dev"
tmux send-keys -t "$SESSION:dev" "cd $PROJECT_DIR" Enter

# 左上ペイン (pane 0) を選択して下に分割 → pane 3 (左下: Vite)
tmux select-pane -t "$SESSION:dev.0"
tmux split-window -v -t "$SESSION:dev"
tmux send-keys -t "$SESSION:dev" "sleep 3 && cd $PROJECT_DIR/packages/web && pnpm exec vite" Enter

# ペインにタイトル表示
tmux select-pane -t "$SESSION:dev.0" -T "SSH Tunnel"
tmux select-pane -t "$SESSION:dev.1" -T "Vite :5173"
tmux select-pane -t "$SESSION:dev.2" -T "API :3100"
tmux select-pane -t "$SESSION:dev.3" -T "Shell"
tmux set-option -t "$SESSION" pane-border-status top

# 右下のシェルにフォーカス
tmux select-pane -t "$SESSION:dev.3"

echo ""
echo "=== claude-trade dev environment started ==="
echo ""
echo "  ┌──────────────┬──────────────┐"
echo "  │  SSH Tunnel  │  API :3100   │"
echo "  ├──────────────┼──────────────┤"
echo "  │  Vite :5173  │  Shell       │"
echo "  └──────────────┴──────────────┘"
echo ""
echo "  Dashboard: http://localhost:5173"
echo "  DB/IB: via SSH tunnel to GCE"
echo ""
echo "  task research -- intraday --market us"
echo ""

# アタッチ
tmux attach-session -t "$SESSION"
