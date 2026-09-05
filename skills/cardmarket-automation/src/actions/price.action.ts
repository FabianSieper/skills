import type { Page } from 'playwright';
import { SearchPage } from '../pages/SearchPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import {
  COUNTRY_INPUT_KEYS,
  CONDITION_VALUES,
  isResolvedSellerFilter,
  LANGUAGE_VALUES,
  resolveSellerFilter,
  SELLER_TYPE_VALUES,
  YES_NO_VALUES,
} from '../pages/seller-filters.ts';
import { emptyCardInfo } from '../types.ts';
import type {
  FilterCondition,
  FilterLanguage,
  FilterSellerType,
  FilterYesNo,
  PriceOutput,
} from '../types.ts';

const description =
  'Search a card by name, open its detail page via the search result tile, ' +
  'apply the seller filter, and return the top block (rarity, availability, ' +
  'price trend) plus the filtered seller offer list.';

const parameters: Fields = {
  name: {
    type: 'string',
    description: 'Kartenname (z. B. "Forest")',
    required: true,
    min: 1,
    max: 100,
  },
  sellers: {
    type: 'integer',
    description: 'Anzahl Seller-Zeilen (0 = nur Top-Block)',
    default: 50,
    min: 0,
    max: 500,
  },
  condition: {
    type: 'string',
    description: 'Mindestzustand (Default: excellent)',
    default: 'excellent',
    enum: Object.keys(CONDITION_VALUES),
  },
  language: {
    type: 'string',
    description: 'Kartensprache (Default: english)',
    default: 'english',
    enum: Object.keys(LANGUAGE_VALUES),
  },
  location: {
    type: 'string',
    description: 'Seller-Land, kanonisch oder Alias, z. B. germany/de/any (Default: germany)',
    default: 'germany',
    min: 1,
    max: 50,
    enum: COUNTRY_INPUT_KEYS,
  },
  sellerType: {
    type: 'string',
    description: 'Seller-Typ (Default: any)',
    default: 'any',
    enum: Object.keys(SELLER_TYPE_VALUES),
  },
  foil: {
    type: 'string',
    description: 'Foil (Default: any)',
    default: 'any',
    enum: Object.keys(YES_NO_VALUES),
  },
  signed: {
    type: 'string',
    description: 'Signiert (Default: any)',
    default: 'any',
    enum: Object.keys(YES_NO_VALUES),
  },
  altered: {
    type: 'string',
    description: 'Altered (Default: any)',
    default: 'any',
    enum: Object.keys(YES_NO_VALUES),
  },
};

const outputDescription =
  '{ found, card, url, filter: { condition, language, location, sellerType, ' +
  'foil, signed, altered }, info: { title, rarity, number, printedIn, ' +
  'reprints, availableItems, from, priceTrend, avg30d, avg7d, avg1d, image, ' +
  'url }, sellerCount, sellers: [{ seller, location, condition, language, ' +
  'price, quantity }] }';

function validateOutput(raw: unknown): PriceOutput {
  const o = raw as Record<string, unknown>;
  const info = o?.info as Record<string, unknown> | undefined;
  if (
    o === null ||
    typeof o !== 'object' ||
    typeof o.found !== 'boolean' ||
    typeof o.card !== 'string' ||
    typeof o.url !== 'string' ||
    !isResolvedSellerFilter(o?.filter) ||
    !info ||
    !['title', 'rarity', 'number', 'printedIn', 'reprints', 'availableItems', 'from', 'priceTrend', 'avg30d', 'avg7d', 'avg1d', 'image'].every(
      (k) => typeof info[k] === 'string',
    ) ||
    typeof o.sellerCount !== 'number' ||
    !Array.isArray(o.sellers) ||
    o.sellerCount !== o.sellers.length ||
    !o.sellers.every(
      (s) =>
        s !== null &&
        typeof s === 'object' &&
        ['seller', 'location', 'condition', 'language', 'price', 'quantity'].every(
          (k) => typeof (s as Record<string, unknown>)[k] === 'string',
        ),
    )
  ) {
    throw new AutomationError('POSTCONDITION_FAILED', 'cards.price');
  }
  return o as unknown as PriceOutput;
}

export const action: Action = {
  id: 'cards.price',
  description,
  parameters,
  outputDescription,
  modulePath: import.meta.url,
  next: ['cards.artworks'],
  kind: 'read',

  async run(page: Page, input: Input): Promise<PriceOutput> {
    const name = input.name as string;
    const n = (input.sellers ?? 50) as number;
    const filter = resolveSellerFilter({
      condition: input.condition as FilterCondition | undefined,
      language: input.language as FilterLanguage | undefined,
      location: input.location as string | undefined,
      sellerType: input.sellerType as FilterSellerType | undefined,
      foil: input.foil as FilterYesNo | undefined,
      signed: input.signed as FilterYesNo | undefined,
      altered: input.altered as FilterYesNo | undefined,
    });

    const results = await new SearchPage(page).search(name);
    const cards = await results.extractCards(1);
    const card = cards[0];
    if (!card) {
      return {
        found: false,
        card: name,
        url: '',
        filter,
        info: emptyCardInfo(),
        sellerCount: 0,
        sellers: [],
      };
    }

    const detail = await results.openCard(0);
    let info = await detail.extractInfo();
    const changed = await detail.applySellerFilters(filter);
    if (changed) await detail.submitSellerFilters();
    await detail.settleSellerList();
    if (changed) info = await detail.extractInfo().catch(() => info);
    const sellers = n > 0 ? await detail.extractSellers(n) : [];
    return {
      found: true,
      card: card.name,
      url: page.url(),
      filter,
      info,
      sellerCount: sellers.length,
      sellers,
    };
  },

  validateOutput,
};
