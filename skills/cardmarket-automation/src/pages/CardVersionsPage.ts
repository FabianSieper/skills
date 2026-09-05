import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
import { uniqueVisible } from '../runtime/guards.ts';
import { SitePage } from './SitePage.ts';
import { CardDetailPage } from './CardDetailPage.ts';
import type { Artwork } from '../types.ts';
import { resolveHref } from '../lib/url.ts';

/**
 * Card "Versions" page:
 *   /en/Magic/Cards/<Card>/Versions
 *
 * Lists every printing / artwork of a card. Each tile is a link (a.card) to
 * that printing's product detail page:
 *
 *   a.card[href*="/Products/Singles/"]  ->  /en/Magic/Products/Singles/<Set>/<Card>[-V<n>]
 *     img.is-front                    -> artwork image (alt = card name)
 *     h3 > span.expansion-symbol      -> set name (aria-label)
 *     p (may be empty)                -> "Version N"
 *     p                               -> "N Available"
 *     p                               -> "From X €"
 *
 * The full list is rendered on one page (no pagination).
 */
export class CardVersionsPage extends SitePage {
  constructor(page: Page) {
    super(page);
  }

  private get tiles() {
    return this.page.locator('a.card[href*="/Products/Singles/"]');
  }

  /** Read every version / artwork tile into structured data. */
  async listArtworks(): Promise<Artwork[]> {
    const raw = await this.page.evaluate(() => {
      const tiles = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a.card[href*="/Products/Singles/"]',
        ),
      );
      return tiles.map((a) => {
        const href = a.getAttribute('href') ?? '';
        const img = a.querySelector('img');
        const set =
          a.querySelector('h3 span.expansion-symbol')?.getAttribute('aria-label') ||
          a.querySelector('h3 span.text-start')?.textContent?.trim() ||
          '';
        const ps = Array.from(a.querySelectorAll('p')).map(
          (p) => p.textContent?.trim() ?? '',
        );
        return {
          href,
          imgAlt: img?.getAttribute('alt') ?? '',
          imgSrc: img?.getAttribute('src') ?? '',
          set,
          ps,
        };
      });
    });

    return raw.map((t) => {
      // ps: [version?, "N Available", "From X €"]  (version may be "")
      const avail = t.ps.find((s) => /Available/i.test(s)) ?? '';
      const from = t.ps.find((s) => /^From /i.test(s)) ?? '';
      const version =
        t.ps.find((s) => /^Version \d+$/i.test(s)) || t.ps[0] || '';
      return {
        card: t.imgAlt.replace(/\s*\(V\.\d+\)$/, '').trim(),
        set: t.set,
        version,
        available: avail,
        fromPrice: from,
        image: t.imgSrc,
        url: resolveHref(t.href),
      };
    });
  }

  /** Open artwork `index` (0-based) and move to its product detail page. */
  async openArtwork(index: number): Promise<CardDetailPage> {
    const tile = this.tiles.nth(index);
    await tile.waitFor({ state: 'visible', timeout: 30_000 });
    await tile.click();
    await this.page.waitForURL(/\/Products\/Singles\//, { timeout: 30_000 });
    await this.waitForCloudflare();
    return new CardDetailPage(this.page);
  }

  /** Read the "N versions" count from the page heading. */
  async totalFromHeading(): Promise<number> {
    const h1 = await uniqueVisible(this.page.locator('h1'), 'versions-heading');
    const text = await h1.innerText();
    const m = text.match(/(\d[\d\s]*)\s*versions?/i);
    if (!m) return 0;
    return parseInt(m[1]!.replace(/\s+/g, ''), 10) || 0;
  }
}