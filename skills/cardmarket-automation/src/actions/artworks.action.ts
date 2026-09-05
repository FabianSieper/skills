import type { Page } from 'playwright';
import { SearchPage } from '../pages/SearchPage.ts';
import { CardVersionsPage } from '../pages/CardVersionsPage.ts';
import { parseQty } from '../lib/parse.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { Artwork, ArtworkCheck, ArtworksOutput } from '../types.ts';

const description =
  'Search a card, open its versions page and list every printing / ' +
  'artwork; optionally check seller quantities per artwork.';

const parameters: Fields = {
  name: {
    type: 'string',
    description: 'Kartenname (z. B. "Forest")',
    required: true,
    min: 1,
    max: 100,
  },
  minQty: {
    type: 'integer',
    description: 'Mindestmenge eines einzelnen Sellers (0 = nur Liste)',
    default: 0,
    min: 0,
    max: 1000,
  },
  limit: {
    type: 'integer',
    description: 'Maximal gelistete Artworks',
    default: 40,
    min: 1,
    max: 200,
  },
};

const outputDescription =
  '{ found, card, versionsUrl, total, shown, minQuantity, ' +
  'artworks: [{ card, set, version, available, fromPrice, image, url, ' +
  'maxSellerQuantity?, sellersAtLeast?, qualifies? }] }';

function validateOutput(raw: unknown): ArtworksOutput {
  const o = raw as Record<string, unknown>;
  if (
    o === null ||
    typeof o !== 'object' ||
    typeof o.found !== 'boolean' ||
    typeof o.card !== 'string' ||
    typeof o.versionsUrl !== 'string' ||
    typeof o.total !== 'number' ||
    typeof o.shown !== 'number' ||
    typeof o.minQuantity !== 'number' ||
    !Array.isArray(o.artworks) ||
    o.shown !== o.artworks.length ||
    !o.artworks.every(
      (a) =>
        a !== null &&
        typeof a === 'object' &&
        ['card', 'set', 'version', 'available', 'fromPrice', 'image', 'url'].every(
          (k) => typeof (a as Record<string, unknown>)[k] === 'string',
        ) &&
        (o.minQuantity === 0 ||
          (typeof (a as Record<string, unknown>).maxSellerQuantity === 'number' &&
            typeof (a as Record<string, unknown>).sellersAtLeast === 'number' &&
            typeof (a as Record<string, unknown>).qualifies === 'boolean')),
    )
  ) {
    throw new AutomationError('POSTCONDITION_FAILED', 'cards.artworks');
  }
  return o as unknown as ArtworksOutput;
}

export const action: Action = {
  id: 'cards.artworks',
  description,
  parameters,
  outputDescription,
  modulePath: import.meta.url,
  next: ['cards.price'],
  kind: 'read',

  async run(page: Page, input: Input): Promise<ArtworksOutput> {
    const name = input.name as string;
    const minQty = (input.minQty ?? 0) as number;
    const limit = (input.limit ?? 40) as number;

    const results = await new SearchPage(page).search(name);
    const cards = await results.extractCards(1);
    const card = cards[0];
    if (!card) {
      return {
        found: false,
        card: name,
        versionsUrl: '',
        total: 0,
        shown: 0,
        minQuantity: minQty,
        artworks: [],
      };
    }

    const detail = await results.openCard(0);
    const hasVersions = await detail.hasVersions();
    if (!hasVersions) {
      return {
        found: false,
        card: card.name,
        versionsUrl: page.url(),
        total: 0,
        shown: 0,
        minQuantity: minQty,
        artworks: [],
      };
    }

    await detail.openVersions();
    const versions = new CardVersionsPage(page);
    const versionsUrl = page.url();
    const all = await versions.listArtworks();
    const total = await versions.totalFromHeading();
    const shown = Math.min(limit, all.length);
    const base = all.slice(0, shown);

    let artworks: (Artwork | ArtworkCheck)[] = base;
    if (minQty > 0) {
      const checks: (Artwork | ArtworkCheck)[] = [];
      for (let i = 0; i < shown; i++) {
        const d = await versions.openArtwork(i);
        const sellers = await d.extractSellers(200);
        const qtys = sellers.map((s) => parseQty(s.quantity));
        const max = qtys.length ? Math.max(...qtys) : 0;
        checks.push({
          ...base[i]!,
          maxSellerQuantity: max,
          sellersAtLeast: qtys.filter((q) => q >= minQty).length,
          qualifies: max >= minQty,
        });
        if (i < shown - 1) {
          // Return to the versions list via the visible "Show Versions" link so
          // the next tile click targets the versions page, not this detail page.
          await d.openVersions();
        }
      }
      artworks = checks;
    }

    return {
      found: true,
      card: card.name,
      versionsUrl,
      total,
      shown,
      minQuantity: minQty,
      artworks,
    };
  },

  validateOutput,
};