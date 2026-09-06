import type { Page } from 'playwright';
import type { StateId } from '../types.ts';

export function stateFromUrl(url: string): StateId {
  if (url.includes('/Products/Search?')) return 'results';
  if (url.includes('/Products/Singles/')) return 'detail';
  if (/\/Cards\/[^/]+\/Versions/.test(url)) return 'versions';
  return 'start';
}

export function detectState(page: Page): StateId {
  return stateFromUrl(page.url());
}
