import type { Page } from 'playwright';

import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { parsePrice } from '../lib/parse.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { asFilter, pageOfIndex, restoreOwnOffers, startPageOf } from './stock-common.ts';

import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { MarketComparisonRow, ResolvedSellerFilter, SellerOffer, StockMarketComparisonOutput } from '../types.ts';
import { resolveSellerFilter, sameResolvedSellerFilter, COUNTRY_INPUT_KEYS, SELLER_TYPE_VALUES, YES_NO_VALUES } from '../pages/seller-filters.ts';

const description =
  'Compare own offers to matching market sellers. Phase 1 reads all offers (fast, no detail pages) and applies minPrice/maxPrice/minQty filters. Phase 2 navigates to each qualifying card detail page, applies and verifies the seller filter (condition+language from the offer, location from input), and reads the cheapest matching sellers. Use offset+limit to batch large stocks. Leaves the browser on the own-offers page.';

const parameters: Fields = {
  limit: { type: 'integer', description: 'Max offers to process in this call; 0 = all remaining', default: 0, min: 0, max: 1000 },
  offset: { type: 'integer', description: 'Skip the first N qualifying offers (use with limit for batch processing)', default: 0, min: 0, max: 10000 },
  minPrice: { type: 'number', description: 'Only include own offers with price >= this EUR; 0 = no filter', default: 0, min: 0, max: 1000000 },
  maxPrice: { type: 'number', description: 'Only include own offers with price <= this EUR; 0 = no filter', default: 0, min: 0, max: 1000000 },
  minQty: { type: 'integer', description: 'Only include own offers with quantity >= this; 1 = no filter', default: 1, min: 0, max: 1000000 },
  location: { type: 'string', description: 'Seller country for the market filter', default: 'germany', enum: COUNTRY_INPUT_KEYS },
  sellerType: { type: 'string', description: 'Seller type for the market filter', default: 'any', enum: Object.keys(SELLER_TYPE_VALUES) },
  foil: { type: 'string', description: 'Foil filter for the market', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  signed: { type: 'string', description: 'Signed filter for the market', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  altered: { type: 'string', description: 'Altered filter for the market', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  sellers: { type: 'integer', description: 'How many market sellers to return per card (cheapest first); 0 = only marketFrom, no seller details', default: 3, min: 0, max: 50 },
  sortResult: { type: 'string', description: 'Sort order: price (own price asc), marketFrom (cheapest market), diff (marketFrom - own price, most negative first)', default: 'price', enum: ['price', 'marketFrom', 'diff'] },
};

const outputDescription =
  '{ state, offset, count, hasMore, offers: [{ articleId, card, price, quantity, condition, language, marketFrom, marketSellers: [SellerOffer...], belowMarket, diff }], auth }';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAuth(value: unknown): boolean {
  return isObject(value) && typeof value.loggedIn === 'boolean';
}

function isSellerOffer(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.seller === 'string' &&
    typeof value.location === 'string' &&
    typeof value.condition === 'string' &&
    typeof value.language === 'string' &&
    typeof value.price === 'string' &&
    typeof value.quantity === 'string'
  );
}

function isMarketComparisonRow(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.articleId === 'number' &&
    typeof value.card === 'string' &&
    typeof value.price === 'string' &&
    typeof value.quantity === 'number' &&
    typeof value.condition === 'string' &&
    typeof value.language === 'string' &&
    typeof value.marketFrom === 'string' &&
    Array.isArray(value.marketSellers) &&
    (value.marketSellers as unknown[]).every(isSellerOffer) &&
    typeof value.belowMarket === 'boolean' &&
    (value.diff === null || typeof value.diff === 'number')
  );
}

function validateOutput(raw: unknown): StockMarketComparisonOutput {
  if (!isObject(raw)) throw new AutomationError('POSTCONDITION_FAILED');
  if (raw.state !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
  if (typeof raw.offset !== 'number' || !Number.isSafeInteger(raw.offset) || raw.offset < 0)
    throw new AutomationError('POSTCONDITION_FAILED');
  if (typeof raw.count !== 'number' || !Number.isSafeInteger(raw.count) || raw.count < 0)
    throw new AutomationError('POSTCONDITION_FAILED');
  if (typeof raw.hasMore !== 'boolean') throw new AutomationError('POSTCONDITION_FAILED');
  if (!Array.isArray(raw.offers) || raw.offers.length !== raw.count)
    throw new AutomationError('POSTCONDITION_FAILED');
  if (!(raw.offers as unknown[]).every(isMarketComparisonRow))
    throw new AutomationError('POSTCONDITION_FAILED');
  if (!isAuth(raw.auth)) throw new AutomationError('POSTCONDITION_FAILED');
  return raw as unknown as StockMarketComparisonOutput;
}

function mapConditionToFilter(offerCondition: string): ResolvedSellerFilter['condition'] | null {
  const normalized = offerCondition.trim().toLowerCase();
  const mapping: Record<string, ResolvedSellerFilter['condition']> = {
    mint: 'mint',
    'near mint': 'near-mint',
    'near-mint': 'near-mint',
    excellent: 'excellent',
    good: 'good',
    'light played': 'light-played',
    'light-played': 'light-played',
    played: 'played',
    poor: 'poor',
    any: 'any',
    all: 'any',
  };
  return mapping[normalized] ?? null;
}

function mapLanguageToFilter(offerLanguage: string): ResolvedSellerFilter['language'] | null {
  const normalized = offerLanguage.trim().toLowerCase();
  const mapping: Record<string, ResolvedSellerFilter['language']> = {
    english: 'english',
    french: 'french',
    german: 'german',
    spanish: 'spanish',
    italian: 'italian',
    's-chinese': 's-chinese',
    's chinesisch': 's-chinese',
    japanese: 'japanese',
    portuguese: 'portuguese',
    russian: 'russian',
    't-chinese': 't-chinese',
    't chinesisch': 't-chinese',
  };
  return mapping[normalized] ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sortResults(results: MarketComparisonRow[], sortKey: string): MarketComparisonRow[] {
  const copy = [...results];
  switch (sortKey) {
    case 'marketFrom':
      copy.sort((a, b) =>
        (parsePrice(a.marketFrom) ?? Number.MAX_SAFE_INTEGER) -
        (parsePrice(b.marketFrom) ?? Number.MAX_SAFE_INTEGER),
      );
      break;
    case 'diff':
      copy.sort((a, b) => {
        if (a.diff === null && b.diff === null) return 0;
        if (a.diff === null) return 1;
        if (b.diff === null) return -1;
        return a.diff - b.diff;
      });
      break;
    case 'price':
    default:
      copy.sort((a, b) =>
        (parsePrice(a.price) ?? Number.MAX_SAFE_INTEGER) -
        (parsePrice(b.price) ?? Number.MAX_SAFE_INTEGER),
      );
      break;
  }
  return copy;
}

export const action: Action = {
  id: 'stock.market-comparison',
  kind: 'read',
  description,
  parameters,
  outputDescription,
  validateOutput,
  run: async (page: Page, input: Input): Promise<StockMarketComparisonOutput> => {
    const state = detectState(page);
    if (state !== 'own-offers') {
      throw new AutomationError('WRONG_STATE', 'source-state', {
        expected: ['own-offers'], actual: state, operation: 'stock.market-comparison',
      });
    }
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED', 'stock-market-comparison');

    const offset = input.offset as number;
    const limit = (input.limit as number) || 0;
    const minPrice = input.minPrice as number;
    const maxPrice = input.maxPrice as number;
    const minQty = input.minQty as number;
    const sellersN = input.sellers as number;
    const sortResult = input.sortResult as string;

    const ownOffers = new OwnOffersPage(page);
    const startUrl = page.url();
    const stockFilter = asFilter(await ownOffers.readCurrentFilter());
    const startPage = startPageOf(startUrl);

    // Phase 1: read all own offers via proven pagination (no detail pages)
    const { offers: allOffers } = await ownOffers.extractOffers(0, true);

    // Apply price/qty filters
    const qualifying = allOffers.filter((offer) => {
      const price = parsePrice(offer.price);
      if (minPrice > 0 && (price === null || price < minPrice)) return false;
      if (maxPrice > 0 && (price === null || price > maxPrice)) return false;
      if (minQty > 1 && offer.quantity < minQty) return false;
      return true;
    });

    // Apply offset + limit
    const workingSet = limit > 0 ? qualifying.slice(offset, offset + limit) : qualifying.slice(offset);
    const hasMore = qualifying.length > offset + workingSet.length;

    if (workingSet.length === 0) {
      await restoreOwnOffers(page, stockFilter, startPage);
      return { state: 'own-offers', offset, count: 0, hasMore, offers: [], auth };
    }

    // Build base filter from input params (location, sellerType, foil, signed, altered)
    const baseFilter = resolveSellerFilter({
      condition: 'excellent' as ResolvedSellerFilter['condition'],
      language: 'english' as ResolvedSellerFilter['language'],
      location: input.location,
      sellerType: input.sellerType,
      foil: input.foil,
      signed: input.signed,
      altered: input.altered,
    } as ResolvedSellerFilter);

    const results: MarketComparisonRow[] = [];

    // Phase 2: open each qualifying offer through its own-offers row (UI
    // click, page by page); raw `goto` is home-only.
    const stockOffers = await restoreOwnOffers(page, stockFilter, 1);
    let currentStockPage = 1;
    for (const offer of workingSet) {
      const allIndex = allOffers.findIndex((candidate) => candidate.articleId === offer.articleId);
      if (allIndex < 0) throw new AutomationError('UI_DRIFT', `offer-index-${offer.articleId}`);
      const targetPage = pageOfIndex(allIndex);
      if (targetPage < currentStockPage)
        throw new AutomationError('UI_DRIFT', `stock-page-order-${offer.articleId}`);
      while (currentStockPage < targetPage) {
        if (!(await stockOffers.goToNextPage()))
          throw new AutomationError('UI_DRIFT', `stock-page-${targetPage}`);
        currentStockPage++;
      }
      const detail = await stockOffers.openOfferById(offer.articleId);
      await detail.waitUntilReady(60_000);

      // Derive filter from the offer's own condition and language + input params
      const condition = mapConditionToFilter(offer.condition);
      const language = mapLanguageToFilter(offer.language);
      if (!condition || !language) {
        throw new AutomationError('POSTCONDITION_FAILED', 'offer-filter-mapping', {
          operation: 'stock.market-comparison',
          expected: { condition: 'recognized-offer-condition', language: 'recognized-offer-language' },
          actual: { condition: offer.condition, language: offer.language },
        });
      }
      const filter: ResolvedSellerFilter = {
        condition,
        language,
        location: baseFilter.location,
        sellerType: baseFilter.sellerType,
        foil: baseFilter.foil,
        signed: baseFilter.signed,
        altered: baseFilter.altered,
      };

      let filterApplied = false;
      let effectiveFilter: ResolvedSellerFilter = filter;
      try {
        filterApplied = await detail.applySellerFilters(filter);
      } catch (err) {
        if (err instanceof AutomationError && err.code === 'FILTER_NOT_AVAILABLE' && filter.language !== 'any') {
          const fallback: ResolvedSellerFilter = {
            ...filter,
            language: 'any',
          };
          filterApplied = await detail.applySellerFilters(fallback);
          effectiveFilter = fallback;
        } else {
          throw err;
        }
      }

      if (filterApplied) {
        await detail.submitSellerFilters();
      }
      await detail.settleSellerList();

      // Verify every resolved filter field before reading market sellers.
      const appliedFilter = await detail.readCurrentFilter();
      const criticalMatch = sameResolvedSellerFilter(appliedFilter, effectiveFilter);

      if (!criticalMatch) {
        await detail.applySellerFilters(effectiveFilter);
        await detail.submitSellerFilters();
        await detail.settleSellerList();
        const retryFilter = await detail.readCurrentFilter();
        const retryMatch = sameResolvedSellerFilter(retryFilter, effectiveFilter);
        if (!retryMatch) {
          throw new AutomationError('FILTER_MISMATCH', 'filter-mismatch', {
            operation: 'stock.market-comparison', expected: effectiveFilter, actual: retryFilter,
          });
        }
      }

      // Read seller rows
      const sellers: SellerOffer[] = sellersN > 0 ? await detail.extractSellers(sellersN) : [];
      const firstSeller = sellers[0];
      const marketFrom = firstSeller ? firstSeller.price : 'N/A';

      // Compute diff and belowMarket
      const ownPrice = parsePrice(offer.price);
      const marketPrice = marketFrom !== 'N/A' ? parsePrice(marketFrom) : null;
      const belowMarket = ownPrice !== null && marketPrice !== null && ownPrice <= marketPrice;
      const diff = ownPrice !== null && marketPrice !== null ? round2(marketPrice - ownPrice) : null;

      results.push({
        articleId: offer.articleId,
        card: offer.card,
        price: offer.price,
        quantity: offer.quantity,
        condition: offer.condition,
        language: offer.language,
        marketFrom,
        marketSellers: sellers,
        belowMarket,
        diff,
      });
      await stockOffers.goBack();
      await stockOffers.waitUntilReady();
    }

    // Navigate back to the original own-offers page
    await restoreOwnOffers(page, stockFilter, startPage);

    const sorted = sortResults(results, sortResult);

    return {
      state: 'own-offers',
      offset,
      count: sorted.length,
      hasMore,
      offers: sorted,
      auth,
    };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers', 'stock.market-comparison', 'user.offers'],
};
