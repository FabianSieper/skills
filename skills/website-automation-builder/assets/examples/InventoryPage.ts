/** LOCAL FIXTURE EXAMPLE ONLY. These test IDs are not claims about any real website.
 * Copy into src/pages/ only after replacing with observed website contracts.
 */
import type { Page, Locator } from "playwright";
import { fillUnique, clickUnique, uniqueVisible } from "../runtime/guards.ts";
import { AutomationError } from "../runtime/errors.ts";
import type { Preview } from "../runtime/engine.ts";

export class InventoryPage {
  readonly page: Page;
  readonly root: Locator;
  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId("inventory");
  }
  async search(sku: string): Promise<{ sku: string; title: string } | null> {
    await uniqueVisible(this.root, "inventory-root");
    await fillUnique(
      this.root.getByRole("textbox", { name: "Artikelnummer", exact: true }),
      sku,
      "sku-field",
    );
    await clickUnique(
      this.root.getByRole("button", { name: "Suchen", exact: true }),
      "search-submit",
    );
    // A query-specific ready marker prevents accepting stale results from a previous search.
    const result = this.root.getByTestId("result-" + sku);
    await uniqueVisible(result, "query-result");
    if ((await result.getAttribute("data-empty")) === "true") return null;
    const item = result.getByTestId("item-" + sku);
    await uniqueVisible(item, "exact-sku");
    if ((await item.getAttribute("data-sku")) !== sku)
      throw new AutomationError("POSTCONDITION_FAILED");
    const title = await uniqueVisible(item.getByTestId("title"), "item-title");
    const text = (await title.textContent())?.trim();
    if (!text) throw new AutomationError("POSTCONDITION_FAILED");
    return { sku, title: text };
  }
  private async item(sku: string): Promise<Locator> {
    const item = this.root.getByTestId("item-" + sku);
    await uniqueVisible(item, "exact-sku");
    if ((await item.getAttribute("data-sku")) !== sku)
      throw new AutomationError("POSTCONDITION_FAILED", "sku");
    return item;
  }
  async previewTitle(sku: string, title: string): Promise<Preview> {
    const item = await this.item(sku);
    const version = await item.getAttribute("data-version");
    if (!version) throw new AutomationError("POSTCONDITION_FAILED", "version");
    return { target: { sku }, version, changes: { title } };
  }
  async updateTitle(
    sku: string,
    title: string,
    preview: Preview,
  ): Promise<{ sku: string; title: string }> {
    const item = await this.item(sku);
    await clickUnique(
      item.getByRole("button", { name: "Bearbeiten", exact: true }),
      "edit",
    );
    const dialog = this.page.getByRole("dialog", {
      name: "Artikel bearbeiten",
      exact: true,
    });
    await fillUnique(
      dialog.getByLabel("Titel", { exact: true }),
      title,
      "title",
    );
    await clickUnique(
      dialog.getByRole("button", { name: "Speichern", exact: true }),
      "save",
    );
    const changed = await this.item(sku);
    const version = await changed.getAttribute("data-version");
    const actual = (await changed.getByTestId("title").textContent())?.trim();
    if (version === preview.version || actual !== title)
      throw new AutomationError("POSTCONDITION_FAILED", "saved-title");
    return { sku, title: actual };
  }
}
