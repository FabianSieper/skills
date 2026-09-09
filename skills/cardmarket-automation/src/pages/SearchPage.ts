import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
import { AutomationError } from '../runtime/errors.ts';
import { fillUnique } from '../runtime/guards.ts';
import { SitePage } from './SitePage.ts';
import { SearchResultsPage } from './SearchResultsPage.ts';

/**
 * The search entry carrying the global top-bar search form.
 *
 * "Search 2.0" (2026-09) removed the search form from the homepage (/en); it
 * remains on game pages (config.searchEntry, e.g. /en/Magic), which also serve
 * the global search:
 *
 *   form#searchForm  ->  GET /en/Magic/Products/Search
 *   input#ProductSearchInput (name="searchString", placeholder "Search Cardmarket...")
 *   button#search-btn (submit)
 *
 * Submitting redirects to the search results page.
 *
 * Navigation policy: forward movement only via UI interaction (the top-nav
 * game link), raw `goto` is reserved for the homepage.
 */
export class SearchPage extends SitePage {
  constructor(page: Page) {
    super(page);
  }

  /** Whether we are on a game page whose top bar carries the search form. */
  private async hasSearchForm(): Promise<boolean> {
    if (!/\/Magic/.test(this.page.url())) return false;
    const form = this.page.locator('form#searchForm');
    if ((await form.count()) !== 1) return false;
    return await form.first().isVisible().catch(() => false);
  }

  /** Click the top-nav Magic game link (UI forward navigation). */
  private async switchToMagic(): Promise<boolean> {
    const link = this.page.locator(`a[href="${config.searchEntry}"], a[aria-label="Magic: The Gathering"]`);
    const count = await link.count();
    for (let i = 0; i < count; i++) {
      const candidate = link.nth(i);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      await candidate.click().catch(() => {});
      await this.page.waitForURL(/\/Magic/, { timeout: 15_000 }).catch(() => {});
      await this.waitForCloudflare();
      if (await this.hasSearchForm()) return true;
    }
    return false;
  }

  /** Navigate to the search entry (a game page that still carries the form). */
  async openSearchEntry(): Promise<void> {
    if (await this.hasSearchForm()) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await this.goHome();
      }
      if (await this.switchToMagic()) return;
    }
    if (await this.hasSearchForm()) return;
    throw new AutomationError('UI_DRIFT', 'search-entry');
  }

  /** Type the query, submit, wait for the results page. */
  async search(query: string): Promise<SearchResultsPage> {
    await this.openSearchEntry();
    const input = this.page.locator('#ProductSearchInput');
    await fillUnique(input, query, 'search-input');
    // The top-bar submit button's Playwright click is intercepted by the site's
    // autocomplete JS (preventDefault); the native form submit is the reliable path.
    await this.page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>('form#searchForm');
      if (form) form.requestSubmit();
    });
    await this.page.waitForURL(/\/Products\/Search\?/, { timeout: 30_000 });
    await this.waitForCloudflare();
    return new SearchResultsPage(this.page);
  }
}
