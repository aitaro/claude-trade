#!/bin/sh
# IB Gateway のラッパー
# - 再起動時は VNC を維持したまま待機（手動ログインの時間を確保）
# - IBC config.ini.tmpl をパッチ

# config.ini.tmpl の SecondFactorAuthenticationTimeout を 0 にパッチ
# 0 = 無期限待機: IBC の内部タイマーが発火しないため Attempt 2 が起動しない
TMPL="/home/ibgateway/ibc/config.ini.tmpl"
if [ -f "$TMPL" ]; then
    sed -i 's/^SecondFactorAuthenticationTimeout=180$/SecondFactorAuthenticationTimeout=0/' "$TMPL"
    echo "[ib-gateway] Patched SecondFactorAuthenticationTimeout=0 in config.ini.tmpl"
fi

exec /home/ibgateway/scripts/run.sh "$@"
