import type { Page } from 'playwright';
import { readAuth } from '../lib/auth.ts';
import { detectState } from '../lib/state.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { NavOutput } from '../types.ts';

const description = "Open the logged-in user's Selling → My Offers → Singles stock page. Returns status only.";
const parameters: Fields = {};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object' || object.status !== 'ok' || object.state !== 'own-offers')
    throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

export const action: Action = {
  id: 'nav.own-offers',
  kind: 'read',
  description,
  parameters,
  outputDescription,
  validateOutput,
  run: async (page: Page, _input: Input): Promise<NavOutput> => {
    if (!(await readAuth(page)).loggedIn) throw new AutomationError('AUTH_REQUIRED', 'own-offers-login');
    await new OwnOffersPage(page).open();
    const state = detectState(page);
    if (state !== 'own-offers') throw new AutomationError('POSTCONDITION_FAILED');
    return { status: 'ok', state };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.own-offers.filter', 'nav.own-offers.open'],
};
