import type { Page } from 'playwright';
import { CardVersionsPage } from '../pages/CardVersionsPage.ts';
import { detectState } from '../lib/state.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { NavOutput, StateId } from '../types.ts';

const description = 'Open one artwork/version tile from the versions state and move to its detail page. Returns status only.';
const parameters: Fields = {
  index: { type: 'integer', description: 'Artwork position, 0-based', required: true, min: 0, max: 1000 },
};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object') throw new AutomationError('POSTCONDITION_FAILED');
  if (!['ok', 'not_found', 'not_available', 'wrong_state'].includes(String(object.status))) throw new AutomationError('POSTCONDITION_FAILED');
  if (object.state !== 'start' && object.state !== 'results' && object.state !== 'detail' && object.state !== 'versions' && object.state !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

export const action: Action = {
  id: 'nav.artwork',
  description,
  parameters,
  outputDescription,
  validateOutput,
  kind: 'read',
  run: async (page: Page, input: Input): Promise<NavOutput> => {
    const state: StateId = detectState(page);
    if (state !== 'versions') return { status: 'wrong_state', state };
    const versions = new CardVersionsPage(page);
    const index = input.index as number;
    if (index >= await versions.tileCount()) return { status: 'not_found', state };
    await versions.openArtwork(index);
    return { status: 'ok', state: detectState(page) };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.versions', 'nav.filter', 'user.offers'],
};
