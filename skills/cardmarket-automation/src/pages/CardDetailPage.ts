import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
import { AutomationError } from '../runtime/errors.ts';
import { uniqueVisible, clickUnique } from '../runtime/guards.ts';
import { SitePage } from './SitePage.ts';
import type { CardInfo, ResolvedSellerFilter, SellerOffer } from '../types.ts';
import { buildFilterTargets, type FilterTargets, SELLER_FILTER_DEFAULTS, reverseCondition, reverseLanguage, reverseSellerType, reverseYesNo, reverseCountry } from './seller-filters.ts';
import { resolveHref } from '../lib/url.ts';

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
        await this.page.waitForTimeout(500);
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
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null),
      button.click({ timeout: 15_000 }).catch(() => null),
    ]);
    if (!nav) {
      await this.page.evaluate(() => {
        const el = document.querySelector('form[action*="Product_Filter_FilterProduct"]');
        if (el instanceof HTMLFormElement) el.requestSubmit();
      });
      await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);
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
}