import type { Page } from 'playwright';
import { SearchResultsPage } from '../pages/SearchResultsPage.ts';
import { CardDetailPage } from '../pages/CardDetailPage.ts';
import { CardVersionsPage } from '../pages/CardVersionsPage.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { parseQty } from '../lib/parse.ts';
import { isResolvedSellerFilter } from '../pages/seller-filters.ts';
import { resolveSellerFilter, COUNTRY_INPUT_KEYS, CONDITION_VALUES, LANGUAGE_VALUES, SELLER_TYPE_VALUES, YES_NO_VALUES } from '../pages/seller-filters.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { Artwork, ArtworkCheck, InfoOutput, OwnOfferFilterState, ResolvedSellerFilter } from '../types.ts';

const description = 'Read the current state and return state-specific data.';
const parameters: Fields = {
  limit: { type: 'integer', description: 'Ergebnisse oder Versionen, die gelesen werden sollen', default: 30, min: 1, max: 150 },
  sellers: { type: 'integer', description: 'Seller-Zeilen auf der Detailseite (0 = keine)', default: 50, min: 0, max: 500 },
  minQty: { type: 'integer', description: 'Mindest-Lagerbestand pro Seller beim Versions-Check', default: 0, min: 0, max: 1000 },
  all: { type: 'boolean', description: 'Auf der eigenen Angebotsseite jede Seite bis zur letzten lesen', default: false },
  condition: { type: 'string', description: 'Mindestzustand für gelesene Fremdangebote', default: 'excellent', enum: Object.keys(CONDITION_VALUES) },
  language: { type: 'string', description: 'Kartensprache für gelesene Fremdangebote', default: 'english', enum: Object.keys(LANGUAGE_VALUES) },
  location: { type: 'string', description: 'Seller-Land für gelesene Fremdangebote', default: 'germany', min: 1, max: 50, enum: COUNTRY_INPUT_KEYS },
  sellerType: { type: 'string', description: 'Seller-Typ für gelesene Fremdangebote', default: 'any', enum: Object.keys(SELLER_TYPE_VALUES) },
  foil: { type: 'string', description: 'Foil für gelesene Fremdangebote', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  signed: { type: 'string', description: 'Signiert für gelesene Fremdangebote', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  altered: { type: 'string', description: 'Altered für gelesene Fremdangebote', default: 'any', enum: Object.keys(YES_NO_VALUES) },
};
const outputDescription =
  'start: { state, ready, auth }; results: { state, query, count, cards, auth }; ' +
  'detail: { state, card, url, filter, info, sellerCount, sellers, auth }; ' +
  'versions: { state, card, versionsUrl, total, shown, minQuantity, artworks, auth }; ' +
  'own-offers: { state, url, filter, count, offers, pagesVisited, complete, auth }';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAuth(value: unknown): boolean {
  return isObject(value) && typeof value.loggedIn === 'boolean';
}

function hasStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string');
}

function isSearchCard(value: unknown): boolean {
  return isObject(value) && hasStrings(value, ['name', 'set', 'image', 'fromPrice', 'url']);
}

function isCardInfo(value: unknown): boolean {
  return isObject(value) && hasStrings(value, ['title', 'rarity', 'number', 'printedIn', 'reprints', 'availableItems', 'from', 'priceTrend', 'avg30d', 'avg7d', 'avg1d', 'image', 'url']);
}

function isSellerOffer(value: unknown): boolean {
  return isObject(value) && hasStrings(value, ['seller', 'location', 'condition', 'language', 'price', 'quantity']);
}

function isArtwork(value: unknown, minQuantity: number): boolean {
  if (!isObject(value) || !hasStrings(value, ['card', 'set', 'version', 'available', 'fromPrice', 'image', 'url'])) return false;
  if (minQuantity <= 0) return true;
  return typeof value.maxSellerQuantity === 'number' && typeof value.sellersAtLeast === 'number' && typeof value.qualifies === 'boolean';
}

function isOwnOfferFilter(value: unknown): value is OwnOfferFilterState {
  return isObject(value) && ['cardName', 'expansion', 'rarity', 'condition', 'language', 'comments', 'minPrice', 'maxPrice', 'minQuantity', 'foil', 'signed', 'altered', 'sort']
    .every((key) => typeof value[key] === 'string');
}

function isOwnOffer(value: unknown): boolean {
  return isObject(value) && typeof value.articleId === 'number' && typeof value.quantity === 'number' &&
    ['card', 'cardUrl', 'condition', 'language', 'price'].every((key) => typeof value[key] === 'string');
}

function sellerFilterFromInput(input: Input): ResolvedSellerFilter {
  return resolveSellerFilter({
    condition: input.condition,
    language: input.language,
    location: input.location,
    sellerType: input.sellerType,
    foil: input.foil,
    signed: input.signed,
    altered: input.altered,
  } as ResolvedSellerFilter);
}

function sameFilter(left: ResolvedSellerFilter, right: ResolvedSellerFilter): boolean {
  return left.condition === right.condition && left.language === right.language && left.location === right.location &&
    left.sellerType === right.sellerType && left.foil === right.foil && left.signed === right.signed && left.altered === right.altered;
}

function validateOutput(raw: unknown): InfoOutput {
  if (!isObject(raw)) throw new AutomationError('POSTCONDITION_FAILED');
  if (raw.state === 'start') {
    if (typeof raw.ready !== 'boolean' || !isAuth(raw.auth)) throw new AutomationError('POSTCONDITION_FAILED');
    return raw as unknown as InfoOutput;
  }
  if (raw.state === 'results') {
    if (typeof raw.query !== 'string' || typeof raw.count !== 'number' || !Array.isArray(raw.cards) || raw.count !== raw.cards.length || !raw.cards.every(isSearchCard) || !isAuth(raw.auth)) throw new AutomationError('POSTCONDITION_FAILED');
    return raw as unknown as InfoOutput;
  }
  if (raw.state === 'detail') {
    if (typeof raw.card !== 'string' || typeof raw.url !== 'string' || !isResolvedSellerFilter(raw.filter) || !isCardInfo(raw.info) || typeof raw.sellerCount !== 'number' || !Array.isArray(raw.sellers) || raw.sellerCount !== raw.sellers.length || !raw.sellers.every(isSellerOffer) || !isAuth(raw.auth)) throw new AutomationError('POSTCONDITION_FAILED');
    return raw as unknown as InfoOutput;
  }
  if (raw.state === 'versions') {
    if (typeof raw.card !== 'string' || typeof raw.versionsUrl !== 'string' || typeof raw.total !== 'number' || typeof raw.shown !== 'number' || typeof raw.minQuantity !== 'number' || !Array.isArray(raw.artworks) || raw.shown !== raw.artworks.length || !raw.artworks.every((a) => isArtwork(a, raw.minQuantity as number)) || !isAuth(raw.auth)) throw new AutomationError('POSTCONDITION_FAILED');
    return raw as unknown as InfoOutput;
  }
  if (raw.state === 'own-offers') {
    if (typeof raw.url !== 'string' || !isOwnOfferFilter(raw.filter) || typeof raw.count !== 'number' || !Number.isSafeInteger(raw.count) || raw.count < 0 ||
        !Array.isArray(raw.offers) || raw.count !== raw.offers.length || !raw.offers.every(isOwnOffer) ||
        typeof raw.pagesVisited !== 'number' || !Number.isSafeInteger(raw.pagesVisited) || raw.pagesVisited < 1 || typeof raw.complete !== 'boolean' || !isAuth(raw.auth))
      throw new AutomationError('POSTCONDITION_FAILED');
    return raw as unknown as InfoOutput;
  }
  throw new AutomationError('POSTCONDITION_FAILED');
}

export const action: Action = {
  id: 'info',
  description,
  parameters,
  outputDescription,
  validateOutput,
  kind: 'read',
  run: async (page: Page, input: Input): Promise<InfoOutput> => {
    const state = detectState(page);
    const auth = await readAuth(page);
    if (state === 'start') return { state, ready: true, auth };
    if (state === 'results') {
      const results = new SearchResultsPage(page);
      const cards = await results.extractCards(input.limit as number);
      return { state, query: await results.query(), count: cards.length, cards, auth };
    }
    if (state === 'detail') {
      const detail = new CardDetailPage(page);
      const info = await detail.extractInfo();
      // A detail page can retain arbitrary UI state from a previous visit. Do
      // not report competitors until the exact default or user-requested
      // filter is visibly active.
      const wantedFilter = sellerFilterFromInput(input);
      if (await detail.applySellerFilters(wantedFilter)) {
        await detail.submitSellerFilters();
        await detail.settleSellerList();
      }
      const filter = await detail.readCurrentFilter();
      if (!sameFilter(filter, wantedFilter)) throw new AutomationError('POSTCONDITION_FAILED', 'seller-filter');
      const sellerLimit = input.sellers as number;
      const sellers = sellerLimit > 0 ? await detail.extractSellers(sellerLimit) : [];
      return { state, card: info.title, url: page.url(), filter, info, sellerCount: sellers.length, sellers, auth };
    }
    if (state === 'own-offers') {
      if (!auth.loggedIn) throw new AutomationError('AUTH_REQUIRED', 'own-offers-login');
      const ownOffers = new OwnOffersPage(page);
      const listed = await ownOffers.extractOffers(input.limit as number, input.all as boolean);
      return {
        state,
        url: page.url(),
        filter: await ownOffers.readCurrentFilter(),
        count: listed.offers.length,
        offers: listed.offers,
        pagesVisited: listed.pagesVisited,
        complete: listed.complete,
        auth,
      };
    }
    const versions = new CardVersionsPage(page);
    const limit = input.limit as number;
    const minQty = input.minQty as number;
    const all = await versions.listArtworks();
    const total = await versions.totalFromHeading();
    const shown = Math.min(limit, all.length);
    const base = all.slice(0, shown);
    const versionsUrl = page.url();
    let artworks: (Artwork | ArtworkCheck)[] = base;
    if (minQty > 0) {
      const checks: ArtworkCheck[] = [];
      for (let i = 0; i < shown; i++) {
        const detail = await versions.openArtwork(i);
        const sellers = await detail.extractSellers(200);
        const quantities = sellers.map((seller) => parseQty(seller.quantity));
        const maxSellerQuantity = quantities.length ? Math.max(...quantities) : 0;
        checks.push({ ...(base[i] as Artwork), maxSellerQuantity, sellersAtLeast: quantities.filter((q) => q >= minQty).length, qualifies: maxSellerQuantity >= minQty });
        await detail.gotoAllowed(versionsUrl);
      }
      artworks = checks;
    }
    return { state: 'versions', card: await versions.cardFromUrl(), versionsUrl, total, shown, minQuantity: minQty, artworks, auth };
  },
  modulePath: import.meta.url,
  next: ['nav.home', 'nav.search', 'nav.open', 'nav.versions', 'nav.artwork', 'nav.filter', 'nav.own-offers', 'nav.own-offers.filter', 'nav.own-offers.open', 'user.offers'],
};
