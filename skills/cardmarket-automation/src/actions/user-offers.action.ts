import type { Page } from 'playwright';
import { CardDetailPage } from '../pages/CardDetailPage.ts';
import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { AuthInfo, StateId, UserOffersOutput } from '../types.ts';

const description = "Read the logged-in user's own offers on the current card detail page.";
const parameters: Fields = {
  limit: { type: 'integer', description: 'Eigene Angebote, die gelesen werden sollen (0 = keine)', default: 20, min: 0, max: 100 },
};
const outputDescription = '{ state, card, set, url, found, count, offers, auth }';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAuth(value: unknown): boolean {
  return isObject(value) && typeof value.loggedIn === 'boolean';
}

function isUserOffer(value: unknown): boolean {
  if (!isObject(value) || typeof value.articleId !== 'number') return false;
  return ['seller', 'card', 'set', 'condition', 'language', 'price'].every((key) => typeof value[key] === 'string') && typeof value.quantity === 'number';
}

function validateOutput(raw: unknown): UserOffersOutput {
  if (!isObject(raw)) throw new AutomationError('POSTCONDITION_FAILED');
  const states: StateId[] = ['start', 'results', 'detail', 'versions'];
  if (!states.includes(raw.state as StateId) || typeof raw.card !== 'string' || typeof raw.set !== 'string' ||
      typeof raw.url !== 'string' || typeof raw.found !== 'boolean' || typeof raw.count !== 'number' ||
      !Array.isArray(raw.offers) || raw.count !== raw.offers.length || !raw.offers.every(isUserOffer) || !isAuth(raw.auth))
    throw new AutomationError('POSTCONDITION_FAILED');
  return raw as unknown as UserOffersOutput;
}

export const action: Action = {
  id: 'user.offers',
  kind: 'read',
  description,
  parameters,
  outputDescription,
  validateOutput,
  run: async (page: Page, input: Input): Promise<UserOffersOutput> => {
    const state = detectState(page);
    const auth = await readAuth(page);
    if (state !== 'detail') return { state, card: '', set: '', url: page.url(), found: false, count: 0, offers: [], auth };
    const detail = new CardDetailPage(page);
    const info = await detail.extractInfo();
    const offers = await detail.readUserOffers(info.title, info.printedIn, input.limit as number);
    return { state, card: info.title, set: info.printedIn, url: page.url(), found: offers.length > 0, count: offers.length, offers, auth };
  },
  modulePath: import.meta.url,
  next: ['info', 'user.offer.update'],
};
