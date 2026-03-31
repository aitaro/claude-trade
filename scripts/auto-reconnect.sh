#!/bin/sh
# IB Gateway の "Existing session detected" ダイアログを自動で "Reconnect This Session" する
# IBC が scenario 6 で Cancel を選んでしまう問題を回避するため、
# xdotool でダイアログを検知して Reconnect ボタンをクリックする

export DISPLAY=:1

echo "[auto-reconnect] Starting dialog monitor..."

while true; do
    # "Existing session detected" ウィンドウを検索
    WIN_ID=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)

    if [ -n "$WIN_ID" ]; then
        echo "[auto-reconnect] $(date -u) Detected dialog (window $WIN_ID)"

        # ダイアログをフォーカスし、Reconnect ボタンをクリック
        # "Reconnect This Session" は左側のボタン。ダイアログの左下付近をクリック。
        # ダイアログサイズを取得してボタン位置を推定
        xdotool windowactivate --sync "$WIN_ID" 2>/dev/null
        sleep 0.3

        # ウィンドウのジオメトリを取得
        GEOM=$(xdotool getwindowgeometry "$WIN_ID" 2>/dev/null)
        WIN_X=$(echo "$GEOM" | grep "Position" | sed 's/.*Position: \([0-9]*\),.*/\1/')
        WIN_Y=$(echo "$GEOM" | grep "Position" | sed 's/.*,\([0-9]*\) .*/\1/')
        WIN_W=$(echo "$GEOM" | grep "Geometry" | sed 's/.*Geometry: \([0-9]*\)x.*/\1/')
        WIN_H=$(echo "$GEOM" | grep "Geometry" | sed 's/.*x\([0-9]*\)/\1/')

        if [ -n "$WIN_W" ] && [ -n "$WIN_H" ]; then
            # Reconnect ボタンは左下 (幅の1/3, 高さの85%あたり)
            BTN_X=$((WIN_X + WIN_W / 3))
            BTN_Y=$((WIN_Y + WIN_H * 85 / 100))
            echo "[auto-reconnect] $(date -u) Clicking at ($BTN_X, $BTN_Y) [window ${WIN_W}x${WIN_H} at ${WIN_X},${WIN_Y}]"
            xdotool mousemove "$BTN_X" "$BTN_Y" click 1 2>/dev/null
        else
            # フォールバック: Tab で Reconnect ボタンにフォーカスして Enter
            echo "[auto-reconnect] $(date -u) Fallback: Tab+Enter"
            xdotool key --window "$WIN_ID" Tab Return 2>/dev/null
        fi

        sleep 5

        # ダイアログがまだ残っていたらもう一度試す (別の方法)
        STILL=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)
        if [ -n "$STILL" ]; then
            echo "[auto-reconnect] $(date -u) Dialog still open, trying Enter key"
            xdotool windowactivate --sync "$STILL" 2>/dev/null
            xdotool key --window "$STILL" Return 2>/dev/null
            sleep 3
        fi
    fi

    sleep 1
done
