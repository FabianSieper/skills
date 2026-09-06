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

  /** The "next page" arrow. Enabled = has an href and is not `disabled`. */
  private get nextControl() {
    return this.page.locator('a.pagination-control[data-direction="next"]');
  }

  private async readTile(i: number): Promise<SearchCard> {
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
    return {
      name: data.name,
      set: data.set,
      image: data.image,
      fromPrice: data.fromPrice,
      url: resolveHref(data.href),
    };
  }

  /** True when a further results page exists (next arrow enabled). */
  async hasNextPage(): Promise<boolean> {
    if (await this.nextControl.count() === 0) return false;
    return this.nextControl.evaluate(
      (el) =>
        !el.className.includes('disabled') &&
        Boolean(el.getAttribute('href')),
    );
  }

  /** Follow the next arrow (via its href) and wait for the new tiles. */
  async goToNext(): Promise<boolean> {
    if (await this.nextControl.count() === 0) return false;
    const href = await this.nextControl.getAttribute('href');
    if (!href || (await this.nextControl.evaluate((el) => el.className.includes('disabled')))) {
      return false;
    }
    await this.gotoAllowed(href);
    await this.page.waitForSelector('a.galleryBox', { timeout: 30_000 });
    return true;
  }

  /**
   * Read up to `limit` result tiles into structured data, spanning as many
   * pages as needed (~30 tiles per page). Dedupes by detail URL.
   */
  async extractCards(limit: number): Promise<SearchCard[]> {
    const out: SearchCard[] = [];
    const seen = new Set<string>();
    for (;;) {
      const remaining = limit - out.length;
      if (remaining <= 0) break;
      const count = Math.min(remaining, await this.tiles.count());
      for (let i = 0; i < count; i++) {
        const card = await this.readTile(i);
        if (seen.has(card.url)) continue;
        seen.add(card.url);
        out.push(card);
      }
      if (out.length >= limit) break;
      if (!(await this.hasNextPage())) break;
      await this.goToNext();
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

  async tileCount(): Promise<number> {
    return this.tiles.count();
  }

  async query(): Promise<string> {
    const url = this.page.url();
    const marker = 'searchString=';
    const start = url.indexOf(marker);
    if (start === -1) return '';
    const valueStart = start + marker.length;
    const amp = url.indexOf('&', valueStart);
    const raw = amp === -1 ? url.slice(valueStart) : url.slice(valueStart, amp);
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  }
}