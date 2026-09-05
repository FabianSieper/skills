/** LOCAL FIXTURE EXAMPLE ONLY. These test IDs are not claims about any real website.
 * Copy into src/pages/ only after replacing with observed website contracts.
 */
import type { Page, Locator } from 'playwright';
import { fillUnique, clickUnique, uniqueVisible } from '../runtime/guards.ts';
import { AutomationError } from '../runtime/errors.ts';

export class InventoryPage {
  readonly page: Page;
  readonly root: Locator;
  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId('inventory');
  }
  async search(sku: string): Promise<{sku: string; title: string} | null> {
    await uniqueVisible(this.root,'inventory-root');
    await fillUnique(this.root.getByRole('textbox',{name:'Artikelnummer',exact:true}),sku,'sku-field');
    await clickUnique(this.root.getByRole('button',{name:'Suchen',exact:true}),'search-submit');
    // A query-specific ready marker prevents accepting stale results from a previous search.
    const result = this.root.getByTestId('result-' + sku);
    await uniqueVisible(result,'query-result');
    if (await result.getAttribute('data-empty') === 'true') return null;
    const item = result.getByTestId('item-' + sku);
    await uniqueVisible(item,'exact-sku');
    if (await item.getAttribute('data-sku') !== sku) throw new AutomationError('POSTCONDITION_FAILED');
    const title = await uniqueVisible(item.getByTestId('title'),'item-title');
    const text = (await title.textContent())?.trim();
    if (!text) throw new AutomationError('POSTCONDITION_FAILED');
    return {sku,title:text};
  }
}
