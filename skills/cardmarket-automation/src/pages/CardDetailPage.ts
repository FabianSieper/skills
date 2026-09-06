import type { Locator, Page } from 'playwright';
import { config } from '../../site.config.ts';
import { AutomationError } from '../runtime/errors.ts';
import { uniqueVisible, clickUnique } from '../runtime/guards.ts';
import { SitePage } from './SitePage.ts';
import { parsePrice, parseQty } from '../lib/parse.ts';
import type { CardInfo, OfferCondition, OfferLanguage, ResolvedSellerFilter, SellerOffer, UserOffer, UserOfferChanges } from '../types.ts';
import { buildFilterTargets, type FilterTargets, SELLER_FILTER_DEFAULTS, reverseCondition, reverseLanguage, reverseSellerType, reverseYesNo, reverseCountry } from './seller-filters.ts';
import { OFFER_CONDITION_LABELS, OFFER_CONDITION_VALUES, OFFER_LANGUAGE_LABELS, OFFER_LANGUAGE_VALUES } from './user-offer-filters.ts';
import { resolveHref } from '../lib/url.ts';
import type { Preview } from '../runtime/engine.ts';

type OfferFormState = {
  idArticle: number;
  condition: string;
  language: string;
  foil: boolean;
  signed: boolean;
  altered: boolean;
  comments: string;
  price: string;
  quantity: number;
  quantityOptions: number[];
};

function sameFormState(current: OfferFormState, saved: unknown): boolean {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return false;
  const o = saved as Record<string, unknown>;
  return (
    current.idArticle === (o.idArticle as number) &&
    current.condition === (o.condition as string) &&
    current.language === (o.language as string) &&
    current.foil === (o.foil as boolean) &&
    current.signed === (o.signed as boolean) &&
    current.altered === (o.altered as boolean) &&
    current.comments === (o.comments as string) &&
    current.price === (o.price as string) &&
    current.quantity === (o.quantity as number) &&
    JSON.stringify(current.quantityOptions) === JSON.stringify(o.quantityOptions)
  );
}

async function setOfferCheckbox(locator: Locator, checked: boolean): Promise<void> {
  if ((await locator.count()) !== 1) throw new AutomationError('UI_DRIFT', 'offer-checkbox');
  if ((await locator.isChecked()) !== checked) {
    if (checked) await locator.check({ timeout: 15_000 });
    else await locator.uncheck({ timeout: 15_000 });
  }
}

/**
 * Card detail page:
 *   /en/Magic/Products/Singles/<Set>/<Card>
 *
 * Top block (dl of dt/dd pairs, container has class ~"labeled"):
 *   Rarity / Number / Printed in / Reprints / Available items /
 *   From / Price Trend / 30- / 7- / 1-days average price
 * Main card image = 2nd <img> inside <main> (1st is a chart thumb).
 *
 * Seller list: main .article-row  (~50 rows, "SHOW MORE RESULTS" loads more)
 *   .seller-info .seller-name a[href]      -> seller
 *   [aria-label^="Item location"]          -> location
 *   .article-condition                     -> condition (badge, full name in data-bs-original-title)
 *   .product-attributes span[aria-label]   -> language
 *   .col-offer span.color-primary          -> price
 *   .item-count                            -> quantity
 */
export class CardDetailPage extends SitePage {
  constructor(page: Page) {
    super(page);
  }

  /** Extract the structured top block. */
  async extractInfo(): Promise<CardInfo> {
    const titleEl = await uniqueVisible(this.page.locator('main h1'), 'detail-title');
    const title = (await titleEl.innerText()).replace(/\n+/g, ' - ').trim();
    const { pairs, image } = await this.page.evaluate(() => {
      const out: { pairs: Record<string, string>; image: string } = {
        pairs: {},
        image: '',
      };
      const main = document.querySelector('main');
      if (!main) return out;
      const blocks = Array.from(main.querySelectorAll('[class*="labeled"]'));
      const block = blocks.find((e) => /Rarity/.test(e.textContent ?? ''));
      if (block) {
        const dts = Array.from(block.querySelectorAll('dt')).map(
          (d) => d.textContent?.trim() ?? '',
        );
        const dds = Array.from(block.querySelectorAll('dd')).map(
          (d) => d.textContent?.trim().replace(/\n+/g, ' ') ?? '',
        );
        dts.forEach((label, i) => {
          out.pairs[label] = dds[i] ?? '';
        });
      }
      const imgs = main.querySelectorAll('img');
      out.image = (imgs[1] as HTMLImageElement | undefined)?.getAttribute('src') ?? '';
      return out;
    });
    return {
      title,
      rarity: pairs['Rarity'] ?? '',
      number: pairs['Number'] ?? '',
      printedIn: pairs['Printed in'] ?? '',
      reprints: pairs['Reprints'] ?? '',
      availableItems: pairs['Available items'] ?? '',
      from: pairs['From'] ?? '',
      priceTrend: pairs['Price Trend'] ?? '',
      avg30d: pairs['30-days average price'] ?? '',
      avg7d: pairs['7-days average price'] ?? '',
      avg1d: pairs['1-day average price'] ?? '',
      image,
      url: this.page.url(),
    };
  }

