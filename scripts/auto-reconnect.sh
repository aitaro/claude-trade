#!/bin/sh
# IB Gateway の "Existing session detected" ダイアログを自動で "Continue Login" する
# IBC の ExistingSessionDetectedAction=manual と組み合わせて使用
# xdotool でダイアログを検知して Continue Login ボタンをクリックする

export DISPLAY=:1

echo "[auto-reconnect] Starting dialog monitor..."

while true; do
    WIN_ID=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)

    if [ -n "$WIN_ID" ]; then
        echo "[auto-reconnect] $(date -u) Detected dialog (window $WIN_ID)"

        xdotool windowfocus "$WIN_ID" 2>/dev/null
        sleep 0.3

        GEOM=$(xdotool getwindowgeometry "$WIN_ID" 2>/dev/null)
        WIN_X=$(echo "$GEOM" | grep "Position" | sed 's/.*Position: \([0-9]*\),.*/\1/')
        WIN_Y=$(echo "$GEOM" | grep "Position" | sed 's/.*,\([0-9]*\) .*/\1/')
        WIN_W=$(echo "$GEOM" | grep "Geometry" | sed 's/.*Geometry: \([0-9]*\)x.*/\1/')
        WIN_H=$(echo "$GEOM" | grep "Geometry" | sed 's/.*x\([0-9]*\)/\1/')

        if [ -n "$WIN_W" ] && [ -n "$WIN_H" ]; then
            # "Continue Login" ボタンの座標:
            # X = ウィンドウ中央 (WIN_X + WIN_W/2)
            # Y = ウィンドウ下端 + 少しはみ出し (WIN_Y + WIN_H - 37)
            # Java Swing のダイアログはボタンパネルがジオメトリに含まれない場合がある
            BTN_X=$((WIN_X + WIN_W / 2))
            BTN_Y=$((WIN_Y + WIN_H - 37))

            echo "[auto-reconnect] $(date -u) Click ($BTN_X, $BTN_Y)"
            xdotool mousemove "$BTN_X" "$BTN_Y"
            sleep 0.1
            xdotool click 1
            sleep 2

            # 確認
            CHECK=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)
            if [ -z "$CHECK" ]; then
                echo "[auto-reconnect] $(date -u) Dialog dismissed"
            else
                echo "[auto-reconnect] $(date -u) Dialog persists, scanning Y"
                for OFFSET in -20 -10 0 10 20 30 40; do
                    TRY_Y=$((BTN_Y + OFFSET))
                    xdotool mousemove "$BTN_X" "$TRY_Y"
                    sleep 0.1
                    xdotool click 1
                    sleep 1
                    CHECK=$(xdotool search --name "Existing session detected" 2>/dev/null | head -1)
                    if [ -z "$CHECK" ]; then
                        echo "[auto-reconnect] $(date -u) Dismissed at offset $OFFSET"
                        break
                    fi
                done
            fi
        fi

        sleep 5
    fi

    sleep 1
done
