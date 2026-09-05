export const config = {
  name: 'cardmarket-automation',
  version: 1,
  configured: true,
  baseURL: 'https://www.cardmarket.com',
  // "Search 2.0" (2026-09) removed the top-bar search form from the homepage
  // (/en); it remains on game pages, which also serve the global search.
  // This is the entry page every flow (search/price/artworks) starts from.
  searchEntry: '/en/Magic',
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