#!/bin/sh
# IB Gateway の "Existing session detected" ダイアログを自動で "Continue Login" する
# IBC の ExistingSessionDetectedAction=manual と組み合わせて使用
# xdotool でダイアログを検知して Continue Login ボタンをクリックする

export DISPLAY=:1

echo "[auto-reconnect] Starting dialog monitor..."

while true; do
    # "Existing session detected" ウィンドウを検索
    WIN_ID=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)

    if [ -n "$WIN_ID" ]; then
        echo "[auto-reconnect] $(date -u) Detected dialog (window $WIN_ID)"

        # "Continue Login" ボタンをクリック
        # Xvfb は 1024x768。ダイアログ内のボタン位置を windowfocus + mousemove で直接クリック
        # ウィンドウマネージャがないので windowactivate は使えない
        xdotool windowfocus "$WIN_ID" 2>/dev/null
        sleep 0.3

        # ウィンドウのジオメトリから Continue Login ボタンの絶対座標を計算
        GEOM=$(xdotool getwindowgeometry "$WIN_ID" 2>/dev/null)
        WIN_X=$(echo "$GEOM" | grep "Position" | sed 's/.*Position: \([0-9]*\),.*/\1/')
        WIN_Y=$(echo "$GEOM" | grep "Position" | sed 's/.*,\([0-9]*\) .*/\1/')
        WIN_W=$(echo "$GEOM" | grep "Geometry" | sed 's/.*Geometry: \([0-9]*\)x.*/\1/')
        WIN_H=$(echo "$GEOM" | grep "Geometry" | sed 's/.*x\([0-9]*\)/\1/')

        if [ -n "$WIN_W" ] && [ -n "$WIN_H" ]; then
            # Continue Login ボタンは左寄り、ダイアログ下部
            # ダイアログ幅の 35% 地点、高さの 75% 地点あたり
            BTN_X=$((WIN_X + WIN_W * 35 / 100))
            BTN_Y=$((WIN_Y + WIN_H * 75 / 100))
            echo "[auto-reconnect] $(date -u) Click ($BTN_X, $BTN_Y) [win ${WIN_W}x${WIN_H} at ${WIN_X},${WIN_Y}]"
            xdotool mousemove "$BTN_X" "$BTN_Y"
            sleep 0.1
            xdotool click 1
        fi

        sleep 3

        # まだダイアログがあれば別の座標を試す
        STILL=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)
        if [ -n "$STILL" ]; then
            echo "[auto-reconnect] $(date -u) Dialog persists, trying offset clicks"
            # Y をずらしながら試す
            for OFFSET in -10 0 10 20 30; do
                NEW_Y=$((BTN_Y + OFFSET))
                xdotool mousemove "$BTN_X" "$NEW_Y"
                sleep 0.1
                xdotool click 1
                sleep 1
                CHECK=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)
                if [ -z "$CHECK" ]; then
                    echo "[auto-reconnect] $(date -u) Dialog dismissed at offset $OFFSET"
                    break
                fi
            done
        else
            echo "[auto-reconnect] $(date -u) Dialog dismissed successfully"
        fi

        sleep 5
    fi

    sleep 1
done
