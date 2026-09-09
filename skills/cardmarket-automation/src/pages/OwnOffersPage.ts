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

  /**
   * Identify the stock-filter form by its content, not by index: the logged-in
   * page holds only `form#searchForm` and the (id-less) stock-filter form, so a
   * fixed form index is wrong as soon as the logged-out login form disappears.
   */
  private get filterForm(): Locator {
    return this.page.locator('form').filter({ has: this.page.locator('select[name="idLanguage"]') });
  }

  /** Confirm that the stock surface, not merely its URL, is rendered. */
  async waitUntilReady(timeoutMs = 30_000): Promise<void> {
    await uniqueVisible(this.table, 'own-offers-table', timeoutMs);
  }

  /**
   * Open the own-offers Singles view through the site's own UI:
   *   1. already on the view -> done
   *   2. account menu (Selling -> My Offers) -> overview, then the Singles tab
   *   3. home fallback (only allowed raw goto) -> retry the account menu
   */
  async open(): Promise<void> {
    if (await this.tableVisible()) {
      await this.waitUntilReady();
      return;
    }
    if (await this.enterFromMenu()) {
      await this.ensureSinglesView();
      await this.waitUntilReady();
      if (await this.tableVisible()) return;
    }
    await this.goHome();
    await this.enterFromMenu();
    await this.ensureSinglesView();
    await this.waitUntilReady();
  }

  private async tableVisible(): Promise<boolean> {
    const table = this.table;
    return (await table.count()) === 1 && (await table.isVisible().catch(() => false));
  }

  private async enterFromMenu(): Promise<boolean> {
    const myOffers = this.myOffersItem;
    if ((await myOffers.count()) >= 1 && (await myOffers.first().isVisible().catch(() => false))) {
      await myOffers.first().click();
      await this.waitUntilReady();
      return true;
    }
    const selling = this.sellingToggle;
    if ((await selling.count()) !== 1) return false;
    await selling.click();
    if ((await myOffers.count()) >= 1 && (await myOffers.first().isVisible().catch(() => false))) {
      await myOffers.first().click();
      await this.waitUntilReady();
      return true;
    }
    return false;
  }

  private async ensureSinglesView(): Promise<void> {
    const path = new URL(this.page.url()).pathname;
    if (path.endsWith(config.ownOffersEntry)) return;
    const tab = this.page.locator(`a[href="${config.ownOffersEntry}"]`);
    await tab.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    if ((await tab.count()) === 1) await tab.click();
  }

  private get sellingToggle(): Locator {
    return this.page.locator('a.dropdown-toggle', { hasText: 'Selling' });
  }

  private get myOffersItem(): Locator {
    return this.page.locator('.account-menu a', { hasText: 'My Offers' });
  }

  async hasFilterForm(): Promise<boolean> {
    return (await this.filterForm.count()) === 1;
  }

  private async requiredFilterControl(field: FilterField): Promise<Locator> {
    return uniqueVisible(this.filterForm.locator(FIELD_SELECTORS[field]), `own-offers-filter-${field}`);
  }

  async readCurrentFilter(): Promise<OwnOfferFilterState> {
    if (!(await this.hasFilterForm())) throw new AutomationError('UI_DRIFT', 'own-offers-filter-form');
    const textValue = async (field: FilterField): Promise<string> => {
      const control = await this.requiredFilterControl(field);
      return (await control.inputValue()).trim();
    };
    const selectedLabel = async (field: FilterField): Promise<string> => {
      const control = await this.requiredFilterControl(field);
      const selected = control.locator('option:checked');
      if (await selected.count() !== 1) throw new AutomationError('UI_DRIFT', `own-offers-filter-${field}-selected`);
      return (await selected.innerText()).replace(/\s+/g, ' ').trim();
    };
    const cardName = await textValue('cardName');
    const expansion = await selectedLabel('expansion');
    const rarity = await selectedLabel('rarity');
    const condition = await selectedLabel('condition');
    const language = await selectedLabel('language');
    const comments = await textValue('comments');
    const minPrice = await textValue('minPrice');
    const maxPrice = await textValue('maxPrice');
    const minQuantity = await textValue('minQuantity');
    const foil = await selectedLabel('foil');
    const signed = await selectedLabel('signed');
    const altered = await selectedLabel('altered');
    const sort = await selectedLabel('sort');
    return { cardName, expansion, rarity, condition, language, comments, minPrice, maxPrice, minQuantity, foil, signed, altered, sort } as OwnOfferFilterState;
  }

  private async setSelectByVisibleLabel(field: FilterField, label: string): Promise<boolean> {
    const control = await this.requiredFilterControl(field);
    const selectedOption = control.locator('option:checked');
    if (await selectedOption.count() !== 1) throw new AutomationError('UI_DRIFT', `own-offers-filter-${field}-selected`);
    const selected = await selectedOption.innerText();
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
      const control = await this.requiredFilterControl(field);
      if ((await control.inputValue()) !== value) {
        await fillUnique(control, value, `own-offers-filter-${field}`);
        changed = true;
      }
    }
    const numberFields: Array<keyof Pick<OwnOfferFilter, 'minPrice' | 'maxPrice' | 'minQuantity'>> = ['minPrice', 'maxPrice', 'minQuantity'];
    for (const field of numberFields) {
      const value = filter[field];
      if (value === undefined) continue;
      const control = await this.requiredFilterControl(field);
      const text = String(value);
      if ((await control.inputValue()) !== text) {
        await fillUnique(control, text, `own-offers-filter-${field}`);
        changed = true;
      }
    }
    const selectFields: FilterField[] = ['expansion', 'rarity', 'condition', 'language', 'foil', 'signed', 'altered', 'sort'];
    for (const field of selectFields) {
      const value = filter[field as keyof OwnOfferFilter];
      if (value === undefined) continue;
      if (await this.setSelectByVisibleLabel(field, String(value))) changed = true;
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
    if (!navigation) {
      const settled = await this.page
        .waitForFunction(() => !Boolean(document.querySelector('#UserOffersTable .loader, #UserOffersTable .spinner')), null, { timeout: 15_000, polling: 250 })
        .then(() => true)
        .catch(() => false);
      if (!settled) throw new AutomationError('TIMEOUT', 'own-offers-filter-settle');
    }
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

  /**
   * Resolve the page-level next control. Cardmarket renders the stock
   * pagination OUTSIDE `#UserOffersTable`, and the view carries the control
   * twice per page (above AND below the table) with identical hrefs. The
   * lookup therefore operates on the whole page and tolerates exactly 0, 1,
   * or 2 matches; a disabled control means "no next page", mismatched hrefs
   * or any other count is ambiguous (selector drift).
   */
  private async readNextControl(): Promise<Locator | null> {
    const controls = this.page.locator('a.pagination-control[data-direction="next"]');
    const count = await controls.count();
    if (count === 0) return null;
    if (count > 2) throw new AutomationError('AMBIGUOUS_SELECTOR', 'own-offers-next');
    const states = await controls.evaluateAll((nodes) =>
      nodes.map((node) => {
        const element = node as HTMLAnchorElement;
        return {
          href: element.href ?? null,
          disabled: element.className.includes('disabled') || element.hasAttribute('disabled'),
        };
      }),
    );
    if (states.some((state) => state.disabled || state.href === null)) return null;
    const hrefs = new Set(states.map((state) => state.href));
    if (hrefs.size !== 1) throw new AutomationError('AMBIGUOUS_SELECTOR', 'own-offers-next');
    return controls.last();
  }

  async hasNextPage(): Promise<boolean> {
    return (await this.readNextControl()) !== null;
  }

  async goToNextPage(): Promise<boolean> {
    const next = await this.readNextControl();
    if (next === null) return false;
    await next.click();
    await this.waitUntilReady();
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

  /**
   * Find the row index of an offer by its articleId, reading the modal trigger
   * (`data-modal` carries `idArticle=<articleId>`) instead of guessing from
   * positional order.
   */
  async rowIndexFor(articleId: number): Promise<number | null> {
    const found = await this.page.evaluate((articleId: number) => {
      const rows = Array.from(document.querySelectorAll('#UserOffersTable .table-body .article-row a[data-modal]'));
      return rows.findIndex((row) => {
        const match = /idArticle=(\d+)/.exec(row.getAttribute('data-modal') ?? '');
        return match !== null && Number(match[1]) === articleId;
      });
    }, articleId);
    return found >= 0 ? found : null;
  }

  /**
   * Open the detail page of a specific offer by clicking its row link - the
   * only compliant way into a detail page (raw `goto` is home-only).
   * Throws UI_DRIFT when the row is not on the current page.
   */
  async openOfferById(articleId: number): Promise<CardDetailPage> {
    const index = await this.rowIndexFor(articleId);
    if (index === null)
      throw new AutomationError('UI_DRIFT', `offer-row-${articleId}`);
    return this.openOffer(index);
  }
}
