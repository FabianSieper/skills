import type { Page } from 'playwright';
import { SearchPage } from '../pages/SearchPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import { emptyCardInfo } from '../types.ts';
import type { PriceOutput } from '../types.ts';

const description =
  'Search a card by name, open its detail page via the search result tile ' +
  'and return the top block (rarity, availability, price trend) plus the ' +
  'seller offer list.';

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
};

const outputDescription =
  '{ found, card, url, info: { title, rarity, number, printedIn, ' +
  'reprints, availableItems, from, priceTrend, avg30d, avg7d, avg1d, image }, ' +
  'sellerCount, sellers: [{ seller, location, condition, language, price, quantity }] }';

function validateOutput(raw: unknown): PriceOutput {
  const o = raw as Record<string, unknown>;
  const info = o?.info as Record<string, unknown> | undefined;
  if (
    o === null ||
    typeof o !== 'object' ||
    typeof o.found !== 'boolean' ||
    typeof o.card !== 'string' ||
    typeof o.url !== 'string' ||
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

    const results = await new SearchPage(page).search(name);
    const cards = await results.extractCards(1);
    const card = cards[0];
    if (!card) {
      return {
        found: false,
        card: name,
        url: '',
        info: emptyCardInfo(),
        sellerCount: 0,
        sellers: [],
      };
    }

    const detail = await results.openCard(0);
    const info = await detail.extractInfo();
    const sellers = n > 0 ? await detail.extractSellers(n) : [];
    return {
      found: true,
      card: card.name,
      url: page.url(),
      info,
      sellerCount: sellers.length,
      sellers,
    };
  },

  validateOutput,
};
