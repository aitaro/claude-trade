"""Claude Code SDK を使って Research Agent を実行する"""

import logging

from claude_code_sdk import ClaudeCodeOptions, ResultMessage, AssistantMessage, TextBlock, query
import claude_code_sdk._internal.message_parser as _mp
import claude_code_sdk._internal.client as _client

from agent_runner.config import settings
from agent_runner.markets import MARKETS

logger = logging.getLogger(__name__)

# SDK が未知のメッセージタイプ (rate_limit_event 等) で crash するのを防ぐ
_original_parse = _mp.parse_message


def _patched_parse(data):
    try:
        return _original_parse(data)
    except _mp.MessageParseError as e:
        if "Unknown message type" in str(e):
            logger.debug("Skipping unknown message type: %s", data.get("type"))
            return None
        raise


_mp.parse_message = _patched_parse
_client.parse_message = _patched_parse


def _build_mcp_servers() -> dict:
    """MCP サーバー設定を構築する"""
    return {
        "claude-trade": {
            "type": "stdio",
            "command": settings.mcp_server_command,
            "args": [
                "run",
                "--directory", settings.mcp_server_dir,
                "python", "-m", "claude_trade.server",
            ],
        }
    }


def _load_prompt(mode: str, market: str = "us") -> str:
    """プロンプトファイルを読み込み、マーケットコンテキストを付加する"""
    prompt_map = {
        "premarket": "premarket-analysis.md",
        "intraday": "research-loop.md",
        "eod": "eod-review.md",
    }
    filename = prompt_map.get(mode)
    if not filename:
        raise ValueError(f"Unknown mode: {mode}. Use: {list(prompt_map.keys())}")

    prompt_path = settings.prompts_dir / filename
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

    base_prompt = prompt_path.read_text(encoding="utf-8")

    # マーケット固有の戦略を読み込み、プロンプトに付加
    mkt = MARKETS[market]
    strategy_path = settings.strategies_dir / mkt.strategy_file
    strategy_content = strategy_path.read_text(encoding="utf-8")

    market_context = f"""

## 対象マーケット: {mkt.name}

- マーケットID: `{mkt.market_id}`
- タイムゾーン: {mkt.timezone}
- 取引所: {mkt.ib_exchange}
- 通貨: {mkt.ib_currency}
- シグナルの `source_strategy` には `"{mkt.market_id}"` を指定してください

## 戦略定義

```yaml
{strategy_content}
```

## MCP ツールの注意事項

- `get_quote`, `get_historical_data` には `exchange="{mkt.ib_exchange}"`, `currency="{mkt.ib_currency}"` を渡してください
- `write_signal` の `strategy` には `"{mkt.market_id}"` を指定してください

## フィードバックループ

- 分析開始時に `get_relevant_lessons(source_strategy="{mkt.market_id}")` で過去の学びを確認してください
- 過去の学びに基づいて分析の重点を調整してください
- `get_signal_accuracy(source_strategy="{mkt.market_id}")` でシグナル精度の傾向を把握してください
- EOD Review 時は `evaluate_signal` で各シグナルの事後評価を、`record_lesson` で学びの記録を行ってください
"""
    return base_prompt + market_context


async def run_research(mode: str, market: str = "us") -> dict:
    """Research Agent を実行する

    Args:
        mode: "premarket", "intraday", or "eod"
        market: "us", "jp", or "eu"

    Returns:
        実行結果のサマリー
    """
    prompt = _load_prompt(mode, market)
    logger.info("Starting %s research for %s market", mode, market.upper())

    options = ClaudeCodeOptions(
        allowed_tools=["mcp__claude-trade__*", "WebSearch", "WebFetch"],
        mcp_servers=_build_mcp_servers(),
        model=settings.model,
        max_turns=settings.max_turns,
        permission_mode="bypassPermissions",
        cwd=str(settings.project_root),
    )

    result_text = ""
    session_id = ""
    total_cost = None

    try:
        async for message in query(prompt=prompt, options=options):
            if message is None:
                continue
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        logger.info("[%s/%s] %s", market.upper(), mode, block.text[:200])
            elif isinstance(message, ResultMessage):
                result_text = message.result or ""
                session_id = message.session_id
                total_cost = message.total_cost_usd
                logger.info(
                    "[%s/%s] Completed: turns=%d, cost=$%s, duration=%dms",
                    market.upper(), mode,
                    message.num_turns,
                    message.total_cost_usd,
                    message.duration_ms,
                )
    except Exception:
        logger.exception("[%s/%s] SDK error during research", market.upper(), mode)

    return {
        "mode": mode,
        "market": market,
        "session_id": session_id,
        "result": result_text,
        "total_cost_usd": total_cost,
    }
