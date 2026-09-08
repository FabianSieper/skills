import type { StateId } from '../types.ts';

export type ContractMode = 'observe' | 'read' | 'transition' | 'workflow' | 'write';
export type AuthRequirement = 'public' | 'account';
export type UiEffect = 'none' | 'changed' | 'unknown';
export type CommitEffect = 'none' | 'possible' | 'verified' | 'unknown';

export type ActionContract = Readonly<{
  id: string;
  contractVersion: 1;
  mode: ContractMode;
  from: readonly StateId[];
  /** Outcome name -> states that are legal after that outcome. */
  outcomes: Readonly<Record<string, readonly StateId[]>>;
  auth: AuthRequirement;
  effects: Readonly<{ ui: UiEffect; commit: CommitEffect }>;
  enabled: boolean;
  disabledReason?: string;
  planPure?: boolean;
  description: string;
}>;

const ALL_STATES: readonly StateId[] = ['start', 'results', 'detail', 'versions', 'own-offers', 'unknown'];
const PUBLIC_STATES = ALL_STATES;
const ACCOUNT_STATES: readonly StateId[] = ['own-offers', 'detail'];
const same = (state: StateId): Readonly<Record<string, readonly StateId[]>> => ({
  ok: [state],
  not_found: [state],
  not_available: [state],
});

/**
 * The one state/effect registry used by runtime discovery and dispatch metadata.
 * Action implementations remain separate browser code; this table is deliberately
 * plain JSON-shaped data so it can be validated, generated and reviewed cheaply.
 */
