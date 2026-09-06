import type { Page } from 'playwright';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import type { NavOutput } from '../types.ts';
import { config } from '../../site.config.ts';
import { SitePage } from '../pages/SitePage.ts';
import { detectState } from '../lib/state.ts';

const description = 'Go to the Cardmarket home page, the safe start page for login and new searches. Returns status only.';
const parameters: Fields = {};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object' || object.status !== 'ok' || object.state !== 'start') throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

export const action: Action = {
  id: 'nav.home',
  kind: 'read',
  description,
  parameters,
  outputDescription,
  validateOutput,
  run: async (page: Page, _input: Input) => {
    await new SitePage(page).gotoAllowed(config.baseURL + config.homeEntry);
    const state = detectState(page);
    if (state !== 'start') throw new AutomationError('POSTCONDITION_FAILED');
    return { status: 'ok', state };
  },
  modulePath: import.meta.url,
  next: ['info', 'nav.search'],
};
