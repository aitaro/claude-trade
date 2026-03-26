#!/usr/bin/env bash
# One-time setup for a fresh GCE Ubuntu instance
set -euo pipefail

echo "==> System packages..."
sudo apt-get update
sudo apt-get install -y curl git jq

echo "==> Docker..."
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"

echo "==> Node.js 22 (NodeSource)..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

echo "==> Caddy..."
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy

echo "==> oauth2-proxy..."
OAUTH2_PROXY_VERSION="7.7.1"
wget -q "https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v${OAUTH2_PROXY_VERSION}/oauth2-proxy-v${OAUTH2_PROXY_VERSION}.linux-amd64.tar.gz"
tar xzf "oauth2-proxy-v${OAUTH2_PROXY_VERSION}.linux-amd64.tar.gz"
sudo mv "oauth2-proxy-v${OAUTH2_PROXY_VERSION}.linux-amd64/oauth2-proxy" /usr/local/bin/
rm -rf "oauth2-proxy-v${OAUTH2_PROXY_VERSION}.linux-amd64"*

echo "==> Claude Code CLI..."
sudo npm install -g @anthropic-ai/claude-code

echo "==> Application user & directory..."
sudo useradd -r -m -s /bin/bash claude-trade || true
sudo mkdir -p /opt/claude-trade
sudo chown claude-trade:claude-trade /opt/claude-trade

echo "==> Caddy log directory..."
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy

echo "==> Install systemd services..."
sudo cp /opt/claude-trade/deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable claude-trade-api claude-trade-scheduler oauth2-proxy caddy

echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Clone repo to /opt/claude-trade"
echo "  2. Set up GCP OAuth (console) and update deploy/oauth2-proxy.cfg"
echo "  3. Add allowed emails to deploy/allowed-emails.txt"
echo "  4. Set DOMAIN env var for Caddy: echo 'DOMAIN=trade.yourdomain.com' | sudo tee /etc/caddy/env"
echo "  5. Copy Caddyfile: sudo cp /opt/claude-trade/deploy/Caddyfile /etc/caddy/Caddyfile"
echo "  6. Run deploy/pull-secrets.sh"
echo "  7. Run deploy/deploy.sh"
