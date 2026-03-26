#!/usr/bin/env bash
# GCE ログを tmux 4ペインで表示 (JSON を整形)
set -euo pipefail

SESSION="gce-logs"
SSH="gcloud compute ssh claude-trade --project=aitaro-claude-trade --zone=europe-west2-a --command"

# pino JSON を 1行で見やすく整形する jq フィルタ
# 出力例: 16:01:47 INFO [scheduler] Starting trading engine markets=us,uk
JQ_FMT='def c: if .severity == "ERROR" then "\u001b[31m"
  elif .severity == "WARNING" then "\u001b[33m"
  else "\u001b[32m" end;
(.time[11:19]) + " " + c + (.severity // "INFO") + "\u001b[0m" + " \u001b[1m[" + (.scope // "-") + "]\u001b[0m " + (.msg // "") + " " + "\u001b[2m" + (del(.severity,.time,.pid,.hostname,.scope,.msg) | to_entries | map(.key + "=" + (.value | tostring)) | join(" ")) + "\u001b[0m"'

tmux kill-session -t "$SESSION" 2>/dev/null || true

# 4ペインレイアウト
tmux new-session -d -s "$SESSION" -n logs \
  "$SSH 'journalctl -u claude-trade-scheduler -f -o cat --since now' | jq -r '$JQ_FMT' 2>/dev/null || $SSH 'journalctl -u claude-trade-scheduler -f -o cat --since now'"

tmux split-window -t "$SESSION" -h \
  "$SSH 'journalctl -u claude-trade-api -f -o cat --since now' | jq -r '$JQ_FMT' 2>/dev/null || $SSH 'journalctl -u claude-trade-api -f -o cat --since now'"

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
