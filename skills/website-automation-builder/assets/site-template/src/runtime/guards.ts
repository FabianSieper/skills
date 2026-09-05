import type { Locator, Page } from 'playwright';
import { AutomationError } from './errors.ts';

/** Wait, then assert a single visible match. The following Playwright action stays strict. */
export async function uniqueVisible(locator: Locator, step: string, timeout = 15_000): Promise<Locator> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
  } catch {
    const count = await locator.count().catch(() => 0);
    throw new AutomationError(count > 1 ? 'AMBIGUOUS_SELECTOR' : 'UI_DRIFT', step);
  }
  if (await locator.count() !== 1) throw new AutomationError('AMBIGUOUS_SELECTOR', step);
  return locator;
}
export async function clickUnique(locator: Locator, step: string, timeout = 15_000): Promise<void> {
  await (await uniqueVisible(locator, step, timeout)).click({ timeout });
}
export async function fillUnique(locator: Locator, value: string, step: string, timeout = 15_000): Promise<void> {
  await (await uniqueVisible(locator, step, timeout)).fill(value, { timeout });
}
export function allowedURL(url: string, allowedOrigins: readonly string[]): string {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password ||
      !allowedOrigins.includes(parsed.origin)) throw new AutomationError('UI_DRIFT', 'navigation-origin');
  return parsed.href;
}
export async function navigate(page: Page, url: string, allowedOrigins: readonly string[]): Promise<void> {
  await page.goto(allowedURL(url, allowedOrigins), { waitUntil: 'domcontentloaded' });
  allowedURL(page.url(), allowedOrigins);
}