  /** Read up to `limit` seller rows (0 = none). */
  async extractSellers(limit: number): Promise<SellerOffer[]> {
    const rows = this.page.locator('main .article-row');
    const total = await rows.count();
    const n = Math.min(limit, total);
    const out: SellerOffer[] = [];
    for (let i = 0; i < n; i++) {
      out.push(await rows.nth(i).evaluate((el) => {
        const q = (sel: string) => el.querySelector(sel);
        const condition = q('.article-condition');
        return {
          seller: q('.seller-info .seller-name a[href]')?.textContent?.trim() ?? '',
          location:
            q('[aria-label^="Item location"]')
              ?.getAttribute('aria-label')
              ?.replace(/^Item location:\s*/, '') ?? '',
          condition:
            condition?.getAttribute('data-bs-original-title') ??
            condition?.textContent?.trim() ?? '',
          language:
            q('.product-attributes span[aria-label]')?.getAttribute('aria-label') ?? '',
          price: q('.col-offer span.color-primary')?.textContent?.trim() ?? '',
          quantity: q('.item-count')?.textContent?.trim() ?? '',
        };
      }));
    }
    return out;
  }

  /**
   * Read the "Show Versions (N)" link and return its absolute URL
   * (points to the card-level versions page: /en/Magic/Cards/<Card>/Versions).
   */
  async versionsUrl(): Promise<string | null> {
    const link = this.page.locator('a:has-text("Show Versions")');
    const count = await link.count();
    if (count === 0) return null;
    if (count > 1) throw new AutomationError('AMBIGUOUS_SELECTOR', 'versions-link');
    const href = await link.getAttribute('href');
    return href ? resolveHref(href) : null;
  }

  /** Whether the "Show Versions" link exists on this detail page. */
  async hasVersions(): Promise<boolean> {
    return (await this.page.locator('a:has-text("Show Versions")').count()) > 0;
  }

  /** Open the "Show Versions" target and wait for the Versions page. */
  async openVersions(): Promise<void> {
    const link = this.page.locator('a:has-text("Show Versions")');
    const url = await this.versionsUrl();
    if (!url) {
      await clickUnique(link, 'versions-link');
      await this.page.waitForURL(/\/Cards\/[^/]+\/Versions/, { timeout: 30_000 });
      await this.waitForCloudflare();
      return;
    }
    await this.gotoAllowed(url);
  }

  async hasFilterForm(): Promise<boolean> {
    return (await this.filterForm.count()) === 1;
  }

  async readCurrentFilter(): Promise<ResolvedSellerFilter> {
    if ((await this.filterForm.count()) !== 1) return { ...SELLER_FILTER_DEFAULTS };
    const raw = await this.filterForm.evaluate((form: Element) => {
      const select = (name: string) => (form.querySelector(`select[name="${name}"]`) as HTMLSelectElement | null)?.value ?? '';
      const checked = (prefix: string) => (form.querySelector(`input[type="checkbox"][name^="${prefix}["]:checked`) as HTMLInputElement | null)?.value ?? '';
      return {
        minCondition: select('minCondition') || '7',
        language: checked('language'),
        sellerCountry: checked('sellerCountry'),
        sellerType: checked('sellerType'),
        isFoil: select('extra[isFoil]') || '0',
        isSigned: select('extra[isSigned]') || '0',
        isAltered: select('extra[isAltered]') || '0',
      };
    });
    return {
      condition: reverseCondition(raw.minCondition),
      language: reverseLanguage(raw.language),
      location: reverseCountry(raw.sellerCountry),
      sellerType: reverseSellerType(raw.sellerType),
      foil: reverseYesNo(raw.isFoil),
      signed: reverseYesNo(raw.isSigned),
      altered: reverseYesNo(raw.isAltered),
    };
  }

  private get filterForm() {
    return this.page.locator('form[action*="Product_Filter_FilterProduct"]');
  }

