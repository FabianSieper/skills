import type { Page } from 'playwright';
import { detectState } from '../lib/state.ts';
import { readAuth } from '../lib/auth.ts';
import { isAllowedOrigin } from '../pages/SitePage.ts';
import { config } from '../../site.config.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import { isStateId, type AuthInfo, type StatusOutput } from '../types.ts';

const description = 'Purely observe the current Cardmarket state, authentication marker and blockers.';
const parameters: Fields = {};
const outputDescription = '{ state, url, auth, authKnown, blockers }';

function validateOutput(raw: unknown): StatusOutput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new AutomationError('POSTCONDITION_FAILED', 'status-output');
  const object = raw as Record<string, unknown>;
  if (typeof object.url !== 'string' || !isStateId(object.state) ||
      typeof object.authKnown !== 'boolean' || !Array.isArray(object.blockers) ||
      !object.blockers.every((value) => ['outside-site', 'unknown-state', 'login-required'].includes(String(value))) ||
      (object.auth !== null && (!object.auth || typeof object.auth !== 'object' ||
        typeof (object.auth as Record<string, unknown>).loggedIn !== 'boolean')) ||
      (object.authKnown !== (object.auth !== null)) ||
      (object.state !== 'unknown' && object.blockers.includes('unknown-state')) ||
      (object.state === 'unknown' && !object.blockers.includes('unknown-state'))) {
    throw new AutomationError('POSTCONDITION_FAILED', 'status-output');
  }
  return object as unknown as StatusOutput;
}

export const action: Action = {
  id: 'status',
  kind: 'read',
  description,
  parameters,
  outputDescription,
  validateOutput,
  run: async (page: Page, _input: Input): Promise<StatusOutput> => {
    const state = detectState(page);
    const url = page.url();
    const onSite = isAllowedOrigin(url, config.allowedOrigins);
    if (state === 'unknown' || !onSite) {
      const blockers: StatusOutput['blockers'] = [];
      if (!onSite) blockers.push('outside-site');
      if (state === 'unknown') blockers.push('unknown-state');
      return { state, url, auth: null, authKnown: false, blockers };
    }
    let auth: AuthInfo;
    try { auth = await readAuth(page); }
    // A route-shaped URL is not enough to claim a fully observed state when
    // authentication detection failed. Fail closed to `unknown` so the
    // dispatcher cannot expose account actions from incomplete evidence.
    catch { return { state: 'unknown', url, auth: null, authKnown: false, blockers: ['unknown-state'] }; }
    return { state, url, auth, authKnown: true, blockers: auth.loggedIn ? [] : ['login-required'] };
  },
  modulePath: import.meta.url,
  next: ['status', 'info', 'nav.home', 'nav.search', 'nav.open', 'nav.versions', 'nav.artwork', 'nav.filter', 'nav.own-offers', 'nav.own-offers.filter', 'nav.own-offers.open', 'user.offers', 'stock.market-comparison', 'user.offer.update', 'stock.bulk-price-update'],
};
