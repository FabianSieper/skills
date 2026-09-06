import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
import { AutomationError } from '../runtime/errors.ts';
import { navigate } from '../runtime/guards.ts';
import { resolveHref } from '../lib/url.ts';
import { readAccount } from '../lib/auth.ts';

/**
 * Cardmarket base page: origin guard + Cloudflare detection.
 *
 * Cardmarket is public; no login required for search/detail/artwork pages.
 * Deep links (e.g. /Products/Singles/...) may be intercepted by a Cloudflare
 * "Just a moment..." challenge. We wait for it, and escalate to
 * HUMAN_REQUIRED when the challenge persists for more than 90 seconds.
 */
export class SitePage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Verify the page sits on an allowed origin and is past any Cloudflare
   * challenge. Navigates to the base URL when the page is empty or off-site.
   */
  async assertReady(): Promise<{ accountKey: string }> {
    const url = this.page.url();
    const onSite = url !== 'about:blank' && url.startsWith(config.baseURL);
    if (!onSite) {
      await navigate(this.page, config.baseURL, config.allowedOrigins);
    }
    await this.waitForCloudflare();
    return { accountKey: await readAccount(this.page) };
  }

  /** Navigate to an absolute/relative Cardmarket URL with origin + Cloudflare guards. */
  async gotoAllowed(url: string): Promise<void> {
    const target = resolveHref(url);
    await navigate(this.page, target, config.allowedOrigins);
    await this.waitForCloudflare();
  }

  /**
   * Wait through any Cloudflare challenge.
   * Resolves as soon as the challenge title is gone; throws HUMAN_REQUIRED
   * when it persists for more than 90 seconds (operator must solve it
   * manually in the attached browser).
   */
  async waitForCloudflare(timeoutMs = 90_000): Promise<void> {
    await this.page
      .waitForFunction(() => !/just a moment|attention required|cloudflare/i.test(document.title), null, { timeout: timeoutMs })
      .catch(() => {});
    const title = await this.page.title().catch(() => '');
    if (/just a moment|attention required|cloudflare/i.test(title))
      throw new AutomationError('HUMAN_REQUIRED', 'cloudflare-challenge');
  }
}