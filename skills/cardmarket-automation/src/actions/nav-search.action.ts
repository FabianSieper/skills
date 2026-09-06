import type { Page } from 'playwright';
import { SearchPage } from '../pages/SearchPage.ts';
import { detectState } from '../lib/state.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { NavOutput } from '../types.ts';

const description = 'Start a card search and move to the results state. Returns status only.';
const parameters: Fields = {
  query: { type: 'string', description: 'Kartenname oder Suchbegriff', required: true, min: 1, max: 100 },
};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object' || object.status !== 'ok') throw new AutomationError('POSTCONDITION_FAILED');
  if (object.state !== 'start' && object.state !== 'results' && object.state !== 'detail' && object.state !== 'versions' && object.state !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

export const action: Action = {
  id: 'nav.search',
  description,
  parameters,
  outputDescription,
  validateOutput,
  kind: 'read',
  run: async (page: Page, input: Input) => {
    await new SearchPage(page).search(input.query as string);
    return { status: 'ok', state: detectState(page) };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.open'],
};
