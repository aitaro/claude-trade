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

# SecondFactorAuthenticationTimeout=0 にパッチ
# デフォルト値 180 のままだと、2FA が不要なアカウントでも 180 秒後に
# IBC が強制的に Attempt 2 を開始してセッション競合ループが発生する。
# 0 = 無期限待機: タイマーが発火しないため Attempt 2 が起動しない。
(
    i=0
    while [ $i -lt 30 ]; do
        if [ -f /home/ibgateway/ibc/config.ini ]; then
            sed -i 's/^SecondFactorAuthenticationTimeout=180$/SecondFactorAuthenticationTimeout=0/' \
                /home/ibgateway/ibc/config.ini
            echo "[ib-gateway] Patched SecondFactorAuthenticationTimeout=0"
            break
        fi
        sleep 1
        i=$((i + 1))
    done
) &

exec /home/ibgateway/scripts/run.sh "$@"
