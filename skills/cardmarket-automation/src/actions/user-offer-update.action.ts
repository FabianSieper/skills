import type { Page } from 'playwright';
import { CardDetailPage } from '../pages/CardDetailPage.ts';
import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action, Preview } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { UserOfferChanges, UserOfferUpdateOutput } from '../types.ts';

const description = 'Update one exact logged-in user offer after an explicit plan approval. Requires articleId from user.offers and at least one change.';
const OFFER_CONDITIONS = ['mint', 'near-mint', 'excellent', 'good', 'light-played', 'played', 'poor'];
const OFFER_LANGUAGES = ['english', 'french', 'german', 'spanish', 'italian', 's-chinese', 'japanese', 'portuguese', 'russian', 't-chinese'];
const parameters: Fields = {
  articleId: { type: 'integer', description: 'Eindeutige ID des eigenen Angebots aus user.offers', required: true, min: 1, max: 9_000_000_000_000_000 },
  price: { type: 'number', description: 'Neuer Preis in EUR', min: 0.01, max: 1_000_000 },
  quantity: { type: 'integer', description: 'Neue Menge', min: 1, max: 1_000_000 },
  condition: { type: 'string', description: 'Neuer Zustand', enum: OFFER_CONDITIONS },
  language: { type: 'string', description: 'Neue Sprache', enum: OFFER_LANGUAGES },
  foil: { type: 'boolean', description: 'Foil-Markierung' },
  signed: { type: 'boolean', description: 'Signed-Markierung' },
  altered: { type: 'boolean', description: 'Altered-Markierung' },
  comments: { type: 'string', description: 'Kommentar', min: 0, max: 100 },
};
const outputDescription = '{ state, articleId, card, set, url, offer, changes, verified, auth }';

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

function isChanges(value: unknown): boolean {
  if (!isObject(value) || Object.keys(value).length === 0) return false;
  const allowed = new Set(['price', 'quantity', 'condition', 'language', 'foil', 'signed', 'altered', 'comments']);
  return Object.entries(value).every(([key, entry]) => allowed.has(key) && (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'));
}

function validateOutput(raw: unknown): UserOfferUpdateOutput {
  if (!isObject(raw) || raw.state !== 'detail' || typeof raw.articleId !== 'number' || typeof raw.card !== 'string' ||
      typeof raw.set !== 'string' || typeof raw.url !== 'string' || !isUserOffer(raw.offer) ||
      !isChanges(raw.changes) || typeof raw.verified !== 'boolean' || !isAuth(raw.auth))
    throw new AutomationError('POSTCONDITION_FAILED');
  return raw as unknown as UserOfferUpdateOutput;
}

function normalizeChanges(input: Input): UserOfferChanges {
  const changes: UserOfferChanges = {};
  if (input.price !== undefined) changes.price = input.price as number;
  if (input.quantity !== undefined) changes.quantity = input.quantity as number;
  if (input.condition !== undefined) changes.condition = input.condition as string;
  if (input.language !== undefined) changes.language = input.language as string;
  if (input.foil !== undefined) changes.foil = input.foil as boolean;
  if (input.signed !== undefined) changes.signed = input.signed as boolean;
  if (input.altered !== undefined) changes.altered = input.altered as boolean;
  if (input.comments !== undefined) changes.comments = input.comments as string;
  if (Object.keys(changes).length === 0) throw new AutomationError('INVALID_INPUT', 'changes');
  return changes;
}

async function context(page: Page, input: Input): Promise<{ articleId: number; changes: UserOfferChanges; card: string; set: string }> {
  if (detectState(page) !== 'detail') throw new AutomationError('INVALID_INPUT', 'state');
  const auth = await readAuth(page);
  if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED');
  const detail = new CardDetailPage(page);
  const info = await detail.extractInfo();
  return { articleId: input.articleId as number, changes: normalizeChanges(input), card: info.title, set: info.printedIn };
}

export const action: Action = {
  id: 'user.offer.update',
  kind: 'write',
  description,
  parameters,
  outputDescription,
  validateOutput,
  prepare: async (page: Page, input: Input): Promise<Preview> => {
    const target = await context(page, input);
    return new CardDetailPage(page).prepareUserOfferUpdate(target.articleId, target.changes, target.card, target.set);
  },
  execute: async (page: Page, input: Input, preview: Preview): Promise<UserOfferUpdateOutput> => {
    const target = await context(page, input);
    const offer = await new CardDetailPage(page).executeUserOfferUpdate(target.articleId, target.changes, target.card, target.set, preview);
    const auth = await readAuth(page);
    return { state: 'detail', articleId: target.articleId, card: target.card, set: target.set, url: page.url(), offer, changes: target.changes, verified: true, auth };
  },
  modulePath: import.meta.url,
  next: ['info', 'user.offers'],
};
