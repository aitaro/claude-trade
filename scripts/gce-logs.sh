#!/usr/bin/env bash
# GCE ログを tmux 4ペインで表示
set -euo pipefail

SESSION="gce-logs"
SSH="gcloud compute ssh claude-trade --project=aitaro-claude-trade --zone=europe-west2-a --command"

tmux kill-session -t "$SESSION" 2>/dev/null || true

# 4ペインレイアウト
tmux new-session -d -s "$SESSION" -n logs \
  "$SSH 'journalctl -u claude-trade-scheduler -f -o cat --since now'"

tmux split-window -t "$SESSION" -h \
  "$SSH 'journalctl -u claude-trade-api -f -o cat --since now'"

tmux split-window -t "$SESSION:0.0" -v \
  "$SSH 'docker logs -f deploy-ib-gateway-1 --since 1m 2>&1'"

tmux split-window -t "$SESSION:0.1" -v \
  "$SSH 'docker logs -f deploy-postgres-1 --since 1m 2>&1'"

# ペインにタイトル表示
tmux select-pane -t "$SESSION:0.0" -T "scheduler"
tmux select-pane -t "$SESSION:0.1" -T "ib-gateway"
tmux select-pane -t "$SESSION:0.2" -T "api"
tmux select-pane -t "$SESSION:0.3" -T "postgres"

tmux set-option -t "$SESSION" pane-border-status top
tmux attach-session -t "$SESSION"
