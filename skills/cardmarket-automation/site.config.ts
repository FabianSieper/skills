export const config = {
  name: 'cardmarket-automation',
  version: 1,
  configured: true,
  baseURL: 'https://www.cardmarket.com',
  allowedOrigins: ['https://www.cardmarket.com'],
  requiresLogin: false,
  locale: 'en-GB',
  timezoneId: 'Europe/Berlin',
  timeoutMs: 15_000,
  actionBudgetMs: 90_000,
  planTtlMs: 600_000,
  maxInputBytes: 65_536,

  // Runtime invariant: the user's browser is already open. Never launch another browser.
  browser: {
    session: 'cardmarket-automation',
    attach: { mode: 'extension' as const, target: 'chrome' },
    cliCommand: 'playwright-cli'
  }
};