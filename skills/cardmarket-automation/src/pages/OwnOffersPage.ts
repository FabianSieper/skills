import type { Locator, Page } from 'playwright';
import { config } from '../../site.config.ts';
import { parseQty, normalizeName } from '../lib/parse.ts';
import { resolveHref } from '../lib/url.ts';
import { AutomationError } from '../runtime/errors.ts';
import { clickUnique, fillUnique, uniqueVisible } from '../runtime/guards.ts';
import type { OwnOffer, OwnOfferFilter, OwnOfferFilterState } from '../types.ts';
import { SitePage } from './SitePage.ts';
import { CardDetailPage, type OfferFormState } from './CardDetailPage.ts';

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
    const cardName = values.length > 0 && values[0] ? await values[0].inputValue() : '';
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
    if (!navigation) {
      await this.page
        .waitForFunction(() => !Boolean(document.querySelector('#UserOffersTable .loader, #UserOffersTable .spinner')), null, { timeout: 15_000, polling: 250 })
        .catch(() => {});
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

  private get editModal(): Locator {
    return this.page.locator('#modal .modal-content');
  }

  private get editForm(): Locator {
    return this.page.locator('#modal form[data-ajax-action="Article_EditSingleArticle"]');
  }

  async setCardNameFilter(cardName: string): Promise<boolean> {
    if (!(await this.hasFilterForm())) throw new AutomationError('UI_DRIFT', 'own-offers-filter-form');
    const changed = await this.applyFilters({ cardName });
    if (changed) await this.submitFilters();
    return changed;
  }

  async searchOffers(limit: number): Promise<OwnOffer[]> {
    const safe = Number.isFinite(limit) ? Math.floor(limit) : 0;
    const clamped = Math.max(0, Math.min(1000, safe));
    if (clamped === 0) return [];
    const result = await this.extractOffers(clamped, false);
    return result.offers;
  }

  private async rowIndexOfArticleId(articleId: number): Promise<number> {
    await uniqueVisible(this.table, 'own-offers-table');
    const count = await this.rows.count();
    for (let index = 0; index < count; index++) {
      const id = await this.rows.nth(index).evaluate((element) => {
        const link = element.querySelector('a[data-modal*="idArticle="]') as HTMLAnchorElement | null;
        return Number((link?.getAttribute('data-modal') ?? '').match(/[?&]idArticle=(\d+)/)?.[1] ?? '0');
      });
      if (id === articleId) return index;
    }
    return -1;
  }

  async readRowByArticleId(articleId: number): Promise<OwnOffer | null> {
    const index = await this.rowIndexOfArticleId(articleId);
    if (index === -1) return null;
    try {
      return await this.readRow(index);
    } catch {
      return null;
    }
  }

  private async findOfferOnCurrentFilter(cardName: string, articleId?: number): Promise<OwnOffer | null> {
    const baselineFilter = await this.readCurrentFilter();
    const wantedName = normalizeName(cardName);
    const seen = new Set<number>();
    for (;;) {
      const before = seen.size;
      for (const offer of await this.offersOnCurrentPage(Number.MAX_SAFE_INTEGER)) {
        if (seen.has(offer.articleId)) continue;
        seen.add(offer.articleId);
        if (articleId !== undefined ? offer.articleId === articleId : normalizeName(offer.card) === wantedName) return offer;
      }
      if (seen.size >= 1000) throw new AutomationError('UI_DRIFT', 'own-offers-search-limit');
      if (seen.size === before) return null;
      if (!(await this.hasNextPage())) return null;
      await this.goToNextPage();
      if (JSON.stringify(await this.readCurrentFilter()) !== JSON.stringify(baselineFilter))
        throw new AutomationError('UI_DRIFT', 'own-offers-filter-lost-on-pagination');
    }
  }

  async focusOffer(cardName: string, articleId?: number, reset = true): Promise<OwnOffer> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if ((reset && attempt === 0) || (!reset && attempt === 1)) await this.open();
      await this.setCardNameFilter(cardName);
      const found = await this.findOfferOnCurrentFilter(cardName, articleId);
      if (found) return found;
    }
    throw new AutomationError('UI_DRIFT', 'own-offer-focus');
  }

  async openEditModal(articleId: number): Promise<void> {
    const index = await this.rowIndexOfArticleId(articleId);
    if (index === -1) throw new AutomationError('UI_DRIFT', 'own-offer-edit-row');
    const link = this.rows.nth(index).locator('a[data-modal*="idArticle="]');
    if ((await link.count()) !== 1) throw new AutomationError('UI_DRIFT', 'own-offer-edit-link');
    await link.click({ timeout: 15_000 });
    await uniqueVisible(this.editModal, 'own-offer-modal', 30_000);
    await uniqueVisible(this.editForm, 'own-offer-form', 30_000);
    await this.page
      .waitForFunction(() => Boolean(document.querySelector('#modal form[data-ajax-action="Article_EditSingleArticle"] input[name="idArticle"]')), null, {
        timeout: 30_000,
      })
      .catch(() => {});
    const hidden = await this.editForm.locator('input[name="idArticle"]').first().inputValue().catch(() => '0');
    if (Number(hidden) !== articleId) throw new AutomationError('UI_DRIFT', 'own-offer-form-id');
  }

  async readEditForm(articleId: number): Promise<OfferFormState> {
    if ((await this.editForm.count()) !== 1) throw new AutomationError('UI_DRIFT', 'own-offer-form');
    const state = await this.editForm.evaluate((form: Element) => {
      const select = (name: string) => (form.querySelector(`select[name="${name}"]`) as HTMLSelectElement | null);
      const input = (name: string) => (form.querySelector(`input[name="${name}"]`) as HTMLInputElement | null);
      const amount = select('editAmount');
      return {
        idArticle: Number(input('idArticle')?.value ?? '0'),
        condition: select('condition')?.value ?? '',
        language: select('idLanguage')?.value ?? '',
        foil: input('isFoil')?.checked ?? false,
        signed: input('isSigned')?.checked ?? false,
        altered: input('isAltered')?.checked ?? false,
        comments: input('comments')?.value ?? '',
        price: input('price')?.value ?? '',
        quantity: Number(amount?.value ?? '0'),
        quantityOptions: amount ? Array.from(amount.querySelectorAll('option')).map((option) => Number(option.value)) : [],
      };
    });
    if (state.idArticle !== articleId) throw new AutomationError('UI_DRIFT', 'own-offer-form-id');
    return state;
  }

  async closeEditModal(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.editModal.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    if (await this.editModal.isVisible().catch(() => false)) throw new AutomationError('UI_DRIFT', 'own-offer-modal-close');
  }

  async applyEditPrice(articleId: number, price: number): Promise<void> {
    if ((await this.editForm.count()) !== 1) throw new AutomationError('UI_DRIFT', 'own-offer-form');
    const hidden = await this.editForm.locator('input[name="idArticle"]').first().inputValue().catch(() => '0');
    if (Number(hidden) !== articleId) throw new AutomationError('UI_DRIFT', 'own-offer-form-id');
    await this.editForm.locator('input[name="price"]').fill(String(price), { timeout: 15_000 });
  }

  async submitEditForm(): Promise<void> {
    if ((await this.editForm.count()) !== 1) throw new AutomationError('UI_DRIFT', 'own-offer-form');
    const button = this.editForm.locator('button[type="submit"]');
    if ((await button.count()) !== 1) throw new AutomationError('UI_DRIFT', 'own-offer-submit-button');
    const navigation = this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);
    await button.click({ timeout: 15_000 }).catch(() => {});
    const nav = await navigation;
    if (nav) await this.waitForCloudflare();
    await this.editModal.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    if (await this.editModal.isVisible().catch(() => false)) {
      const invalid = await this.editForm.locator('.invalid-feedback').first().isVisible().catch(() => false);
      if (invalid) throw new AutomationError('INVALID_INPUT', 'own-offer-form');
      throw new AutomationError('TIMEOUT', 'own-offer-submit');
    }
  }

  async waitForRow(articleId: number): Promise<void> {
    await this.page
      .waitForFunction((id: string) => Boolean(document.querySelector(`#UserOffersTable a[data-modal*="idArticle=${id}"]`)), String(articleId), {
        timeout: 30_000,
        polling: 250,
      })
      .catch(() => {});
  }
}
