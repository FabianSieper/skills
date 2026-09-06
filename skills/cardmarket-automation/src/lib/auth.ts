import type { Page } from 'playwright';
import type { AuthInfo } from '../types.ts';
import { config } from '../../site.config.ts';

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

/** Inlined: returns true when the login form is already visible, false when the caller must poll or navigate. */
function openLoginForm(): boolean {
  const isVisible = (el: Element): boolean => {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const username = document.querySelector('input[name="username"]');
  if (username && isVisible(username)) return true;
  const candidates = Array.from(document.querySelectorAll('a, button, [role="button"]'));
  const trigger = candidates.find((el) => {
    if (!isVisible(el)) return false;
    const attrs = [el.getAttribute('href'), el.getAttribute('aria-controls'), el.getAttribute('data-bs-target'), el.getAttribute('data-target')]
      .filter(Boolean).join(' ').toLowerCase();
    if (attrs.includes('login')) return true;
    return /^(login|anmelden|log in|sign in)$/i.test((el.textContent || '').trim());
  });
  if (trigger) {
    (trigger as HTMLElement).click();
    return false;
  }
  return false;
}

/** Inlined: evaluated in the browser, must not reference module scope. */
function cloudflareTitleGone(): boolean {
  return !/just a moment|attention required|cloudflare/i.test(document.title);
}

/** Inlined: evaluated in the browser, must not reference module scope. */
function clickConsentAccept(): boolean {
  const acceptPattern = /accept all cookies|alle akzeptieren/i;
  const isVisible = (el: Element): boolean => {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  const accept = buttons.find((b) => acceptPattern.test(b.textContent || '') && isVisible(b));
  if (!accept) return false;
  (accept as HTMLElement).click();
  return true;
}

/** Inlined: evaluated in the browser, must not reference module scope. */
function consentOverlayGone(): boolean {
  const acceptPattern = /accept all cookies|alle akzeptieren/i;
  const isVisible = (el: Element): boolean => {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  return !buttons.some((b) => acceptPattern.test(b.textContent || '') && isVisible(b));
}

/**
 * Bring the Cardmarket login form into the attached browser and wait for a
 * human to log in. Used after an AUTH_REQUIRED failure so the user never has
 * to sign in "first". Resolves 'logged-in' when the login form disappears and
 * the account link appears, 'timeout' when waitMs elapses (the login page
 * stays open; the caller retries the same command later).
 */
export async function autoLogin(page: Page, waitMs: number): Promise<'logged-in' | 'timeout'> {
  try {
    if (!await page.evaluate(openLoginForm).catch(() => false)) {
      const url = page.url();
      const onSite = url !== 'about:blank' && url.startsWith(config.baseURL);
      if (!onSite) await page.goto(config.baseURL, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      await page.waitForFunction(cloudflareTitleGone, null, { timeout: 90_000 }).catch(() => {});
      await page.evaluate(clickConsentAccept).catch(() => {});
      await page.waitForFunction(consentOverlayGone, null, { timeout: 5_000 }).catch(() => {});
      if (!await page.evaluate(openLoginForm).catch(() => false)) {
        await page.goto(config.baseURL + config.homeEntry, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
        await page.waitForFunction(cloudflareTitleGone, null, { timeout: 90_000 }).catch(() => {});
        await page.evaluate(clickConsentAccept).catch(() => {});
        await page.waitForFunction(consentOverlayGone, null, { timeout: 5_000 }).catch(() => {});
        await page.evaluate(openLoginForm).catch(() => false);
      }
    }
    const deadline = Date.now() + waitMs;
    for (;;) {
      const loggedIn = await readAuth(page).catch(() => ({ loggedIn: false }));
      if (loggedIn.loggedIn) return 'logged-in';
      if (Date.now() >= deadline) return 'timeout';
      await page.evaluate(() => {
        const el = document.querySelector('input[name="username"]') as HTMLElement | null;
        el?.scrollIntoView({ block: 'center' });
      }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  } catch {
    return 'timeout';
  }
}
