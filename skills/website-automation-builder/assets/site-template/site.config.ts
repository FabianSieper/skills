export const config = {
  name: "{{SLUG}}",
  version: 1,
  configured: false,
  baseURL: {{BASE_URL_JSON}},
  allowedOrigins: [{{ORIGIN_JSON}}],
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
    session: "{{SLUG}}",
    attach: { mode: "extension" as "extension" | "cdp", target: "chrome" },
    cliCommand: "playwright-cli",
    cliVersion: "0.1.19",
  },
};
