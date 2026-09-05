import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
import { fillUnique } from '../runtime/guards.ts';
import { SitePage } from './SitePage.ts';
import { SearchResultsPage } from './SearchResultsPage.ts';

/**
 * The landing page carrying the global top-bar search form.
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

  async openHome(): Promise<void> {
    await this.gotoAllowed(config.baseURL);
  }

  /** Type the query, submit, wait for the results page. */
  async search(query: string): Promise<SearchResultsPage> {
    await this.openHome();
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