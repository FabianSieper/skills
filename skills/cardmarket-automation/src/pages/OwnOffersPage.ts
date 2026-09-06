import type { Locator, Page } from 'playwright';
import { config } from '../../site.config.ts';
import { parseQty } from '../lib/parse.ts';
import { resolveHref } from '../lib/url.ts';
import { AutomationError } from '../runtime/errors.ts';
import { clickUnique, fillUnique, uniqueVisible } from '../runtime/guards.ts';
import type { OwnOffer, OwnOfferFilter, OwnOfferFilterState } from '../types.ts';
import { SitePage } from './SitePage.ts';
import { CardDetailPage } from './CardDetailPage.ts';

type FilterField = keyof OwnOfferFilterState;

const FIELD_SELECTORS: Record<FilterField, string> = {
  cardName: 'input[name="name"]',
  expansion: 'select[name="idExpansion"]',
  rarity: 'select[name="idRarity"]',
  condition: 'select[name="condition"]',
  language: 'select[name="idLanguage"]',
  comments: 'input[name="comments"]',
  minPrice: 'input[name="minPrice"]',
  maxPrice: 'input[name="maxPrice"]',
  minQuantity: 'input[name="minAmt"]',
  foil: 'select[name="isFoil"]',
  signed: 'select[name="isSigned"]',
  altered: 'select[name="isAltered"]',
  sort: 'select[name="sortBy"]',
};

/**
 * Selling → My Offers → Singles.
 *
 * The stock view is authenticated and has a distinct table (`#UserOffersTable`)
 * from the seller rows on a product page. The left-side filter is intentionally
 * modelled by the page object so callers never need to use raw selectors.
 */
export class OwnOffersPage extends SitePage {
  constructor(page: Page) {
    super(page);
  }

  private get table(): Locator {
    return this.page.locator('#UserOffersTable');
  }

  private get rows(): Locator {
    return this.table.locator('.table-body .article-row');
  }

  /** The page has one stock-filter form (index 3); the global header search is form index 2. */
  private get filterForm(): Locator {
    return this.page.locator('form').nth(3);
  }

  /** Cardmarket's next control at the bottom of the stock table. */
  private get nextControl(): Locator {
    return this.page.locator('main a.pagination-control[data-direction="next"]').first();
  }

  async open(): Promise<void> {
    await this.gotoAllowed(config.ownOffersEntry);
    await uniqueVisible(this.table, 'own-offers-table', 30_000);
  }

  async hasFilterForm(): Promise<boolean> {
    return (await this.filterForm.count()) === 1;
  }

  private async requiredFilterControl(field: FilterField): Promise<Locator> {
    return uniqueVisible(this.filterForm.locator(FIELD_SELECTORS[field]), `own-offers-filter-${field}`);
  }

  async readCurrentFilter(): Promise<OwnOfferFilterState> {
    if (!(await this.hasFilterForm())) throw new AutomationError('UI_DRIFT', 'own-offers-filter-form');
    const values = await this.filterForm.locator(FIELD_SELECTORS.cardName).all();
    const cardName = values.length > 0 ? await values[0].inputValue() : '';
    const expansion = (await this.filterForm.locator(FIELD_SELECTORS.expansion).first().innerText()) ?? '';
    const rarity = (await this.filterForm.locator(FIELD_SELECTORS.rarity).first().innerText()) ?? '';
    const condition = (await this.filterForm.locator(FIELD_SELECTORS.condition).first().innerText()) ?? '';
    const language = (await this.filterForm.locator(FIELD_SELECTORS.language).first().innerText()) ?? '';
    const comments = (await this.filterForm.locator(FIELD_SELECTORS.comments).first().inputValue()) ?? '';
    const minPrice = (await this.filterForm.locator(FIELD_SELECTORS.minPrice).first().inputValue()) ?? '';
    const maxPrice = (await this.filterForm.locator(FIELD_SELECTORS.maxPrice).first().inputValue()) ?? '';
    const minQuantity = (await this.filterForm.locator(FIELD_SELECTORS.minQuantity).first().inputValue()) ?? '';
    const foil = (await this.filterForm.locator(FIELD_SELECTORS.foil).first().innerText()) ?? '';
    const signed = (await this.filterForm.locator(FIELD_SELECTORS.signed).first().innerText()) ?? '';
    const altered = (await this.filterForm.locator(FIELD_SELECTORS.altered).first().innerText()) ?? '';
    const sort = (await this.filterForm.locator(FIELD_SELECTORS.sort).first().innerText()) ?? '';
    return { cardName, expansion, rarity, condition, language, comments, minPrice, maxPrice, minQuantity, foil, signed, altered, sort } as OwnOfferFilterState;
  }

