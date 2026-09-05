import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
import { SitePage } from './SitePage.ts';
import { CardDetailPage } from './CardDetailPage.ts';
import type { SearchCard } from '../types.ts';
import { resolveHref } from '../lib/url.ts';

/**
 * Search results page:
 *   /en/Magic/Products/Search?category=-1&searchString=<q>&searchMode=v2
 *
 * Every result tile IS the anchor:  a.galleryBox
 *   href      -> detail url  /en/Magic/Products/Singles/<Set>/<Card>
 *   img       -> card image (alt = card name)
 *   .card-title -> name + set symbol (span.expansion-symbol[aria-label])
 *   text      -> "From <price>"
 * ~30 tiles per page.
 */
export class SearchResultsPage extends SitePage {
  constructor(page: Page) {
    super(page);
  }

  private get tiles() {
    return this.page.locator('a.galleryBox');
  }

  /** Read up to `limit` visible result tiles into structured data. */
  async extractCards(limit: number): Promise<SearchCard[]> {
    const count = Math.min(limit, await this.tiles.count());
    const out: SearchCard[] = [];
    for (let i = 0; i < count; i++) {
      const data = await this.tiles.nth(i).evaluate((el) => {
        const a = el as HTMLAnchorElement;
        return {
          href: a.getAttribute('href') ?? '',
          image: a.querySelector('img')?.getAttribute('src') ?? '',
          name: a.querySelector('.card-title')?.textContent?.trim() ?? '',
          set:
            a.querySelector('.card-title .expansion-symbol[aria-label]')
              ?.getAttribute('aria-label') ?? '',
          fromPrice:
            (a.textContent ?? '').match(/From [^\n]+/i)?.[0]?.trim() ?? '',
        };
      });
      out.push({
        name: data.name,
        set: data.set,
        image: data.image,
        fromPrice: data.fromPrice,
        url: resolveHref(data.href),
      });
    }
    return out;
  }

  /** Open result tile `index` (0-based) and move to its detail page. */
  async openCard(index: number): Promise<CardDetailPage> {
    const tile = this.tiles.nth(index);
    await tile.waitFor({ state: 'visible', timeout: 30_000 });
    await tile.click();
    await this.page.waitForURL(/\/Products\/Singles\//, { timeout: 30_000 });
    await this.waitForCloudflare();
    return new CardDetailPage(this.page);
  }

  /** Jump straight to a detail url (absolute or relative). */
  async openByUrl(url: string): Promise<CardDetailPage> {
    const abs = resolveHref(url);
    await this.gotoAllowed(abs);
    return new CardDetailPage(this.page);
  }
}