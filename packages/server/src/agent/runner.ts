/** Claude Code SDK を使って Research Agent を実行する */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type McpStdioServerConfig,
  type SDKAssistantMessage,
  type SDKMessage,
  type SDKResultMessage,
  query,
} from "@anthropic-ai/claude-code";
import { PROJECT_ROOT, loadEnv } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { MARKETS } from "./markets.js";

const env = loadEnv();
const PROMPTS_DIR = resolve(PROJECT_ROOT, "prompts");
const STRATEGIES_DIR = resolve(PROJECT_ROOT, "strategies");

function buildMcpServers(): Record<string, McpStdioServerConfig> {
  return {
    "claude-trade": {
      type: "stdio",
      command: "npx",
      args: ["tsx", resolve(PROJECT_ROOT, "packages/server/src/mcp-server/server.ts")],
    },
  };
}

function loadPrompt(mode: string, market = "us"): string {
  const promptMap: Record<string, string> = {
    premarket: "premarket-analysis.md",
    intraday: "research-loop.md",
    eod: "eod-review.md",
  };

  const filename = promptMap[mode];
  if (!filename) {
    throw new Error(`Unknown mode: ${mode}. Use: ${Object.keys(promptMap).join(", ")}`);
  }

  const promptPath = resolve(PROMPTS_DIR, filename);
  const basePrompt = readFileSync(promptPath, "utf-8");

  const mkt = MARKETS[market];
  if (!mkt) throw new Error(`Unknown market: ${market}`);

  const strategyContent = readFileSync(resolve(STRATEGIES_DIR, mkt.strategyFile), "utf-8");

  const marketContext = `

## 対象マーケット: ${mkt.name}

- マーケットID: \`${mkt.marketId}\`
- タイムゾーン: ${mkt.timezone}
- 取引所: ${mkt.ibExchange}
- 通貨: ${mkt.ibCurrency}
- シグナルの \`source_strategy\` には \`"${mkt.marketId}"\` を指定してください

## 戦略定義

\`\`\`yaml
${strategyContent}
\`\`\`

## MCP ツールの注意事項

- \`get_quote\`, \`get_historical_data\` には \`exchange="${mkt.ibExchange}"\`, \`currency="${mkt.ibCurrency}"\` を渡してください
- \`write_signal\` の \`strategy\` には \`"${mkt.marketId}"\` を指定してください

## フィードバックループ

- 分析開始時に \`get_relevant_lessons(source_strategy="${mkt.marketId}")\` で過去の学びを確認してください
- 過去の学びに基づいて分析の重点を調整してください
- \`get_signal_accuracy(source_strategy="${mkt.marketId}")\` でシグナル精度の傾向を把握してください
- EOD Review 時は \`evaluate_signal\` で各シグナルの事後評価を、\`record_lesson\` で学びの記録を行ってください
`;

  return basePrompt + marketContext;
}

export async function runResearch(
  mode: string,
  market = "us",
): Promise<{
  mode: string;
  market: string;
  sessionId: string;
  result: string;
  totalCostUsd: number | null;
}> {
  const log = createLogger("research", market.toUpperCase(), mode);
  const prompt = loadPrompt(mode, market);
  log.info("Starting research");

  let resultText = "";
  let sessionId = "";
  let totalCost: number | null = null;

  try {
    const conversation = query({
      prompt,
      options: {
        allowedTools: ["mcp__claude-trade__*", "WebSearch", "WebFetch"],
        mcpServers: buildMcpServers(),
        model: env.MODEL,
        maxTurns: env.MAX_TURNS,
        permissionMode: "bypassPermissions",
        cwd: PROJECT_ROOT,
      },
    });

    for await (const message of conversation) {
      if (message == null) continue;

      const msg = message as SDKMessage;
      if (msg.type === "assistant") {
        const assistantMsg = msg as SDKAssistantMessage;
        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            if (block.type === "text" && "text" in block) {
              log.info((block as { text: string }).text.slice(0, 200));
            }
          }
        }
      } else if (msg.type === "result") {
        const resultMsg = msg as SDKResultMessage;
        if ("result" in resultMsg) {
          resultText = resultMsg.result ?? "";
        }
        sessionId = resultMsg.session_id;
        totalCost = resultMsg.total_cost_usd;
        log.info(
          {
            turns: resultMsg.num_turns,
            cost: resultMsg.total_cost_usd,
            durationMs: resultMsg.duration_ms,
          },
          "Research completed",
        );
      }
    }
  } catch (e) {
    log.error({ err: e }, "SDK error during research");
  }

  return {
    mode,
    market,
    sessionId,
    result: resultText,
    totalCostUsd: totalCost,
  };
}
