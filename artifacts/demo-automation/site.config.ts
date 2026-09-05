export const config = {
  name: "demo-automation",
  version: 1,
  configured: true,
  baseURL: "http://127.0.0.1:4173/",
  allowedOrigins: ["http://127.0.0.1:4173"],
  requiresLogin: false,
  locale: "de-DE",
  timezoneId: "Europe/Berlin",
  timeoutMs: 15_000,
  actionBudgetMs: 90_000,
  planTtlMs: 600_000,
  maxInputBytes: 65_536,
  maxOutputBytes: 16_384,
  maxBundleBytes: 1_048_576,
  maxCliBytes: 2_097_152,

  // Runtime invariant: the user's browser is already open. Never launch another browser.
  browser: {
    session: "demo-automation",
    attach: { mode: "extension" as "extension" | "cdp", target: "chrome" },
    cliCommand: "playwright-cli",
    cliVersion: "0.1.19",
  },
};
