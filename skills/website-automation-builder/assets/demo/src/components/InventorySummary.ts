import type { Page } from "playwright";
export class InventorySummary {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }
  async read(): Promise<Record<string, string>> {
    const summary = this.page.getByTestId("inventory-summary");
    return (await summary.count()) === 1 && (await summary.isVisible())
      ? {
          inventory: ((await summary.textContent()) ?? "").trim().slice(0, 100),
        }
      : {};
  }
}
