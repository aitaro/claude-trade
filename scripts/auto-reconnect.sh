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
        echo "[auto-reconnect] $(date -u) Detected 'Existing session detected' dialog (window $WIN_ID)"
        sleep 1

        # ダイアログをアクティブにして "Reconnect This Session" ボタンをクリック
        # ボタンはダイアログ左下にある。Tab + Enter で最初のボタン (Reconnect) を押す
        xdotool windowactivate "$WIN_ID" 2>/dev/null
        sleep 0.5
        # Reconnect ボタンにフォーカスがあるはずなので Enter を押す
        xdotool key --window "$WIN_ID" Return 2>/dev/null

        echo "[auto-reconnect] $(date -u) Clicked Reconnect button"
        sleep 5
    fi

    sleep 1
done
