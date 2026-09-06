import type { Page } from 'playwright';

import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { parsePrice } from '../lib/parse.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';

import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { ResolvedSellerFilter, StockMarketComparisonOutput } from '../types.ts';
import { resolveSellerFilter, COUNTRY_INPUT_KEYS, SELLER_TYPE_VALUES, YES_NO_VALUES } from '../pages/seller-filters.ts';

const description = 'Iterate through all own offers and compare each against the market. For every card, opens the detail page, extracts the card\'s actual condition and language from the page, derives and verifies the seller filter, reads the lowest matching seller price, and returns a compact consolidated comparison. Leaves the browser on the own-offers page.';
const parameters: Fields = {
  limit: { type: 'integer', description: 'Maximale Anzahl zu pruefender Angebote (0 = alle)', default: 0, min: 0, max: 1000 },
  location: { type: 'string', description: 'Seller-Land fuer den Marktvergleich', default: 'germany', enum: COUNTRY_INPUT_KEYS },
  sellerType: { type: 'string', description: 'Seller-Typ fuer den Marktvergleich', default: 'any', enum: Object.keys(SELLER_TYPE_VALUES) },
  foil: { type: 'string', description: 'Foil-Filter fuer den Marktvergleich', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  signed: { type: 'string', description: 'Signiert-Filter fuer den Marktvergleich', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  altered: { type: 'string', description: 'Altered-Filter fuer den Marktvergleich', default: 'any', enum: Object.keys(YES_NO_VALUES) },
};
const outputDescription =
  '{ state, count, offers: [{ articleId, card, price, marketFrom, marketSellers, belowMarket }], auth }';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAuth(value: unknown): boolean {
  return isObject(value) && typeof value.loggedIn === 'boolean';
}

function isMarketComparisonOffer(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.articleId === 'number' &&
    typeof value.card === 'string' &&
    typeof value.price === 'string' &&
    typeof value.marketFrom === 'string' &&
    typeof value.marketSellers === 'number' &&
    typeof value.belowMarket === 'boolean'
  );
}

function validateOutput(raw: unknown): StockMarketComparisonOutput {
  if (!isObject(raw)) throw new AutomationError('POSTCONDITION_FAILED');
  if (raw.state !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
  if (typeof raw.count !== 'number' || !Array.isArray(raw.offers) || raw.count !== raw.offers.length ||
      !raw.offers.every(isMarketComparisonOffer) || !isAuth(raw.auth))
    throw new AutomationError('POSTCONDITION_FAILED');
  return raw as unknown as StockMarketComparisonOutput;
}

/** Map a display-condition string (e.g. "Excellent") to a filter condition key. */
function mapConditionToFilter(offerCondition: string): string {
  const normalized = offerCondition.trim().toLowerCase();
  const mapping: Record<string, string> = {
    'mint': 'mint',
    'near mint': 'near-mint',
    'excellent': 'excellent',
    'good': 'good',
    'light played': 'light-played',
    'played': 'played',
    'poor': 'poor',
    'any': 'any',
    'all': 'any',
  };
  return mapping[normalized] ?? 'excellent';
}

/** Map a display-language string (e.g. "English", "German") to a filter language key. */
function mapLanguageToFilter(offerLanguage: string): string {
  const normalized = offerLanguage.trim().toLowerCase();
  const mapping: Record<string, string> = {
    'english': 'english',
    'french': 'french',
    'german': 'german',
    'spanish': 'spanish',
    'italian': 'italian',
    's-chinese': 's-chinese',
    'japanese': 'japanese',
    'portuguese': 'portuguese',
    'russian': 'russian',
    't-chinese': 't-chinese',
  };
  return mapping[normalized] ?? 'english';
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
      throw new AutomationError('wrong_state' as never, `Expected own-offers, got ${state}`);
    }
    const auth = await readAuth(page);
    if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED', 'stock-market-comparison');

    const limit = (input.limit as number) || 0;
    const maxOffers = limit > 0 ? limit : 10000;

    const ownOffers = new OwnOffersPage(page);
    const listed = await ownOffers.extractOffers(maxOffers, false);
    const offers = listed.offers.slice(0, maxOffers);

    const results: Array<{
      articleId: number;
      card: string;
      price: string;
      marketFrom: string;
      marketSellers: number;
      belowMarket: boolean;
    }> = [];

    // Build the base filter from input (location, sellerType, foil, signed, altered)
    const baseFilter = resolveSellerFilter({
      location: input.location,
      sellerType: input.sellerType,
      foil: input.foil,
      signed: input.signed,
      altered: input.altered,
    } as ResolvedSellerFilter);

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      if (!offer) continue;

      // Open the detail page for this offer
      const detail = await ownOffers.openOffer(i);

      // Derive filter from the offer's own condition and language
      const offerCondition = mapConditionToFilter(offer.condition);
      const offerLanguage = mapLanguageToFilter(offer.language);

      // Build the filter: offer-specific condition/language + input location
      const filter: ResolvedSellerFilter = {
        condition: offerCondition as ResolvedSellerFilter['condition'],
        language: offerLanguage as ResolvedSellerFilter['language'],
        location: baseFilter.location,
        sellerType: baseFilter.sellerType,
        foil: baseFilter.foil,
        signed: baseFilter.signed,
        altered: baseFilter.altered,
      };

      // Apply the filter (only submits if it differs from current)
      if (await detail.applySellerFilters(filter)) {
        await detail.submitSellerFilters();
      }

      // Wait for sellers to load
      await detail.settleSellerList();

      // Verify the filter was applied correctly by reading it back
      const appliedFilter = await detail.readCurrentFilter();
      const filterMatch =
        appliedFilter.condition === filter.condition &&
        appliedFilter.language === filter.language &&
        appliedFilter.location === filter.location;

      if (!filterMatch) {
        // Filter did not match — reapply and reload
        await detail.applySellerFilters(filter);
        await detail.submitSellerFilters();
        await detail.settleSellerList();
      }

      // Read seller rows (limit to 3 for compact output)
      const sellers = await detail.extractSellers(3);
      const marketFrom = sellers.length > 0 && sellers[0] ? sellers[0].price : 'N/A';
      const marketSellers = sellers.length;

      // Check if our price is below market
      const ourPrice = parsePrice(offer.price);
      const marketPrice = marketFrom !== 'N/A' ? parsePrice(marketFrom) : null;
      const belowMarket = ourPrice !== null && marketPrice !== null && ourPrice <= marketPrice;

      results.push({
        articleId: offer.articleId,
        card: offer.card,
        price: offer.price,
        marketFrom,
        marketSellers,
        belowMarket,
      });

      // Navigate back to own-offers page for the next iteration
      await ownOffers.open();
    }

    return {
      state: 'own-offers',
      count: results.length,
      offers: results,
      auth,
    };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers', 'stock.market-comparison', 'user.offers'],
};
