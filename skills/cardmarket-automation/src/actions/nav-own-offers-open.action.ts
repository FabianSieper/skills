import type { Page } from 'playwright';
import { detectState } from '../lib/state.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { NavOutput, StateId } from '../types.ts';

const description = 'Open a card detail page by clicking its name in the current own-offers Singles listing. Returns status only.';
const parameters: Fields = {
  index: { type: 'integer', description: 'Angebotsposition auf der aktuellen Seite, 0-basiert', required: true, min: 0, max: 100 },
};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object') throw new AutomationError('POSTCONDITION_FAILED');
  if (!['ok', 'not_found', 'wrong_state'].includes(String(object.status)) ||
      !['start', 'results', 'detail', 'versions', 'own-offers'].includes(String(object.state)))
    throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

export const action: Action = {
  id: 'nav.own-offers.open',
  kind: 'read',
  description,
  parameters,
  outputDescription,
  validateOutput,
  run: async (page: Page, input: Input): Promise<NavOutput> => {
    const state: StateId = detectState(page);
    if (state !== 'own-offers') return { status: 'wrong_state', state };
    const offers = new OwnOffersPage(page);
    const index = input.index as number;
    if (index >= await offers.rowCount()) return { status: 'not_found', state };
    await offers.openOffer(index);
    const nextState = detectState(page);
    if (nextState !== 'detail') throw new AutomationError('POSTCONDITION_FAILED');
    return { status: 'ok', state: nextState };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.filter', 'nav.versions', 'user.offers'],
};
