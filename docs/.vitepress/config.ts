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
        text: "Overview",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Database", link: "/database" },
          { text: "Markets", link: "/markets" },
          { text: "Safety", link: "/safety" },
          { text: "Development", link: "/development" },
          { text: "Feedback Loop", link: "/feedback-loop" },
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
