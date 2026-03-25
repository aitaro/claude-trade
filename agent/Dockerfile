FROM python:3.13-slim

# Claude Code CLI が必要
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

# Node.js (Claude Code CLI 依存)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# uv (MCP server の起動に必要)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# MCP server の依存をインストール
COPY mcp-server/pyproject.toml mcp-server/
RUN cd mcp-server && uv sync --no-dev

# Trading engine の依存をインストール
COPY trading-engine/pyproject.toml trading-engine/
RUN cd trading-engine && uv sync --no-dev

# Agent の依存をインストール
COPY agent/pyproject.toml agent/
RUN cd agent && uv sync --no-dev

# ソースコードをコピー
COPY mcp-server/src/ mcp-server/src/
COPY trading-engine/src/ trading-engine/src/
COPY agent/src/ agent/src/
COPY prompts/ prompts/
COPY strategies/ strategies/

# 非 root ユーザーで実行 (Claude Code が root を拒否するため)
RUN useradd -m -s /bin/bash agent
RUN chown -R agent:agent /app
USER agent

WORKDIR /app/agent

CMD ["uv", "run", "python", "-m", "agent_runner.main", "scheduler"]
