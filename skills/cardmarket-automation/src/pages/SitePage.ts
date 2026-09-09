import type { Page } from 'playwright';
import { config } from '../../site.config.ts';
import { AutomationError } from '../runtime/errors.ts';
import { navigate } from '../runtime/guards.ts';
import { originOf } from '../lib/url.ts';
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
   * Purely observe the attached page before an action. This method deliberately
   * does not navigate, dismiss consent, open login or repair the UI. Navigation
   * belongs to an explicit registered action; a readiness check must not change
   * the page it is describing.
   */
  async assertReady(): Promise<{ accountKey: string; onSite: boolean }> {
    const url = this.page.url();
    const onSite = isAllowedOrigin(url, config.allowedOrigins);
    if (!onSite) return { accountKey: 'unknown', onSite: false };
    await this.waitForCloudflare();
    return { accountKey: await readAccount(this.page), onSite: true };
  }

  /**
   * Navigate to the site home (config.baseURL + config.homeEntry).
   * The navigation policy allows raw `goto` ONLY for this destination;
   * every other state must be reached through the site's own UI.
   */
  async goHome(): Promise<void> {
    await navigate(this.page, config.baseURL + config.homeEntry, config.allowedOrigins);
    await this.waitForCloudflare();
  }

  /**
   * Return to the state that was reached immediately before, using browser
   * history. This is the only compliant return primitive: forward navigation
   * is a real UI interaction, and history undoes it in reverse order.
   */
  async goBack(): Promise<void> {
    await this.page.goBack({ timeout: 30_000 });
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
    let title: string;
    try { title = await this.page.title(); }
    catch { throw new AutomationError('TIMEOUT', 'cloudflare-title'); }
    if (/just a moment|attention required|cloudflare/i.test(title))
      throw new AutomationError('HUMAN_REQUIRED', 'cloudflare-challenge');
  }
}

export function isAllowedOrigin(url: string, origins: readonly string[]): boolean {
  // Browser-safe: the run-code vm context has no `URL` global, so we use the
  // require-free origin parser instead of `new URL(url).origin`.
  const origin = originOf(url);
  return origin !== null && origins.includes(origin);
}