export const ACTION_CONTRACTS: Readonly<Record<string, ActionContract>> = {
  status: { id: 'status', contractVersion: 1, mode: 'observe', from: PUBLIC_STATES,
    outcomes: { ok: ALL_STATES }, auth: 'public', effects: { ui: 'none', commit: 'none' }, enabled: true,
    description: 'Observe the current bound browser state and blockers.' },
  info: { id: 'info', contractVersion: 1, mode: 'workflow', from: PUBLIC_STATES,
    outcomes: { ok: ALL_STATES }, auth: 'public', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Read state-specific Cardmarket data using the legacy bounded workflow.' },
  'nav.home': { id: 'nav.home', contractVersion: 1, mode: 'transition', from: PUBLIC_STATES,
    outcomes: { ok: ['start'] }, auth: 'public', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Navigate the bound tab to the configured Cardmarket home.' },
  'nav.search': { id: 'nav.search', contractVersion: 1, mode: 'transition', from: PUBLIC_STATES,
    outcomes: { ok: ['results'] }, auth: 'public', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Search from the configured Cardmarket game entry.' },
  'nav.open': { id: 'nav.open', contractVersion: 1, mode: 'transition', from: ['results'],
    outcomes: { ok: ['detail'], not_found: ['results'] }, auth: 'public', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Open one verified result on its detail page.' },
  'nav.versions': { id: 'nav.versions', contractVersion: 1, mode: 'transition', from: ['detail'],
    outcomes: { ok: ['versions'], not_available: ['detail'] }, auth: 'public', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Open versions for the current card.' },
  'nav.artwork': { id: 'nav.artwork', contractVersion: 1, mode: 'transition', from: ['versions'],
    outcomes: { ok: ['detail'], not_found: ['versions'] }, auth: 'public', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Open one verified artwork/version detail page.' },
  'nav.filter': { id: 'nav.filter', contractVersion: 1, mode: 'transition', from: ['detail'],
    outcomes: { ok: ['detail'], not_available: ['detail'] }, auth: 'public', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Apply and verify seller filters on the current detail page.' },
  'nav.own-offers': { id: 'nav.own-offers', contractVersion: 1, mode: 'transition', from: PUBLIC_STATES,
    outcomes: { ok: ['own-offers'] }, auth: 'account', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Open the authenticated own-offers listing.' },
  'nav.own-offers.filter': { id: 'nav.own-offers.filter', contractVersion: 1, mode: 'transition', from: ['own-offers'],
    outcomes: { ok: ['own-offers'], not_available: ['own-offers'] }, auth: 'account', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Apply the observed Singles stock filter UI.' },
  'nav.own-offers.open': { id: 'nav.own-offers.open', contractVersion: 1, mode: 'transition', from: ['own-offers'],
    outcomes: { ok: ['detail'], not_found: ['own-offers'] }, auth: 'account', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Open one own-offer card detail page.' },
  'user.offers': { id: 'user.offers', contractVersion: 1, mode: 'read', from: ['detail'],
    outcomes: { ok: ['detail'], not_found: ['detail'] }, auth: 'account', effects: { ui: 'none', commit: 'none' }, enabled: true,
    description: 'Read the account offers on the current detail page.' },
  'stock.market-comparison': { id: 'stock.market-comparison', contractVersion: 1, mode: 'workflow', from: ['own-offers'],
    outcomes: { ok: ['own-offers'] }, auth: 'account', effects: { ui: 'changed', commit: 'none' }, enabled: true,
    description: 'Compare bounded own-stock selections with matching sellers.' },
  'user.offer.update': { id: 'user.offer.update', contractVersion: 1, mode: 'write', from: ['detail'],
    outcomes: { ok: ['detail'] }, auth: 'account', effects: { ui: 'changed', commit: 'possible' }, enabled: false,
    disabledReason: 'Disabled until explicit staging, durable commit journal and per-field live evidence are implemented.', planPure: false,
    description: 'Update one exact account offer through a stored approved plan.' },
  'stock.bulk-price-update': { id: 'stock.bulk-price-update', contractVersion: 1, mode: 'write', from: ['own-offers'],
    outcomes: { ok: ['own-offers'] }, auth: 'account', effects: { ui: 'changed', commit: 'possible' }, enabled: false,
    disabledReason: 'Disabled until item-object targets, durable per-item journal and uncertain-commit reconciliation are implemented.', planPure: false,
    description: 'Update a bounded set of own-offer prices through approval.' },
};

export function actionContract(id: string): ActionContract | undefined {
  return ACTION_CONTRACTS[id];
}

export function validateContractRegistry(actionIds: readonly string[]): void {
  const declared = Object.keys(ACTION_CONTRACTS).sort();
  const actual = [...actionIds].sort();
  if (declared.length !== actual.length || declared.some((id, index) => id !== actual[index]))
    throw new Error(`Contract registry mismatch: expected ${declared.join(',')} got ${actual.join(',')}`);
  for (const contract of Object.values(ACTION_CONTRACTS)) {
    if (contract.from.length === 0 || Object.keys(contract.outcomes).length === 0 || typeof contract.enabled !== 'boolean')
      throw new Error(`Incomplete contract: ${contract.id}`);
    for (const destination of Object.values(contract.outcomes).flat())
      if (!ALL_STATES.includes(destination)) throw new Error(`Unknown destination in ${contract.id}`);
  }
}

export function availableActionIds(state: StateId, accountKey: string, quarantined = false): string[] {
  const account = accountKey !== 'public' && accountKey !== 'unknown';
  return Object.values(ACTION_CONTRACTS)
    .filter(contract => contract.from.includes(state))
    .filter(contract => contract.enabled)
    .filter(contract => contract.auth === 'public' || account)
    .filter(contract => !quarantined || contract.effects.commit === 'none')
    .map(contract => contract.id);
}

export function outcomeFor(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const status = (value as Record<string, unknown>).status;
    if (typeof status === 'string') return status;
    if ((value as Record<string, unknown>).found === false) return 'not_found';
  }
  return 'ok';
}

export function legalDestination(contract: ActionContract, outcome: string, state: StateId): boolean {
  return (contract.outcomes[outcome] ?? []).includes(state);
}

// Keep these exports close to the registry for generated docs and future builders.
export const contractStates = ALL_STATES;
export const accountStates = ACCOUNT_STATES;
export const sameStateOutcomes = same;
