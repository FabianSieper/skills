import type { Locator, Page } from 'playwright';
import { AutomationError } from './errors.ts';
import { originOf } from '../lib/url.ts';

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
  if (!/^https?:\/\//i.test(url)) throw new AutomationError('UI_DRIFT', 'navigation-origin');
  const authority = url.match(/^https?:\/\/([^/?#]+)/i)?.[1] ?? '';
  if (authority.includes('@')) throw new AutomationError('UI_DRIFT', 'navigation-origin');
  const origin = originOf(url);
  if (origin === null || !allowedOrigins.includes(origin)) throw new AutomationError('UI_DRIFT', 'navigation-origin');
  return url;
}
export async function navigate(page: Page, url: string, allowedOrigins: readonly string[]): Promise<void> {
  await page.goto(allowedURL(url, allowedOrigins), { waitUntil: 'domcontentloaded' });
  allowedURL(page.url(), allowedOrigins);
}
