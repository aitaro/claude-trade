#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/claude-trade"
cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building frontend..."
pnpm --filter web exec vite build

echo "==> Syncing DB schema..."
pnpm exec drizzle-kit push

echo "==> Restarting infrastructure..."
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d

echo "==> Restarting application services..."
sudo systemctl restart claude-trade-api
sudo systemctl restart claude-trade-scheduler

echo "==> Reloading Caddy..."
sudo systemctl reload caddy

echo "==> Deploy complete!"
sudo systemctl status claude-trade-api claude-trade-scheduler oauth2-proxy caddy --no-pager -l
