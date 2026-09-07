import type { Page } from 'playwright';
import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { parsePrice, parsePriceValue, normalizeName } from '../lib/parse.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { CardDetailPage, sameFormState } from '../pages/CardDetailPage.ts';
import { AutomationError, normalizeError } from '../runtime/errors.ts';
import type { Action, Preview } from '../runtime/engine.ts';
import type { Fields, Input, Json } from '../runtime/input.ts';
import type { OwnOffer, StockBulkPriceByNameItem, StockBulkPriceByNameFailedItem, StockBulkPriceByNameOutput } from '../types.ts';

const description =
  'Bulk-update own-offer prices by card name. Requires parallel names and prices arrays; optional articleIds disambiguate duplicate card names. Uses the Singles filter and stock edit modal, then verifies each changed price after approval.';

const parameters: Fields = {
  names: { type: 'string[]', description: 'Kartennamen, deren eigener Angebotspreis geaendert wird (index-aligniert mit prices)', required: true, min: 1, max: 1000 },
  prices: { type: 'string[]', description: 'Neue Preise in EUR, z.B. "1.23" oder "1,23" (index-aligniert mit names)', required: true, min: 1, max: 1000 },
  articleIds: {
    type: 'string[]',
    description: 'Optional article IDs zur Eindeutigkeitsaufoesung; leerer String laesst den Namen auflösen, Index muss names entsprechen',
    required: false,
    default: [],
    min: 0,
    max: 1000,
  },
};

const outputDescription =
  '{ state, count, updated: [{ name, articleId, card, oldPrice, newPrice, verified }], unchanged: [...], failed: [{ name, articleId, card, oldPrice, newPrice, reason }], auth }';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAuth(value: unknown): boolean {
  return isObject(value) && typeof value.loggedIn === 'boolean';
}

function isByNameItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.name === 'string' &&
    typeof value.articleId === 'number' &&
    typeof value.card === 'string' &&
    typeof value.oldPrice === 'string' &&
    typeof value.newPrice === 'number' &&
    typeof value.verified === 'boolean'
  );
}

function isFailedItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.name === 'string' &&
    typeof value.articleId === 'number' &&
    typeof value.card === 'string' &&
    typeof value.oldPrice === 'string' &&
    typeof value.newPrice === 'number' &&
    typeof value.reason === 'string'
  );
}

function validateOutput(raw: unknown): StockBulkPriceByNameOutput {
  if (
    !isObject(raw) ||
    raw.state !== 'own-offers' ||
    typeof raw.count !== 'number' ||
    !Array.isArray(raw.updated) ||
    !raw.updated.every(isByNameItem) ||
    !Array.isArray(raw.unchanged) ||
    !raw.unchanged.every(isByNameItem) ||
    !Array.isArray(raw.failed) ||
    !raw.failed.every(isFailedItem) ||
    raw.count !== raw.updated.length + raw.unchanged.length + raw.failed.length ||
    !isAuth(raw.auth)
  )
    throw new AutomationError('POSTCONDITION_FAILED');
  return raw as unknown as StockBulkPriceByNameOutput;
}

function parseArticleId(value: string, index: number): number {
  if (!/^\d+$/.test(value)) throw new AutomationError('INVALID_INPUT', `articleIds[${index}]`);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AutomationError('INVALID_INPUT', `articleIds[${index}]`);
  return id;
}

function parseOptionalArticleId(value: string, index: number): number | undefined {
  if (value === '') return undefined;
  return parseArticleId(value, index);
}

function parseNewPrice(value: string, index: number): number {
  const price = parsePriceValue(value);
  if (price === null || price < 0.01 || price > 1_000_000) throw new AutomationError('INVALID_INPUT', `prices[${index}]`);
  return price;
}

function pricesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.005;
}

type ResolvedEntry = {
  name: string;
  articleId: number;
  price: number;
  offer: OwnOffer;
};

type ArticlePreview = {
  name: string;
  articleId: number;
  card: string;
  cardUrl: string;
  oldPrice: string;
  current: Json;
};

