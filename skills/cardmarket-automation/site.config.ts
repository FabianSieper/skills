export const config = {
  name: 'cardmarket-automation',
  version: 1,
  configured: true,
  baseURL: 'https://www.cardmarket.com',
  // "Search 2.0" (2026-09) removed the top-bar search form from the homepage
  // (/en); it remains on game pages, which also serve the global search.
  // This is the entry page every flow (search/price/artworks) starts from.
  searchEntry: '/en/Magic',
  homeEntry: '/en',
  // Authenticated user stock. This is the destination behind
  // Selling → My Offers → Singles.
  ownOffersEntry: '/en/Magic/Stock/Offers/Singles',
  allowedOrigins: ['https://www.cardmarket.com'],
  requiresLogin: false,
  locale: 'en-GB',
  timezoneId: 'Europe/Berlin',
  timeoutMs: 15_000,
  // Bounded action deadline; human login/consent is handled outside the runtime.
  actionBudgetMs: 240_000,
  // Bounded wait for the one-time extension handoff after a fresh or stale attach.
  attachWaitMs: 90_000,
  planTtlMs: 600_000,
  // A lock whose owner process is dead (or whose age exceeds this generous bound) is
  // reaped so a crashed/killed run does not wedge the CLI into permanent BUSY.
  lockStaleMs: 600_000,
  maxInputBytes: 65_536,

  // Runtime invariant: the user's browser is already open. Never launch another browser.
  browser: {
    // Shared session name (user-global rule): one relay/tab group for all browsing agents, no new tabs.
    session: 'chrome',
    attach: { mode: 'extension' as const, target: 'chrome' },
    cliCommand: 'playwright-cli'
  }
};
