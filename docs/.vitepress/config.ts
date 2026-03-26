import { defineConfig } from "vitepress";

export default defineConfig({
  ignoreDeadLinks: true,
  title: "Claude Trade",
  description: "AI Trading Platform Documentation",
  lang: "ja",
  themeConfig: {
    nav: [
      { text: "Dashboard", link: "https://trade.aitaro.dev" },
    ],
    sidebar: [
      {
        text: "System",
        items: [
          { text: "Architecture", link: "/system/architecture" },
          { text: "Database", link: "/system/database" },
          { text: "Markets", link: "/system/markets" },
          { text: "Safety", link: "/system/safety" },
          { text: "Feedback Loop", link: "/system/feedback-loop" },
        ],
      },
      {
        text: "Infrastructure",
        items: [
          { text: "Overview", link: "/infra/overview" },
        ],
      },
      {
        text: "Development",
        items: [
          { text: "Development Guide", link: "/development" },
        ],
      },
      {
        text: "ADR",
        items: [
          { text: "001 TypeScript Migration", link: "/adr/001-typescript-migration" },
          { text: "002 ORM Selection", link: "/adr/002-orm-selection" },
          { text: "003 IB Client Library", link: "/adr/003-ib-client-library" },
          { text: "004 Logging Library", link: "/adr/004-logging-library" },
        ],
      },
    ],
    outline: "deep",
    search: { provider: "local" },
  },
});
