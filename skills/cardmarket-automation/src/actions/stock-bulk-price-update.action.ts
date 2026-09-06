import type { Page } from 'playwright';
import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { parsePrice } from '../lib/parse.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { CardDetailPage } from '../pages/CardDetailPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action, Preview } from '../runtime/engine.ts';
import type { Fields, Input, Json } from '../runtime/input.ts';
import type { OwnOffer, StockBulkPriceUpdateOutput } from '../types.ts';

const description = 'Bulk-update the price of multiple own offers in a single approved plan. Requires parallel articleIds and prices arrays (index-aligned). Opens each card detail page, reads the edit form, and sets the new price after approval. Leaves the browser on the own-offers page.';
const parameters: Fields = {
  articleIds: { type: 'string[]', description: 'IDs der Angebote, deren Preis geaendert wird (index-aligniert mit prices)', required: true, min: 1, max: 1000 },
  prices: { type: 'string[]', description: 'Neue Preise in EUR, z.B. "1.23" oder "1,23" (index-aligniert mit articleIds)', required: true, min: 1, max: 1000 },
};
const outputDescription =
  '{ state, count, updated: [{ articleId, card, oldPrice, newPrice, verified }], auth }';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAuth(value: unknown): boolean {
  return isObject(value) && typeof value.loggedIn === 'boolean';
}

function isBulkItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.articleId === 'number' &&
    typeof value.card === 'string' &&
    typeof value.oldPrice === 'string' &&
    typeof value.newPrice === 'number' &&
    typeof value.verified === 'boolean'
  );
}

function validateOutput(raw: unknown): StockBulkPriceUpdateOutput {
  if (!isObject(raw) || raw.state !== 'own-offers' || typeof raw.count !== 'number' ||
    !Array.isArray(raw.updated) || raw.count !== raw.updated.length ||
    !raw.updated.every(isBulkItem) || !isAuth(raw.auth))
    throw new AutomationError('POSTCONDITION_FAILED');
  return raw as unknown as StockBulkPriceUpdateOutput;
}

function parseArticleId(value: string, index: number): number {
  if (!/^\d+$/.test(value)) throw new AutomationError('INVALID_INPUT', `articleIds[${index}]`);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AutomationError('INVALID_INPUT', `articleIds[${index}]`);
  return id;
}

function parseNewPrice(value: string, index: number): number {
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new AutomationError('INVALID_INPUT', `prices[${index}]`);
  const price = parseFloat(normalized);
  if (!Number.isFinite(price) || price < 0.01 || price > 1_000_000)
    throw new AutomationError('INVALID_INPUT', `prices[${index}]`);
  return price;
}

async function resolveOffers(input: Input, page: Page): Promise<{ ids: number[]; prices: number[]; offers: OwnOffer[] }> {
  const rawIds = input.articleIds as string[];
  const rawPrices = input.prices as string[];
  if (rawIds.length !== rawPrices.length)
    throw new AutomationError('INVALID_INPUT', 'articleIds/prices length mismatch');
  const ids = rawIds.map((v, i) => parseArticleId(v, i));
  const prices = rawPrices.map((v, i) => parseNewPrice(v, i));
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) throw new AutomationError('INVALID_INPUT', `duplicate articleId ${id}`);
    seen.add(id);
  }
  const ownOffers = new OwnOffersPage(page);
  const listed = await ownOffers.extractOffers(Number.MAX_SAFE_INTEGER, true);
  const all = listed.offers;
  const byId = new Map<number, OwnOffer>();
  for (const offer of all) byId.set(offer.articleId, offer);
  const resolved: OwnOffer[] = [];
  for (const id of ids) {
    const offer = byId.get(id);
    if (!offer) throw new AutomationError('UI_DRIFT', `own-offer ${id} not found`);
    resolved.push(offer);
  }
  return { ids, prices, offers: resolved };
}

async function readFormStates(page: Page, entries: ReadonlyArray<{ offer: OwnOffer; id: number }>): Promise<unknown[]> {
  const states: unknown[] = [];
  for (const entry of entries) {
    const detail = new CardDetailPage(page);
    await detail.gotoAllowed(entry.offer.cardUrl);
    await detail.settleSellerList();
    await detail.openUserOfferEditForm(entry.id);
    const formState = await detail.readUserOfferEditForm();
    await detail.closeUserOfferEditForm();
    states.push(formState);
  }
  return states;
}

export const action: Action = {
  id: 'stock.bulk-price-update',
  kind: 'write',
  description,
  parameters,
  outputDescription,
  validateOutput,
  prepare: async (page: Page, input: Input): Promise<Preview> => {
    if (detectState(page) !== 'own-offers') throw new AutomationError('INVALID_INPUT', 'state');
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED');
    const { ids, prices, offers } = await resolveOffers(input, page);
    const entries = offers.map((offer, i) => ({ offer, id: ids[i]! }));
    const formStates = await readFormStates(page, entries);
    await new OwnOffersPage(page).open();
    const articles: Array<{ articleId: number; card: string; cardUrl: string; current: Json }> = offers.map((offer, i) => ({
      articleId: ids[i]!,
      card: offer.card,
      cardUrl: offer.cardUrl,
      current: formStates[i] as Json,
    }));
    return {
      identity: { articles },
      changes: { prices },
    };
  },
  execute: async (page: Page, input: Input, preview: Preview): Promise<StockBulkPriceUpdateOutput> => {
    if (detectState(page) !== 'own-offers') throw new AutomationError('INVALID_INPUT', 'state');
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED');
    const { prices } = await resolveOffers(input, page);
    const articles = (preview.identity as { articles: Array<{ articleId: number; card: string; cardUrl: string; current: Json }> }).articles;
    if (!Array.isArray(articles) || articles.length === 0) throw new AutomationError('POSTCONDITION_FAILED');
    if (articles.length !== prices.length) throw new AutomationError('POSTCONDITION_FAILED');
    const results: Array<{ articleId: number; card: string; oldPrice: string; newPrice: number; verified: boolean }> = [];
    const ownOffers = new OwnOffersPage(page);
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]!;
      const newPrice = prices[i]!;
      const detail = new CardDetailPage(page);
      await detail.gotoAllowed(article.cardUrl);
      await detail.settleSellerList();
      const info = await detail.extractInfo();
      const articlePreview: Preview = {
        identity: { current: article.current },
        changes: { price: newPrice },
      };
      const offer = await detail.executeUserOfferUpdate(article.articleId, { price: newPrice }, info.title, info.printedIn, articlePreview);
      results.push({
        articleId: article.articleId,
        card: article.card,
        oldPrice: String(article.current && typeof article.current === 'object' && !Array.isArray(article.current) ? (article.current as Record<string, unknown>).price ?? '' : ''),
        newPrice,
        verified: true,
      });
    }
    await ownOffers.open();
    return {
      state: 'own-offers',
      count: results.length,
      updated: results,
      auth,
    };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers', 'stock.market-comparison'],
};
