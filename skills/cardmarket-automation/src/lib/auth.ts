import type { Page } from 'playwright';
import type { AuthInfo } from '../types.ts';

const LOGIN_SELECTOR = 'form#header-login, form#offcanvas-login, input[name="username"], input[name="userPassword"]';

export async function readAuth(page: Page): Promise<AuthInfo> {
  await page
    .locator('#header, #login-signup, form#header-login, form#offcanvas-login')
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  const count = await page.locator(LOGIN_SELECTOR).count();
  return { loggedIn: count === 0 };
}