async function resolveEntries(page: Page, input: Input): Promise<ResolvedEntry[]> {
  const rawNames = input.names as string[];
  const rawPrices = input.prices as string[];
  const rawIds = (input.articleIds as string[] | undefined) ?? [];
  if (rawNames.length !== rawPrices.length) throw new AutomationError('INVALID_INPUT', 'names/prices length mismatch');
  if (rawIds.length !== 0 && rawIds.length !== rawNames.length) throw new AutomationError('INVALID_INPUT', 'articleIds/names length mismatch');
  const names = rawNames.map((value, index) => {
    const name = value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) throw new AutomationError('INVALID_INPUT', `names[${index}]`);
    return name;
  });
  const prices = rawPrices.map((value, index) => parseNewPrice(value, index));
  const optionalIds = rawIds.map((value, index) => parseOptionalArticleId(value, index));
  const seenExplicit = new Set<number>();
  for (const id of optionalIds) {
    if (id === undefined) continue;
    if (seenExplicit.has(id)) throw new AutomationError('INVALID_INPUT', `duplicate articleId ${id}`);
    seenExplicit.add(id);
  }

  const groups = new Map<string, { displayName: string; indices: number[] }>();
  names.forEach((name, index) => {
    const key = normalizeName(name);
    const group = groups.get(key) ?? { displayName: name, indices: [] };
    group.indices.push(index);
    groups.set(key, group);
  });

  const ownOffers = new OwnOffersPage(page);
  const byIndex: Array<ResolvedEntry | null> = new Array<ResolvedEntry | null>(names.length).fill(null);
  const seenResolved = new Set<number>();
  for (const [key, group] of groups) {
    await ownOffers.open();
    await ownOffers.setCardNameFilter(group.displayName);
    const candidates = await ownOffers.searchOffers(1000);
    const candidateById = new Map<number, OwnOffer>();
    const candidateByName = new Map<number, OwnOffer>();
    for (const candidate of candidates) {
      candidateById.set(candidate.articleId, candidate);
      if (normalizeName(candidate.card) === key) candidateByName.set(candidate.articleId, candidate);
    }
    for (const index of group.indices) {
      const name = names[index]!;
      const explicitId = optionalIds[index];
      let offer: OwnOffer | undefined;
      if (explicitId !== undefined) {
        offer = candidateById.get(explicitId);
      } else if (candidateByName.size === 1) {
        offer = candidateByName.values().next().value;
      } else if (candidateByName.size > 1) {
        throw new AutomationError('INVALID_INPUT', `ambiguous card name ${name}; provide articleIds[${index}]`);
      }
      if (!offer) throw new AutomationError('UI_DRIFT', `own-offer ${name} not found`);
      if (seenResolved.has(offer.articleId)) throw new AutomationError('INVALID_INPUT', `duplicate articleId ${offer.articleId}`);
      seenResolved.add(offer.articleId);
      byIndex[index] = { name, articleId: offer.articleId, price: prices[index]!, offer };
    }
  }

  const entries: ResolvedEntry[] = [];
  for (const entry of byIndex) {
    if (!entry) throw new AutomationError('POSTCONDITION_FAILED');
    entries.push(entry);
  }
  return entries;
}

async function readPrepareStates(page: Page, entries: ResolvedEntry[]): Promise<Json[]> {
  const ownOffers = new OwnOffersPage(page);
  const states: Json[] = [];
  for (const entry of entries) {
    try {
      await ownOffers.focusOffer(entry.name, entry.articleId, true);
      await ownOffers.openEditModal(entry.articleId);
      const state = await ownOffers.readEditForm(entry.articleId);
      await ownOffers.closeEditModal();
      states.push(state as unknown as Json);
    } catch (error) {
      await ownOffers.closeEditModal().catch(() => {});
      throw error;
    }
  }
  await ownOffers.open();
  return states;
}

