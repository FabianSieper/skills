import type { Page } from 'playwright';
import { SearchPage } from '../pages/SearchPage.ts';
import { SearchResultsPage } from '../pages/SearchResultsPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input, Json } from '../runtime/input.ts';
import type { SearchOutput } from '../types.ts';

const description =
  'Search Cardmarket for trading cards (e.g. "Forest") and return the ' +
  'result tiles with set, from-price and detail URL.';

const parameters: Fields = {
  query: {
    type: 'string',
    description: 'Suchbegriff / Kartenname (z. B. "Forest")',
    required: true,
    min: 1,
    max: 100,
  },
  limit: {
    type: 'integer',
    description: 'Maximal anzuzeigende Result-Kacheln',
    default: 20,
    min: 1,
    max: 50,
  },
};

const outputDescription =
  '{ query, count, cards: [{ name, set, image, fromPrice, url }] }';

function validateOutput(raw: unknown): SearchOutput {
  const o = raw as Record<string, unknown>;
  if (
    o === null ||
    typeof o !== 'object' ||
    !Array.isArray(o.cards) ||
    typeof o.query !== 'string' ||
    typeof o.count !== 'number' ||
    o.count !== o.cards.length ||
    !o.cards.every(
      (c) =>
        c !== null &&
        typeof c === 'object' &&
        ['name', 'set', 'image', 'fromPrice', 'url'].every((k) =>
          typeof (c as Record<string, unknown>)[k] === 'string',
        ),
    )
  ) {
    throw new AutomationError('POSTCONDITION_FAILED', 'cards.search');
  }
  return o as unknown as SearchOutput;
}

export const action: Action = {
  id: 'cards.search',
  description,
  parameters,
  outputDescription,
  modulePath: import.meta.url,
  next: ['cards.price', 'cards.artworks'],
  kind: 'read',

  async run(page: Page, input: Input): Promise<SearchOutput> {
    const query = input.query as string;
    const limit = (input.limit ?? 20) as number;
    const results: SearchResultsPage = await new SearchPage(page).search(query);
    const cards = await results.extractCards(limit);
    return { query, count: cards.length, cards };
  },

  validateOutput,
};

export type { Json };