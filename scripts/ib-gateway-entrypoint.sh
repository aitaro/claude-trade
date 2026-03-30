#!/bin/sh
# IB Gateway のラッパー
# - IBC 終了後もコンテナを維持 (VNC でアクセス可能にする)
# - 再起動間隔を確保してセッション衝突ループを防ぐ
# - IBC config.ini.tmpl をパッチ

# config.ini.tmpl の SecondFactorAuthenticationTimeout を 0 にパッチ
# 0 = 無期限待機: IBC の内部タイマーが発火しないため Attempt 2 が起動しない
TMPL="/home/ibgateway/ibc/config.ini.tmpl"
if [ -f "$TMPL" ]; then
    sed -i 's/^SecondFactorAuthenticationTimeout=180/SecondFactorAuthenticationTimeout=0/' "$TMPL"
    # IB Key (IBKR Mobile) を 2FA デバイスとして指定
    # これがないと IBC が 2FA ダイアログを認識せず、サーバー側で 2FA 未完了のまま 180 秒で切断される
    sed -i 's/^SecondFactorDevice=/SecondFactorDevice=IBKR Mobile/' "$TMPL"
    echo "[ib-gateway] Patched config.ini.tmpl: SecondFactorAuthenticationTimeout=0, SecondFactorDevice=IBKR Mobile"
fi

# run.sh を実行 (VNC + Xvfb + IBC を起動)
# exec しない: run.sh 終了後もコンテナを維持するため
/home/ibgateway/scripts/run.sh "$@"
EXIT_CODE=$?

echo "[ib-gateway] run.sh exited with code $EXIT_CODE"

# IBC が終了しても VNC を維持して手動ログインを可能にする
# Docker の restart policy がコンテナを再起動するまでの間、
# セッションがサーバー上から消えるのを待つ (300秒)
WAIT_SECONDS="${IB_RESTART_DELAY:-300}"
echo "[ib-gateway] Waiting ${WAIT_SECONDS}s for stale sessions to clear before exit..."
echo "[ib-gateway] VNC is still accessible for manual intervention."
sleep "$WAIT_SECONDS"

echo "[ib-gateway] Exiting. Docker will restart the container."
exit $EXIT_CODE
