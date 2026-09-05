import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
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
 */
export class SearchPage extends SitePage {
  constructor(page: Page) {
    super(page);
  }

  /** Navigate to the search entry (a game page that still carries the form). */
  async openSearchEntry(): Promise<void> {
    await this.gotoAllowed(config.searchEntry);
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