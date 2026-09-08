import type { Page } from 'playwright';
import type { AuthInfo } from '../types.ts';
import { AutomationError } from '../runtime/errors.ts';

const LOGIN_SELECTOR = 'form#header-login, form#offcanvas-login, input[name="username"], input[name="userPassword"]';
const ACCOUNT_SELECTOR = '#header a.nav-link.dropdown-toggle.pe-2';

export async function readAccount(page: Page): Promise<string> {
  await page.waitForFunction(() => Boolean(document.querySelector('#header, #login-signup')), null, { timeout: 10_000 }).catch(() => {});
  const links = page.locator(ACCOUNT_SELECTOR);
  const visibleNames = await links.evaluateAll((nodes) => {
    const visible = (element: Element): boolean => {
      let node: Element | null = element;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        node = node.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return nodes.filter(visible).map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim());
  });
  if (visibleNames.length > 1) throw new AutomationError('AMBIGUOUS_SELECTOR', 'account-marker');
  if (visibleNames.length === 1) {
    const text = visibleNames[0] ?? '';
    const name = text.split('(')[0]?.trim() ?? '';
    if (name) return `user:${name}`;
  }
  return 'public';
}

export async function readAuth(page: Page): Promise<AuthInfo> {
  await page.waitForFunction(() => Boolean(document.querySelector('#header, #login-signup, form#header-login, form#offcanvas-login')), null, { timeout: 10_000 }).catch(() => {});
  const visibleLoginCount = await page.locator(LOGIN_SELECTOR).evaluateAll((nodes) => {
    const visible = (element: Element): boolean => {
      let node: Element | null = element;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        node = node.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return nodes.filter(visible).length;
  });
  if (visibleLoginCount > 0) return { loggedIn: false };
  const visibleAccountCount = await page.locator(ACCOUNT_SELECTOR).evaluateAll((nodes) => {
    const visible = (element: Element): boolean => {
      let node: Element | null = element;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        node = node.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return nodes.filter(visible).length;
  });
  if (visibleAccountCount > 1) throw new AutomationError('AMBIGUOUS_SELECTOR', 'account-marker');
  if (visibleAccountCount === 1) return { loggedIn: true };
  // A rendered Cardmarket shell with no account marker is the guest state;
  // without either positive shell or account evidence, authentication is
  // unknown rather than an invented `loggedIn: false`.
  if (await page.locator('#header, #login-signup').count() > 0) return { loggedIn: false };
  throw new AutomationError('UI_DRIFT', 'auth-marker');
}
