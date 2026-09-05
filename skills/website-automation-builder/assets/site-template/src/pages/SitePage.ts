import type { Page, Locator } from "playwright";
import { AutomationError } from "../runtime/errors.ts";

export class SitePage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }
  async detectState(): Promise<string> {
    // BUILD_REQUIRED: read observed state markers; never navigate here.
    return "unknown";
  }
  regions(): Record<string, Locator> {
    // BUILD_REQUIRED: stable semantic names mapped to POM-owned locators.
    return {};
  }
  async visibleData(): Promise<Record<string, string>> {
    // Only allowlisted, bounded business summaries; never input values or secrets.
    return {};
  }
  async assertReady(): Promise<{ accountKey: string }> {
    // BUILD_REQUIRED: Implement real ready/login/challenge markers for this website.
    // Return a stable account identifier (or 'public' only for genuinely public workflows).
    // Never treat an arbitrary HTTP 200 or an empty error screen as a verified session.
    throw new AutomationError("NOT_CONFIGURED", "site-session-check");
  }
}
