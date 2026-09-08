import type { Page } from 'playwright';
import { detectState } from '../lib/state.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import { isStateId, type NavOutput, type OwnOfferFilter, type OwnOfferFilterState, type StateId } from '../types.ts';

const description = 'Apply one or more editable left-hand filters on the logged-in own-offers Singles page. Use cardName to find a card.';
const parameters: Fields = {
  cardName: { type: 'string', description: 'Kartenname im eigenen Bestand', min: 0, max: 100 },
  expansion: { type: 'string', description: 'Sichtbare Erweiterungsbezeichnung', min: 1, max: 200 },
  rarity: { type: 'string', description: 'Sichtbare Seltenheitsbezeichnung', min: 1, max: 100 },
  condition: { type: 'string', description: 'Sichtbare Mindestzustandsbezeichnung', min: 1, max: 100 },
  language: { type: 'string', description: 'Sichtbare Sprachbezeichnung', min: 1, max: 100 },
  comments: { type: 'string', description: 'Text in eigenen Angebotskommentaren', min: 0, max: 100 },
  minPrice: { type: 'number', description: 'Mindestpreis in EUR', min: 0, max: 1_000_000 },
  maxPrice: { type: 'number', description: 'Höchstpreis in EUR', min: 0, max: 1_000_000 },
  minQuantity: { type: 'integer', description: 'Mindestverfügbarkeit', min: 0, max: 1_000_000 },
  foil: { type: 'string', description: 'Foil-Filter', enum: ['any', 'yes', 'no'] },
  signed: { type: 'string', description: 'Signiert-Filter', enum: ['any', 'yes', 'no'] },
  altered: { type: 'string', description: 'Altered-Filter', enum: ['any', 'yes', 'no'] },
  sort: { type: 'string', description: 'Sichtbare Sortierbezeichnung', min: 1, max: 100 },
};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object') throw new AutomationError('POSTCONDITION_FAILED');
  if (!['ok', 'not_available', 'wrong_state'].includes(String(object.status)) ||
      !isStateId(object.state))
    throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

function normalized(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function filterMatches(actual: OwnOfferFilterState, requested: OwnOfferFilter): boolean {
  for (const field of ['cardName', 'comments'] as const) {
    if (requested[field] !== undefined && actual[field] !== requested[field]) return false;
  }
  for (const field of ['minPrice', 'maxPrice', 'minQuantity'] as const) {
    if (requested[field] !== undefined) {
      const raw = actual[field].trim();
      const numeric = raw === '' ? 0 : Number(raw.replace(',', '.'));
      if (!Number.isFinite(numeric) || numeric !== requested[field]) return false;
    }
  }
  for (const field of ['expansion', 'rarity', 'condition', 'language', 'sort'] as const) {
    if (requested[field] !== undefined && normalized(actual[field]) !== normalized(String(requested[field]))) return false;
  }
  for (const field of ['foil', 'signed', 'altered'] as const) {
    if (requested[field] === undefined) continue;
    const wanted = normalized(String(requested[field]));
    const selected = normalized(actual[field]);
    if (wanted === 'any' ? !['any', 'all', '--', ''].includes(selected) : selected !== wanted) return false;
  }
  return true;
}

export const action: Action = {
  id: 'nav.own-offers.filter',
  kind: 'read',
  description,
  parameters,
  outputDescription,
  validateOutput,
  run: async (page: Page, input: Input): Promise<NavOutput> => {
    const state: StateId = detectState(page);
    if (state !== 'own-offers') return { status: 'wrong_state', state };
    const offers = new OwnOffersPage(page);
    if (!(await offers.hasFilterForm())) return { status: 'not_available', state };
    const requested = input as OwnOfferFilter;
    const changed = await offers.applyFilters(requested);
    if (changed) await offers.submitFilters();
    const applied = await offers.readCurrentFilter();
    if (!filterMatches(applied, requested)) {
      throw new AutomationError('FILTER_MISMATCH', 'own-offers-filter', {
        expected: requested, actual: applied, operation: 'nav.own-offers.filter',
      });
    }
    const nextState = detectState(page);
    if (nextState !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
    return { status: 'ok', state: nextState };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers.open'],
};