  private async setSelectByVisibleLabel(field: FilterField, label: string): Promise<boolean> {
    const control = await this.requiredFilterControl(field);
    const selected = await control.locator('option:checked').innerText();
    if (selected.replace(/\s+/g, ' ').trim().toLocaleLowerCase() === label.trim().toLocaleLowerCase()) return false;
    const options = await control.locator('option').evaluateAll((nodes) =>
      nodes.map((option) => ({
        value: (option as HTMLOptionElement).value,
        label: (option.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    );
    const wanted = label.trim().toLocaleLowerCase();
    const target = options.find((option) => {
      const candidate = option.label.toLocaleLowerCase();
      return candidate === wanted || (wanted === 'any' && ['all', '--', ''].includes(candidate));
    });
    if (!target) throw new AutomationError('INVALID_INPUT', `own-offers-filter-${field}`);
    await control.selectOption(target.value, { timeout: 15_000 });
    return true;
  }

  async applyFilters(filter: OwnOfferFilter): Promise<boolean> {
    if (!(await this.hasFilterForm())) throw new AutomationError('UI_DRIFT', 'own-offers-filter-form');
    let changed = false;
    const textFields: Array<keyof Pick<OwnOfferFilter, 'cardName' | 'comments'>> = ['cardName', 'comments'];
    for (const field of textFields) {
      const value = filter[field];
      if (value === undefined) continue;
      try {
        const control = await this.requiredFilterControl(field);
        if ((await control.inputValue()) !== value) {
          await fillUnique(control, value, `own-offers-filter-${field}`);
          changed = true;
        }
      } catch {
        // Control not visible; skip.
      }
    }
    const numberFields: Array<keyof Pick<OwnOfferFilter, 'minPrice' | 'maxPrice' | 'minQuantity'>> = ['minPrice', 'maxPrice', 'minQuantity'];
    for (const field of numberFields) {
      const value = filter[field];
      if (value === undefined) continue;
      try {
        const control = await this.requiredFilterControl(field);
        const text = String(value);
        if ((await control.inputValue()) !== text) {
          await fillUnique(control, text, `own-offers-filter-${field}`);
          changed = true;
        }
      } catch {
        // Control not visible; skip.
      }
    }
    const selectFields: FilterField[] = ['expansion', 'rarity', 'condition', 'language', 'foil', 'signed', 'altered', 'sort'];
    for (const field of selectFields) {
      const value = filter[field as keyof OwnOfferFilter];
      if (value === undefined) continue;
      try {
        if (await this.setSelectByVisibleLabel(field, String(value))) changed = true;
      } catch {
        // Control not visible; skip.
      }
    }
    return changed;
  }

  async submitFilters(): Promise<void> {
    if (!(await this.hasFilterForm())) throw new AutomationError('UI_DRIFT', 'own-offers-filter-form');
    const button = this.filterForm.locator('button[type="submit"], input[type="submit"]');
    const [navigation] = await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null),
      clickUnique(button, 'own-offers-filter-submit', 15_000),
    ]);
    if (!navigation) await this.page.waitForTimeout(300);
    await this.waitForCloudflare();
    await uniqueVisible(this.table, 'own-offers-table', 30_000);
  }

  private async readRow(index: number): Promise<OwnOffer> {
    const row = this.rows.nth(index);
    const offer = await row.evaluate((element) => {
      const query = (selector: string) => element.querySelector(selector);
      const link = query('.col-seller a[href*="/Products/Singles/"]') as HTMLAnchorElement | null;
      const edit = query('a[data-modal*="idArticle="]') as HTMLAnchorElement | null;
      const id = (edit?.getAttribute('data-modal') ?? '').match(/[?&]idArticle=(\d+)/)?.[1] ?? '';
      const condition = query('.article-condition');
      return {
        articleId: Number(id),
        card: link?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        href: link?.getAttribute('href') ?? '',
        condition: condition?.getAttribute('data-bs-original-title') ?? condition?.textContent?.trim() ?? '',
        language: query('.product-attributes span[aria-label]')?.getAttribute('aria-label') ?? '',
        price: query('.col-offer .price-container .color-primary, .mobile-offer-container .color-primary')?.textContent?.trim() ?? '',
        quantity: query('.item-count')?.textContent?.trim() ?? '',
      };
    });
    if (offer.articleId <= 0 || !offer.card || !offer.href) throw new AutomationError('UI_DRIFT', 'own-offers-row');
    return { ...offer, cardUrl: resolveHref(offer.href), quantity: parseQty(offer.quantity) };
  }

  async offersOnCurrentPage(limit: number): Promise<OwnOffer[]> {
    await uniqueVisible(this.table, 'own-offers-table');
    const count = await this.rows.count();
    const offers: OwnOffer[] = [];
    for (let index = 0; index < Math.min(count, limit); index++) offers.push(await this.readRow(index));
    return offers;
  }

  async hasNextPage(): Promise<boolean> {
    const count = await this.nextControl.count();
    if (count === 0) return false;
    if (count !== 1) throw new AutomationError('AMBIGUOUS_SELECTOR', 'own-offers-next');
    return this.nextControl.evaluate((element) =>
      !element.className.includes('disabled') && Boolean(element.getAttribute('href')),
    );
  }

  async goToNextPage(): Promise<boolean> {
    if (!(await this.hasNextPage())) return false;
    const href = await this.nextControl.getAttribute('href');
    if (!href) throw new AutomationError('UI_DRIFT', 'own-offers-next');
    await this.gotoAllowed(href);
    await uniqueVisible(this.table, 'own-offers-table', 30_000);
    return true;
  }

  /**
   * `all=true` follows every enabled bottom navigation control and intentionally
   * leaves the browser on the last page. It checks that the site's navigation
   * did not discard the active filter between pages.
   */
  async extractOffers(limit: number, all: boolean): Promise<{ offers: OwnOffer[]; pagesVisited: number; complete: boolean }> {
    const baselineFilter = await this.readCurrentFilter();
    const offers: OwnOffer[] = [];
    const seen = new Set<number>();
    let pagesVisited = 0;
    for (;;) {
      pagesVisited++;
      const remaining = all ? Number.MAX_SAFE_INTEGER : Math.max(0, limit - offers.length);
      const currentPageRows = await this.rowCount();
      const readOnCurrentPage = Math.min(currentPageRows, remaining);
      for (const offer of await this.offersOnCurrentPage(readOnCurrentPage)) {
        if (seen.has(offer.articleId)) continue;
        seen.add(offer.articleId);
        offers.push(offer);
      }
      const hasNext = await this.hasNextPage();
      if (!all || !hasNext)
        return { offers, pagesVisited, complete: !hasNext && (all || readOnCurrentPage === currentPageRows) };
      await this.goToNextPage();
      if (JSON.stringify(await this.readCurrentFilter()) !== JSON.stringify(baselineFilter))
        throw new AutomationError('UI_DRIFT', 'own-offers-filter-lost-on-pagination');
    }
  }

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  async openOffer(index: number): Promise<CardDetailPage> {
    const row = this.rows.nth(index);
    const link = row.locator('.col-seller a[href*="/Products/Singles/"]');
    await clickUnique(link, 'own-offers-card-link', 30_000);
    await this.page.waitForURL(/\/Products\/Singles\//, { timeout: 30_000 });
    await this.waitForCloudflare();
    return new CardDetailPage(this.page);
  }
}
