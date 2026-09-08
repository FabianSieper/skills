import type { Page } from 'playwright';
import type { StateId } from '../types.ts';
import { parseUrl } from './url.ts';

export function stateFromUrl(url: string): StateId {
  // The run-code browser vm context has no `URL` global, so we use the
  // require-free parser instead of `new URL(...)` (which would always throw).
  const parsed = parseUrl(url);
  if (!parsed) return 'unknown';
  if (parsed.origin !== 'https://www.cardmarket.com' || parsed.username || parsed.password) return 'unknown';
  const path = parsed.pathname;
  // Match only the documented English Magic surfaces. Same-origin lookalike
  // paths remain `unknown`; URL shape alone must never broaden the trust
  // boundary to an unsupported page.
  if (/^\/en\/Magic\/Stock\/Offers\/Singles\/?$/.test(path)) return 'own-offers';
  if (/^\/en\/Magic\/Products\/Search\/?$/.test(path)) return 'results';
  if (/^\/en\/Magic\/Products\/Singles\/[^/]+\/[^/]+\/?$/.test(path)) return 'detail';
  if (/^\/en\/Magic\/Cards\/[^/]+\/Versions\/?$/.test(path)) return 'versions';
  if (/\/en(?:\/Magic)?\/?$/.test(path)) return 'start';
  return 'unknown';
}

export function detectState(page: Page): StateId {
  return stateFromUrl(page.url());
}
