# インフラ構成

## 全体像

```mermaid
graph TB
    USER[ブラウザ / スマホ] -->|HTTPS| CF[Cloudflare DNS]
    CF -->|trade.aitaro.dev| CADDY
    CF -->|docs.trade.aitaro.dev| CADDY

    subgraph "GCE e2-medium (europe-west2)"
        CADDY[Caddy :443<br/>Auto SSL] -->|forward_auth| OAUTH[oauth2-proxy :4180<br/>Google OAuth]
        OAUTH -->|認証OK| CADDY

        CADDY -->|/api/*| API[tRPC API :3100<br/>systemd]
        CADDY -->|static| SPA[Dashboard SPA<br/>packages/web/dist]
        CADDY -->|static| DOCS[VitePress Docs<br/>docs/.vitepress/dist]

        API --> DB[(PostgreSQL :5432<br/>Docker)]
        SCHED[Scheduler<br/>systemd] --> API_INT[Claude Code SDK]
        SCHED --> TE[Trading Engine]
        TE --> DB
        TE --> IBG[IB Gateway :4002<br/>Docker / host network]
        API_INT --> IBG
    end

    subgraph "外部サービス"
        API_INT -->|API| ANTHROPIC[Anthropic API]
        IBG -->|TWS API| IBSRV[IB Servers<br/>hdc1 / zdc1 / ndc1]
        SCHED -->|API| FINNHUB[Finnhub]
    end

    style CADDY fill:#22c55e,color:#000
    style OAUTH fill:#f59e0b,color:#000
    style DB fill:#3b82f6,color:#fff
    style IBG fill:#10b981,color:#fff
```

## GCE インスタンス

| 項目 | 値 |
|---|---|
| プロジェクト | `aitaro-claude-trade` |
| インスタンス名 | `claude-trade` |
| ゾーン | `europe-west2-a` (London) |
| マシンタイプ | `e2-medium` (1 vCPU, 4GB RAM) |
| OS | Ubuntu 24.04 LTS |
| ディスク | 30GB pd-balanced |
| 静的 IP | `34.13.45.196` |
| 月額 | ~$30 |

## サービス一覧

| サービス | 管理 | ポート | 説明 |
|---|---|---|---|
| Caddy | systemd | 80, 443 | リバースプロキシ + 自動 SSL |
| oauth2-proxy | systemd | 4180 | Google OAuth 認証 |
| tRPC API | systemd | 3100 | バックエンド API |
| Scheduler | systemd | - | Research Agent + Trading Engine の cron 実行 |
| PostgreSQL | Docker | 5432 (localhost) | データベース |
| IB Gateway | Docker (host network) | 4002 | Interactive Brokers API |

## 認証フロー

```mermaid
sequenceDiagram
    participant U as ブラウザ
    participant C as Caddy
    participant O as oauth2-proxy
    participant G as Google OAuth
    participant A as App (API/SPA)

    U->>C: GET /
    C->>O: forward_auth /oauth2/auth
    O-->>C: 401 (未認証)
    C-->>U: 302 → /oauth2/start
    U->>O: /oauth2/start
    O-->>U: 302 → Google
    U->>G: Google ログイン
    G-->>U: 302 → /oauth2/callback
    U->>O: /oauth2/callback?code=...
    O->>O: メール許可リスト照合
    O-->>U: Set-Cookie + 302 → /
    U->>C: GET / (with cookie)
    C->>O: forward_auth /oauth2/auth
    O-->>C: 202 (認証OK)
    C->>A: proxy
    A-->>U: Dashboard HTML
```

## ドメイン構成

| ドメイン | 用途 | DNS |
|---|---|---|
| `trade.aitaro.dev` | ダッシュボード + API | Cloudflare A → 34.13.45.196 (DNS only) |
| `docs.trade.aitaro.dev` | ドキュメントサイト | Cloudflare A → 34.13.45.196 (DNS only) |

SSL 証明書は Caddy が Let's Encrypt から自動取得・自動更新。

## デプロイ

GitHub Actions で main push 時に自動デプロイ:

```mermaid
graph LR
    A[git push main] --> B[GitHub Actions]
    B -->|SSH| C[GCE instance]
    C --> D[git pull]
    D --> E[pnpm install]
    E --> F[vite build + vitepress build]
    F --> G[drizzle-kit push]
    G --> H[systemctl restart]
```

詳細は [deployment.md](./deployment.md) を参照。
