import type { Page } from 'playwright';
import type { AuthInfo } from '../types.ts';

const LOGIN_SELECTOR = 'form#header-login, form#offcanvas-login, input[name="username"], input[name="userPassword"]';

export async function readAccount(page: Page): Promise<string> {
  await page
    .locator('#header, #login-signup')
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  const link = page.locator('#header a.nav-link.dropdown-toggle.pe-2').first();
  if ((await link.count()) === 1) {
    const text = (await link.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const name = text.split('(')[0]?.trim() ?? '';
    if (name) return `user:${name}`;
  }
  return 'public';
}

export async function readAuth(page: Page): Promise<AuthInfo> {
  await page
    .locator('#header, #login-signup, form#header-login, form#offcanvas-login')
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  const count = await page.locator(LOGIN_SELECTOR).count();
  return { loggedIn: count === 0 };
}
