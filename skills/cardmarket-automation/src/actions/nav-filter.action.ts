import type { Page } from 'playwright';
import { CardDetailPage } from '../pages/CardDetailPage.ts';
import { detectState } from '../lib/state.ts';
import { AutomationError } from '../runtime/errors.ts';
import type { Action } from '../runtime/engine.ts';
import type { Fields, Input } from '../runtime/input.ts';
import { COUNTRY_INPUT_KEYS, CONDITION_VALUES, LANGUAGE_VALUES, resolveSellerFilter, SELLER_TYPE_VALUES, YES_NO_VALUES } from '../pages/seller-filters.ts';
import type { NavOutput, SellerFilter, StateId } from '../types.ts';

const description = 'Apply and submit the seller filter on the detail state. Returns status only.';
const parameters: Fields = {
  condition: { type: 'string', description: 'Mindestzustand', default: 'excellent', enum: Object.keys(CONDITION_VALUES) },
  language: { type: 'string', description: 'Kartensprache', default: 'english', enum: Object.keys(LANGUAGE_VALUES) },
  location: { type: 'string', description: 'Seller-Land, kanonisch oder Alias', default: 'germany', min: 1, max: 50, enum: COUNTRY_INPUT_KEYS },
  sellerType: { type: 'string', description: 'Seller-Typ', default: 'any', enum: Object.keys(SELLER_TYPE_VALUES) },
  foil: { type: 'string', description: 'Foil', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  signed: { type: 'string', description: 'Signiert', default: 'any', enum: Object.keys(YES_NO_VALUES) },
  altered: { type: 'string', description: 'Altered', default: 'any', enum: Object.keys(YES_NO_VALUES) },
};
const outputDescription = '{ status, state }';

function validateOutput(raw: unknown): NavOutput {
  const object = raw as Record<string, unknown>;
  if (!object || typeof object !== 'object') throw new AutomationError('POSTCONDITION_FAILED');
  if (!['ok', 'not_found', 'not_available', 'wrong_state'].includes(String(object.status))) throw new AutomationError('POSTCONDITION_FAILED');
  if (object.state !== 'start' && object.state !== 'results' && object.state !== 'detail' && object.state !== 'versions') throw new AutomationError('POSTCONDITION_FAILED');
  return object as unknown as NavOutput;
}

export const action: Action = {
  id: 'nav.filter',
  description,
  parameters,
  outputDescription,
  validateOutput,
  kind: 'read',
  run: async (page: Page, input: Input): Promise<NavOutput> => {
    const state: StateId = detectState(page);
    if (state !== 'detail') return { status: 'wrong_state', state };
    const detail = new CardDetailPage(page);
    if (!(await detail.hasFilterForm())) return { status: 'not_available', state };
    const changed = await detail.applySellerFilters(resolveSellerFilter({
      condition: input.condition,
      language: input.language,
      location: input.location,
      sellerType: input.sellerType,
      foil: input.foil,
      signed: input.signed,
      altered: input.altered,
    } as unknown as SellerFilter));
    if (changed) {
      await detail.submitSellerFilters();
      await detail.settleSellerList();
    }
    return { status: 'ok', state: detectState(page) };
  },
  modulePath: import.meta.url,
  next: ['info', 'user.offers'],
};