  async applySellerFilters(filter: ResolvedSellerFilter): Promise<boolean> {
    await this.assertReady();
    if ((await this.filterForm.count()) !== 1) throw new AutomationError('UI_DRIFT', 'filter-form');
    const targets = buildFilterTargets(filter);
    if (targets.sellerCountry) {
      const missing = await this.page.evaluate((value: string) => {
        const form = document.querySelector('form[action*="Product_Filter_FilterProduct"]');
        return !form?.querySelector(`input[name="sellerCountry[${value}]"]`);
      }, targets.sellerCountry);
      if (missing) {
        const expand = this.page.locator(
          'form button:has-text("VIEW MORE COUNTRIES"), form a:has-text("VIEW MORE COUNTRIES")',
        );
        const count = await expand.count();
        if (count === 0) throw new AutomationError('UI_DRIFT', 'country-expand');
        if (count > 1) throw new AutomationError('AMBIGUOUS_SELECTOR', 'country-expand');
        await expand.click({ timeout: 15_000 });
        await this.page
          .waitForFunction(
            (v: string) => Boolean(document.querySelector(`form[action*="Product_Filter_FilterProduct"] input[name="sellerCountry[${v}]"]`)),
            targets.sellerCountry,
            { timeout: 15_000 },
          )
          .catch(() => {});
      }
    }
    let changed = false;

    const setSelect = async (name: string, value: string) => {
      const loc = this.filterForm.locator(`select[name="${name}"]`);
      if ((await loc.count()) === 0) return;
      const current = await loc.inputValue();
      if (current !== value) {
        await loc.selectOption(value);
        changed = true;
      }
    };

    const setCheckboxGroup = async (name: string, value: string) => {
      const boxes = this.filterForm.locator(`input[type="checkbox"][name^="${name}["]`);
      const count = await boxes.count();
      const wanted = value ? [value] : [];
      for (let i = 0; i < count; i++) {
        const box = boxes.nth(i);
        const boxValue = (await box.getAttribute('value')) ?? '';
        const isChecked = await box.isChecked();
        const shouldCheck = wanted.includes(boxValue);
        if (isChecked !== shouldCheck) {
          if (shouldCheck) await box.check();
          else await box.uncheck();
          changed = true;
        }
      }
    };

    await setSelect('minCondition', targets.minCondition);
    await setCheckboxGroup('language', targets.language);
    await setCheckboxGroup('sellerCountry', targets.sellerCountry);
    await setCheckboxGroup('sellerType', targets.sellerType);
    await setSelect('extra[isFoil]', targets.isFoil);
    await setSelect('extra[isSigned]', targets.isSigned);
    await setSelect('extra[isAltered]', targets.isAltered);

    return changed;
  }

