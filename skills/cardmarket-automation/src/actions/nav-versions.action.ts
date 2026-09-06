import type { Page } from 'playwright';
import { CardDetailPage } from '../pages/CardDetailPage.ts';
import { detectState } from '../lib/state.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { NavOutput, StateId } from '../types.ts';

const description = 'Open the card versions page from a detail state. Returns status only.';
const parameters: Fields = {};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object') throw new AutomationError('POSTCONDITION_FAILED');
  if (!['ok', 'not_found', 'not_available', 'wrong_state'].includes(String(object.status))) throw new AutomationError('POSTCONDITION_FAILED');
  if (object.state !== 'start' && object.state !== 'results' && object.state !== 'detail' && object.state !== 'versions' && object.state !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

export const action: Action = {
  id: 'nav.versions',
  description,
  parameters,
  outputDescription,
  validateOutput,
  kind: 'read',
  run: async (page: Page): Promise<NavOutput> => {
    const state: StateId = detectState(page);
    if (state !== 'detail') return { status: 'wrong_state', state };
    const detail = new CardDetailPage(page);
    if (!(await detail.hasVersions())) return { status: 'not_available', state };
    await detail.openVersions();
    return { status: 'ok', state: detectState(page) };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.artwork'],
};
