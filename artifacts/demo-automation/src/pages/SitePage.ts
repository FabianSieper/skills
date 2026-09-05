import type { Page, Locator } from "playwright";
import { AutomationError } from "../runtime/errors.ts";
import { uniqueVisible } from "../runtime/guards.ts";
import { InventorySummary } from "../components/InventorySummary.ts";

export class SitePage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }
  async detectState(): Promise<string> {
    const root = this.page.getByTestId("inventory");
    if ((await root.count()) !== 1 || !(await root.isVisible()))
      return "unknown";
    return (await root.getAttribute("data-state")) === "inventory"
      ? "inventory"
      : "unknown";
  }
  async assertReady(): Promise<{ accountKey: string }> {
    if ((await this.detectState()) !== "inventory")
      throw new AutomationError("UNSUPPORTED_UI_STATE", "inventory-state");
    const root = await uniqueVisible(
      this.page.getByTestId("inventory"),
      "inventory-root",
    );
    const accountKey = await root.getAttribute("data-account");
    if (!accountKey) throw new AutomationError("AUTH_REQUIRED");
    return { accountKey };
  }
  regions(): Record<string, Locator> {
    return {
      "search-filters": this.page.getByTestId("search-filters"),
      "inventory-results": this.page.getByTestId("results"),
    };
  }
  async visibleData(): Promise<Record<string, string>> {
    return new InventorySummary(this.page).read();
  }
}