  async submitSellerFilters(): Promise<void> {
    if ((await this.filterForm.count()) !== 1) throw new AutomationError('UI_DRIFT', 'filter-form');
    const button = this.page.locator('form input[type="submit"][name="apply"]');
    await uniqueVisible(button, 'filter-apply');
    const [nav] = await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 200 }).catch(() => null),
      button.click({ timeout: 200 }).catch(() => null),
    ]);
    if (!nav) {
      await this.page.evaluate(() => {
        const el = document.querySelector('form[action*="Product_Filter_FilterProduct"]');
        if (el instanceof HTMLFormElement) el.requestSubmit();
      });
      await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 200 }).catch(() => null);
    }
    await this.waitForCloudflare();
  }

  async settleSellerList(timeoutMs = 15_000): Promise<void> {
    await this.waitForCloudflare();
    await this.page
      .waitForFunction(
        () => {
          const main = document.querySelector('main');
          if (!main) return false;
          if (main.querySelector('.article-row')) return true;
          return /no (results|offers|sellers|items)/i.test(main.textContent ?? '');
        },
        null,
        { timeout: timeoutMs },
      )
      .catch(() => {});
  }

  private userOfferRow(articleId: number): Locator {
    return this.page.locator(`main .article-row#stockRow${articleId}`);
  }

  private userOfferEditLink(articleId: number): Locator {
    return this.userOfferRow(articleId).locator('div[aria-label="Edit"] a[data-modal*="Article_EditArticleModal"]');
  }

  private userOfferModal(): Locator {
    return this.page.locator('#modal .modal-content');
  }

  private userOfferForm(): Locator {
    return this.page.locator('#modal form[data-ajax-action="Article_EditSingleArticle"]');
  }

  async readUserOffers(card: string, set: string, limit: number): Promise<UserOffer[]> {
    await this.assertReady();
    const rows = this.page.locator('main .article-row[id^="stockRow"]');
    const total = await rows.count();
    const offers: UserOffer[] = [];
    for (let i = 0; i < Math.min(limit, total); i++) {
      const row = await rows.nth(i).evaluate((el) => {
        const q = (sel: string) => el.querySelector(sel);
        const idMatch = el.id.match(/^stockRow(\d+)$/);
        const condition = q('.article-condition');
        return {
          articleId: Number(idMatch?.[1] ?? '0'),
          seller: q('.seller-info .seller-name a[href]')?.textContent?.trim() ?? '',
          condition: condition?.getAttribute('data-bs-original-title') ?? condition?.textContent?.trim() ?? '',
          language: q('.product-attributes span[aria-label]')?.getAttribute('aria-label') ?? '',
          price: q('.col-offer span.color-primary')?.textContent?.trim() ?? '',
          quantity: q('.item-count')?.textContent?.trim() ?? '',
        };
      });
      if (row.articleId <= 0) throw new AutomationError('UI_DRIFT', 'user-offer-id');
      offers.push({ ...row, quantity: parseQty(row.quantity), card, set });
    }
    return offers;
  }

  async readUserStockOffer(articleId: number, card: string, set: string): Promise<UserOffer> {
    await this.assertReady();
    const row = this.userOfferRow(articleId);
    if ((await row.count()) !== 1) throw new AutomationError('UI_DRIFT', 'user-offer-row');
    await row.waitFor({ state: 'visible', timeout: 15_000 });
    await this.page
      .waitForFunction((id: string) => {
        const el = document.getElementById(id);
        return el !== null && !el.querySelector('.loader, .spinner');
      }, `stockRow${articleId}`, { timeout: 15_000 })
      .catch(() => {});
    const rowOffer = await row.evaluate((el) => {
      const q = (sel: string) => el.querySelector(sel);
      const idMatch = el.id.match(/^stockRow(\d+)$/);
      const condition = q('.article-condition');
      return {
        articleId: Number(idMatch?.[1] ?? '0'),
        seller: q('.seller-info .seller-name a[href]')?.textContent?.trim() ?? '',
        condition: condition?.getAttribute('data-bs-original-title') ?? condition?.textContent?.trim() ?? '',
        language: q('.product-attributes span[aria-label]')?.getAttribute('aria-label') ?? '',
        price: q('.col-offer span.color-primary')?.textContent?.trim() ?? '',
        quantity: q('.item-count')?.textContent?.trim() ?? '',
      };
    });
    if (rowOffer.articleId !== articleId) throw new AutomationError('UI_DRIFT', 'user-offer-id');
    return { ...rowOffer, quantity: parseQty(rowOffer.quantity), card, set };
  }

  async openUserOfferEditForm(articleId: number): Promise<void> {
    await this.assertReady();
    const row = this.userOfferRow(articleId);
    if ((await row.count()) !== 1) throw new AutomationError('UI_DRIFT', 'user-offer-row');
    const link = this.userOfferEditLink(articleId);
    if ((await link.count()) !== 1) throw new AutomationError('UI_DRIFT', 'user-offer-edit-link');
    await link.click({ timeout: 15_000 });
    await uniqueVisible(this.userOfferModal(), 'user-offer-modal', 30_000);
    await uniqueVisible(this.userOfferForm(), 'user-offer-form', 30_000);
    await this.page
      .waitForFunction(
        () => Boolean(document.querySelector('#modal form[data-ajax-action="Article_EditSingleArticle"] input[name="price"]')),
        null,
        { timeout: 30_000 },
      )
      .catch(() => {});
    const hidden = await this.userOfferForm().locator('input[name="idArticle"]').first().inputValue();
    if (Number(hidden) !== articleId) throw new AutomationError('UI_DRIFT', 'user-offer-form-id');
  }

  async readUserOfferEditForm(): Promise<OfferFormState> {
    await this.assertReady();
    if ((await this.userOfferForm().count()) !== 1) throw new AutomationError('UI_DRIFT', 'user-offer-form');
    return this.userOfferForm().evaluate((form: Element) => {
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
  }

  async closeUserOfferEditForm(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.userOfferModal().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    if (await this.userOfferModal().isVisible().catch(() => false)) throw new AutomationError('UI_DRIFT', 'user-offer-modal-close');
  }

  async applyUserOfferChanges(changes: UserOfferChanges): Promise<void> {
    await this.assertReady();
    if ((await this.userOfferForm().count()) !== 1) throw new AutomationError('UI_DRIFT', 'user-offer-form');
    const form = this.userOfferForm();
    if (typeof changes.condition === 'string') {
      const key = changes.condition as OfferCondition;
      if (!Object.hasOwn(OFFER_CONDITION_VALUES, key)) throw new AutomationError('INVALID_INPUT', 'condition');
      await form.locator('select[name="condition"]').selectOption(OFFER_CONDITION_VALUES[key], { timeout: 15_000 });
    }
    if (typeof changes.language === 'string') {
      const key = changes.language as OfferLanguage;
      if (!Object.hasOwn(OFFER_LANGUAGE_VALUES, key)) throw new AutomationError('INVALID_INPUT', 'language');
      await form.locator('select[name="idLanguage"]').selectOption(OFFER_LANGUAGE_VALUES[key], { timeout: 15_000 });
    }
    if (typeof changes.foil === 'boolean') await setOfferCheckbox(form.locator('input[name="isFoil"]'), changes.foil);
    if (typeof changes.signed === 'boolean') await setOfferCheckbox(form.locator('input[name="isSigned"]'), changes.signed);
    if (typeof changes.altered === 'boolean') await setOfferCheckbox(form.locator('input[name="isAltered"]'), changes.altered);
    if (typeof changes.comments === 'string') await form.locator('input[name="comments"]').fill(changes.comments, { timeout: 15_000 });
    if (typeof changes.price === 'number') await form.locator('input[name="price"]').fill(String(changes.price), { timeout: 15_000 });
    if (typeof changes.quantity === 'number') {
      const select = form.locator('select[name="editAmount"]');
      const options = await select.locator('option').evaluateAll((nodes) => nodes.map((node) => Number((node as HTMLOptionElement).value)));
      if (!options.includes(changes.quantity)) throw new AutomationError('INVALID_INPUT', 'quantity');
      await select.selectOption(String(changes.quantity), { timeout: 15_000 });
    }
  }

  async submitUserOfferEditForm(): Promise<void> {
    await this.assertReady();
    if ((await this.userOfferForm().count()) !== 1) throw new AutomationError('UI_DRIFT', 'user-offer-form');
    const button = this.userOfferForm().locator('button[type="submit"]');
    if ((await button.count()) !== 1) throw new AutomationError('UI_DRIFT', 'offer-submit-button');
    const navigation = this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);
    await button.click({ timeout: 15_000 }).catch(() => {});
    const nav = await navigation;
    if (nav) await this.waitForCloudflare();
    await this.userOfferModal().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    if (await this.userOfferModal().isVisible().catch(() => false)) {
      const invalid = await this.userOfferForm().locator('.invalid-feedback').first().isVisible().catch(() => false);
      if (invalid) throw new AutomationError('INVALID_INPUT', 'offer-form');
      throw new AutomationError('TIMEOUT', 'offer-submit');
    }
  }

  async prepareUserOfferUpdate(articleId: number, changes: UserOfferChanges, card: string, set: string): Promise<Preview> {
    await this.openUserOfferEditForm(articleId);
    const current = await this.readUserOfferEditForm();
    if (current.idArticle !== articleId) throw new AutomationError('UI_DRIFT', 'user-offer-form-id');
    if (typeof changes.quantity === 'number' && !current.quantityOptions.includes(changes.quantity))
      throw new AutomationError('INVALID_INPUT', 'quantity');
    await this.closeUserOfferEditForm();
    return {
      identity: { articleId, card, set, url: this.page.url(), current },
      changes,
    };
  }

  async executeUserOfferUpdate(articleId: number, changes: UserOfferChanges, card: string, set: string, preview: Preview): Promise<UserOffer> {
    await this.openUserOfferEditForm(articleId);
    const current = await this.readUserOfferEditForm();
    if (current.idArticle !== articleId || !sameFormState(current, preview.identity.current))
      throw new AutomationError('PLAN_CHANGED', 'user-offer-form');
    await this.applyUserOfferChanges(changes);
    await this.submitUserOfferEditForm();
    const offer = await this.readUserStockOffer(articleId, card, set);
    if (typeof changes.price === 'number' && parsePrice(offer.price) !== changes.price)
      throw new AutomationError('POSTCONDITION_FAILED', 'price');
    if (typeof changes.quantity === 'number' && offer.quantity !== changes.quantity)
      throw new AutomationError('POSTCONDITION_FAILED', 'quantity');
    if (typeof changes.condition === 'string') {
      const label = OFFER_CONDITION_LABELS[changes.condition as OfferCondition];
      if (label && offer.condition !== label) throw new AutomationError('POSTCONDITION_FAILED', 'condition');
    }
    if (typeof changes.language === 'string') {
      const label = OFFER_LANGUAGE_LABELS[changes.language as OfferLanguage];
      if (label && offer.language !== label) throw new AutomationError('POSTCONDITION_FAILED', 'language');
    }
    return offer;
  }
}