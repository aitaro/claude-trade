#!/usr/bin/env bash
set -euo pipefail

cd /opt/claude-trade

get_secret() { gcloud secrets versions access latest --secret="$1" --project=aitaro-claude-trade 2>/dev/null; }

cat > .env <<EOF
NODE_ENV=production

# PostgreSQL
POSTGRES_USER=claude_trade
POSTGRES_PASSWORD=$(get_secret ct-postgres-password)
POSTGRES_DB=claude_trade
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# IB Gateway
TWS_USERID=$(get_secret ct-tws-userid)
TWS_PASSWORD=$(get_secret ct-tws-password)
IB_HOST=127.0.0.1
IB_PORT=4002
IB_CLIENT_ID=1

# API
API_PORT=3100
FINNHUB_API_KEY=$(get_secret ct-finnhub-api-key)
ANTHROPIC_API_KEY=$(get_secret ct-anthropic-api-key)

# Agent
MODEL=claude-sonnet-4-6
MAX_TURNS=50
ENABLED_MARKETS=us,jp,eu,uk

# Risk
MAX_POSITION_PCT=10.0
MAX_DAILY_ORDERS=20
DAILY_LOSS_LIMIT_PCT=3.0
LIVE_TRADING_ENABLED=false
EOF

# oauth2-proxy secrets
get_secret ct-oauth2-client-secret > deploy/.oauth2-client-secret
get_secret ct-oauth2-cookie-secret > deploy/.oauth2-cookie-secret
chmod 600 .env deploy/.oauth2-client-secret deploy/.oauth2-cookie-secret

echo "Secrets pulled and .env generated."