export const action: Action = {
  id: 'stock.bulk-price-by-name',
  kind: 'write',
  description,
  parameters,
  outputDescription,
  validateOutput,
  prepare: async (page: Page, input: Input): Promise<Preview> => {
    if (detectState(page) !== 'own-offers') throw new AutomationError('INVALID_INPUT', 'state');
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED');
    const entries = await resolveEntries(page, input);
    const formStates = await readPrepareStates(page, entries);
    const articles: ArticlePreview[] = entries.map((entry, index) => ({
      name: entry.name,
      articleId: entry.articleId,
      card: entry.offer.card,
      cardUrl: entry.offer.cardUrl,
      oldPrice: entry.offer.price,
      current: formStates[index]!,
    }));
    return {
      identity: { articles },
      changes: { prices: entries.map((entry) => entry.price) },
    };
  },
  execute: async (page: Page, input: Input, preview: Preview): Promise<StockBulkPriceByNameOutput> => {
    if (detectState(page) !== 'own-offers') throw new AutomationError('INVALID_INPUT', 'state');
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED');
    const entries = await resolveEntries(page, input);
    const articles = (preview.identity as { articles: ArticlePreview[] }).articles;
    if (!Array.isArray(articles) || articles.length !== entries.length) throw new AutomationError('POSTCONDITION_FAILED');
    const previewById = new Map<number, ArticlePreview>();
    for (const article of articles) previewById.set(article.articleId, article);

    const ownOffers = new OwnOffersPage(page);
    const updated: StockBulkPriceByNameItem[] = [];
    const unchanged: StockBulkPriceByNameItem[] = [];
    const failed: StockBulkPriceByNameFailedItem[] = [];

    for (const entry of entries) {
      const base = {
        name: entry.name,
        articleId: entry.articleId,
        card: entry.offer.card,
        oldPrice: entry.offer.price,
        newPrice: entry.price,
      };
      try {
        const article = previewById.get(entry.articleId);
        if (!article || article.name !== entry.name || article.card !== entry.offer.card || article.cardUrl !== entry.offer.cardUrl)
          throw new AutomationError('PLAN_CHANGED', 'preview-entry');
        await ownOffers.focusOffer(entry.name, entry.articleId, true);
        await ownOffers.openEditModal(entry.articleId);
        const current = await ownOffers.readEditForm(entry.articleId);
        if (!sameFormState(current, article.current)) {
          await ownOffers.closeEditModal();
          throw new AutomationError('PLAN_CHANGED', 'offer-form');
        }
        const currentPrice = parsePriceValue(current.price);
        if (currentPrice === null) {
          await ownOffers.closeEditModal();
          throw new AutomationError('UI_DRIFT', 'current-price');
        }
        if (pricesEqual(currentPrice, entry.price)) {
          await ownOffers.closeEditModal();
          unchanged.push({ ...base, verified: true });
          continue;
        }
        await ownOffers.applyEditPrice(entry.articleId, entry.price);
        await ownOffers.submitEditForm();
        await ownOffers.waitForRow(entry.articleId);
        let verified = false;
        const row = await ownOffers.readRowByArticleId(entry.articleId);
        const rowPrice = row ? parsePrice(row.price) : null;
        if (rowPrice !== null && pricesEqual(rowPrice, entry.price)) verified = true;
        if (!verified) {
          const detail = new CardDetailPage(page);
          await detail.gotoAllowed(entry.offer.cardUrl);
          await detail.settleSellerList();
          const info = await detail.extractInfo();
          const detailOffer = await detail.readUserStockOffer(entry.articleId, info.title, info.printedIn);
          const detailPrice = parsePrice(detailOffer.price);
          if (detailPrice !== null && pricesEqual(detailPrice, entry.price)) verified = true;
          await ownOffers.open();
        }
        if (!verified) throw new AutomationError('POSTCONDITION_FAILED', 'price');
        updated.push({ ...base, verified: true });
      } catch (error) {
        await ownOffers.closeEditModal().catch(() => {});
        failed.push({ ...base, reason: normalizeError(error).code });
      }
    }

    await ownOffers.open();
    return {
      state: 'own-offers',
      count: updated.length + unchanged.length + failed.length,
      updated,
      unchanged,
      failed,
      auth,
    };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers', 'stock.market-comparison', 'stock.bulk-price-update'],
};
