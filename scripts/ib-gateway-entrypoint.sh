#!/bin/sh
# IB Gateway のラッパー: 再起動時に一定時間待ってから起動する
# 初回起動はすぐ、2回目以降（セッション競合で切断された場合等）は待機

DELAY_FILE="/tmp/.ib-gateway-started"
DELAY_SECONDS="${IB_RESTART_DELAY:-180}"

if [ -f "$DELAY_FILE" ]; then
    echo "[ib-gateway] Restart detected. Waiting ${DELAY_SECONDS}s before reconnecting..."
    sleep "$DELAY_SECONDS"
fi

touch "$DELAY_FILE"
exec /home/ibgateway/scripts/run.sh "$@"
