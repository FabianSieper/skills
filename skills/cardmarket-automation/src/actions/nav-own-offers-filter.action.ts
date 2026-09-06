import type { Page } from 'playwright';
import { detectState } from '../lib/state.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { NavOutput, OwnOfferFilter, StateId } from '../types.ts';

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
      !['start', 'results', 'detail', 'versions', 'own-offers'].includes(String(object.state)))
    throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
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
    const changed = await offers.applyFilters(input as OwnOfferFilter);
    if (changed) await offers.submitFilters();
    const nextState = detectState(page);
    if (nextState !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
    return { status: 'ok', state: nextState };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers.open'],
};
