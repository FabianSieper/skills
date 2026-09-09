import type { Page } from 'playwright';
import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { parsePrice } from '../lib/parse.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import { asFilter, pageOfIndex, restoreOwnOffers, startPageOf } from './stock-common.ts';
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

async function resolveOffers(input: Input, page: Page): Promise<{ ids: number[]; prices: number[]; offers: OwnOffer[]; all: OwnOffer[] }> {
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
  return { ids, prices, offers: resolved, all };
}

async function readFormStates(page: Page, all: OwnOffer[], entries: ReadonlyArray<{ offer: OwnOffer; id: number }>): Promise<unknown[]> {
  const startPage = startPageOf(page.url());
  const stockFilter = asFilter(await new OwnOffersPage(page).readCurrentFilter());
  const ownOffers = await restoreOwnOffers(page, stockFilter, 1);
  const indexOf = new Map(all.map((offer, index) => [offer.articleId, index]));
  const states: unknown[] = new Array(entries.length).fill(null);
  const order = entries
    .map((entry, position) => ({ position, id: entry.id, targetPage: pageOfIndex(indexOf.get(entry.id) ?? -1) }))
    .sort((a, b) => a.targetPage - b.targetPage);
  let currentStockPage = 1;
  for (const step of order) {
    if (step.targetPage < 1) throw new AutomationError('UI_DRIFT', `offer-index-${step.id}`);
    while (currentStockPage < step.targetPage) {
      if (!(await ownOffers.goToNextPage())) throw new AutomationError('UI_DRIFT', `stock-page-${step.targetPage}`);
      currentStockPage++;
    }
    const detail = await ownOffers.openOfferById(step.id);
    await detail.settleSellerList();
    await detail.openUserOfferEditForm(step.id);
    states[step.position] = await detail.readUserOfferEditForm();
    await detail.closeUserOfferEditForm();
    await ownOffers.goBack();
    await ownOffers.waitUntilReady();
  }
  await restoreOwnOffers(page, stockFilter, startPage);
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
    const state = detectState(page);
    if (state !== 'own-offers') throw new AutomationError('WRONG_STATE', 'source-state', { expected: ['own-offers'], actual: state, operation: 'stock.bulk-price-update' });
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED');
    const { ids, prices, offers, all } = await resolveOffers(input, page);
    const entries = offers.map((offer, i) => ({ offer, id: ids[i]! }));
    const formStates = await readFormStates(page, all, entries);
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
    const state = detectState(page);
    if (state !== 'own-offers') throw new AutomationError('WRONG_STATE', 'source-state', { expected: ['own-offers'], actual: state, operation: 'stock.bulk-price-update' });
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED');
    const startPage = startPageOf(page.url());
    const stockFilter = asFilter(await new OwnOffersPage(page).readCurrentFilter());
    const { prices, all } = await resolveOffers(input, page);
    const articles = (preview.identity as { articles: Array<{ articleId: number; card: string; cardUrl: string; current: Json }> }).articles;
    if (!Array.isArray(articles) || articles.length === 0) throw new AutomationError('POSTCONDITION_FAILED');
    if (articles.length !== prices.length) throw new AutomationError('POSTCONDITION_FAILED');
    const indexOf = new Map(all.map((offer, index) => [offer.articleId, index]));
    const ownOffers = await restoreOwnOffers(page, stockFilter, 1);
    const order = articles
      .map((article, position) => ({ position, targetPage: pageOfIndex(indexOf.get(article.articleId) ?? -1) }))
    .sort((a, b) => a.targetPage - b.targetPage);
    const results: Array<{ articleId: number; card: string; oldPrice: string; newPrice: number; verified: boolean } | undefined> = new Array(articles.length);
    let currentStockPage = 1;
    for (const step of order) {
      if (step.targetPage < 1) throw new AutomationError('UI_DRIFT', `offer-index-${articles[step.position]!.articleId}`);
      while (currentStockPage < step.targetPage) {
        if (!(await ownOffers.goToNextPage())) throw new AutomationError('UI_DRIFT', `stock-page-${step.targetPage}`);
        currentStockPage++;
      }
      const article = articles[step.position]!;
      const newPrice = prices[step.position]!;
      const detail = await ownOffers.openOfferById(article.articleId);
      await detail.settleSellerList();
      const info = await detail.extractInfo();
      const articlePreview: Preview = {
        identity: { current: article.current },
        changes: { price: newPrice },
      };
      await detail.executeUserOfferUpdate(article.articleId, { price: newPrice }, info.title, info.printedIn, articlePreview);
      results[step.position] = {
        articleId: article.articleId,
        card: article.card,
        oldPrice: String(article.current && typeof article.current === 'object' && !Array.isArray(article.current) ? (article.current as Record<string, unknown>).price ?? '' : ''),
        newPrice,
        verified: true,
      };
      await ownOffers.goBack();
      await ownOffers.waitUntilReady();
    }
    if (results.some((result) => result === undefined)) throw new AutomationError('POSTCONDITION_FAILED');
    const updated = results as Array<{ articleId: number; card: string; oldPrice: string; newPrice: number; verified: boolean }>;
    await restoreOwnOffers(page, stockFilter, startPage);
    return {
      state: 'own-offers',
      count: updated.length,
      updated,
      auth,
    };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers', 'stock.market-comparison'],
};
