/**
 * Executable DESIGN EXAMPLE, not the Cardmarket runtime.
 * No browser/IO, no third-party dependencies. Demonstrates the proposed types,
 * state recognition, availability and postcondition boundary only.
 * Production needs schema-validated observations, evidence freshness, scoped
 * capability facades, locking and all other gates in concept.md.
 */

export type Product = Readonly<{
  cardId: string;
  productId: string;
  printingId: string;
  artworkId: string;
}>;

export type Target = Readonly<{
  targetRef: string; // Issued by runtime, never a selector or URL.
  product: Product;
}>;

type Collection = Readonly<{
  revision: string;
  items: readonly Target[];
  nextCursor: string | null;
}>;

// Only add a node when the legal operation set changes. Filter values, card IDs
// and pagination are data, not separate nodes. Modal belongs to detail's POM.
export interface NodeData {
  home: { searchAvailable: boolean };
  results: { query: string; cards: Collection };
  detail: { product: Product; versionsAvailable: boolean };
  'detail.offer-edit': {
    product: Product;
    articleId: string;
    priceMinor: number;
    dirty: boolean;
  };
  versions: { cardId: string; cardName: string; artworks: Collection };
  'own-offers': { filterRevision: string; offers: Collection };
}

export type NodeId = keyof NodeData;
export type PageId = 'home' | 'results' | 'detail' | 'versions' | 'own-offers';

// Human-readable ownership map. The build requires an entry for every node.
export const nodes = {
  home: { page: 'home', component: null },
  results: { page: 'results', component: null },
  detail: { page: 'detail', component: null },
  'detail.offer-edit': { page: 'detail', component: 'offer-edit' },
  versions: { page: 'versions', component: null },
  'own-offers': { page: 'own-offers', component: null },
} as const satisfies Record<NodeId, { page: PageId; component: string | null }>;

export type Auth =
  | { kind: 'guest' }
  | { kind: 'account'; accountRef: string }
  | { kind: 'unknown'; reason: string };

// A mapped discriminated union keeps node and data correlated when narrowing.
export type Node<K extends NodeId = NodeId> = {
  [P in K]: Readonly<{ node: P; data: Readonly<NodeData[P]> }>;
}[K];

type Evidence = Readonly<{
  observationId: string;
  contextRevision: string;
  observedAt: string;
}>;

export type Ready<K extends NodeId = NodeId> = Node<K> & Evidence & {
  readonly kind: 'ready';
  readonly auth: Auth;
};

export type Ui =
  | Ready
  | (Evidence & {
      kind: 'blocked';
      reason: 'consent' | 'challenge' | 'native-dialog' | 'loading' | 'unknown-overlay';
      // Context only; cannot be passed to a ready-state handler.
      underlying: Node | null;
    })
  | (Evidence & {
      kind: 'unsupported';
      reason: 'outside-site' | 'unrecognized' | 'ambiguous';
      candidates: readonly NodeId[];
    })
  | { kind: 'unavailable'; reason: 'browser-missing' | 'session-mismatch' | 'transport' };

// POM recognizers emit candidates only after URL + unique positive DOM evidence.
// A general detail recognizer must exclude the edit modal so they cannot overlap.
export function resolveUi(
  evidence: Evidence,
  auth: Auth,
  candidates: readonly Node[],
  blocker: Extract<Ui, { kind: 'blocked' }>['reason'] | null,
): Ui {
  if (blocker !== null) {
    return { ...evidence, kind: 'blocked', reason: blocker,
      underlying: candidates.length === 1 ? candidates[0]! : null };
  }
  if (candidates.length !== 1) {
    return { ...evidence, kind: 'unsupported',
      reason: candidates.length === 0 ? 'unrecognized' : 'ambiguous',
      candidates: candidates.map(candidate => candidate.node) };
  }
  return { ...candidates[0]!, ...evidence, kind: 'ready', auth };
}

export type Rejection = Readonly<{
  allowed: false;
  code: 'WRONG_STATE' | 'AUTH_REQUIRED' | 'NOT_AVAILABLE' | 'STATE_BLOCKED';
  expected: readonly string[];
  actual: string;
}>;

type Sources = readonly [NodeId, ...NodeId[]];
type Destinations = Readonly<Record<string, NodeId>>;

// A transition lists destination by outcome. Both graph and docs come from this
// declaration, rather than duplicating a next list in actions and markdown.
export function defineTransition<const F extends Sources, const D extends Destinations>(spec: {
  id: string;
  from: F;
  outcomes: D;
  auth: 'public' | 'account';
  can: (ui: Ready<F[number]>) => true | Rejection;
  matchesTarget: (before: Ready<F[number]>, after: Ready<D[keyof D]>) => boolean;
}) {
  type Decision = Rejection | { allowed: true; state: Ready<F[number]> };
  function availability(ui: Ui): Decision {
    if (ui.kind !== 'ready') {
      return { allowed: false, code: 'STATE_BLOCKED', expected: ['ready'], actual: ui.kind };
    }
    if (!(spec.from as readonly NodeId[]).includes(ui.node)) {
      return { allowed: false, code: 'WRONG_STATE', expected: spec.from, actual: ui.node };
    }
    if (spec.auth === 'account' && ui.auth.kind !== 'account') {
      return { allowed: false, code: 'AUTH_REQUIRED', expected: ['account'], actual: ui.auth.kind };
    }
    // Central checked narrowing. No casts required in site declarations.
    const state = ui as Ready<F[number]>;
    const condition = spec.can(state);
    return condition === true ? { allowed: true, state } : condition;
  }
  function acceptsDestination(
    before: Ready<F[number]>,
    outcome: keyof D,
    after: Ui,
  ): boolean {
    // 'after' comes from fresh observation, never handler-returned state.
    if (after.kind !== 'ready' || after.node !== spec.outcomes[outcome]) return false;
    return spec.matchesTarget(before, after as Ready<D[keyof D]>);
  }
  return { ...spec, kind: 'transition' as const, availability, acceptsDestination };
}

export const openVersions = defineTransition({
  id: 'nav.versions',
  from: ['detail'],
  outcomes: { opened: 'versions' },
  auth: 'public',
  can: ui => ui.data.versionsAvailable ? true : {
    allowed: false, code: 'NOT_AVAILABLE', expected: ['versions-link'], actual: 'absent',
  },
  matchesTarget: (before, after) => before.data.product.cardId === after.data.cardId,
});

export const closeEditor = defineTransition({
  id: 'offer.edit.close',
  from: ['detail.offer-edit'],
  outcomes: { closed: 'detail' },
  auth: 'account',
  can: ui => ui.data.dirty ? {
    allowed: false, code: 'NOT_AVAILABLE', expected: ['clean-form'], actual: 'dirty-form',
  } : true,
  matchesTarget: (before, after) =>
    before.data.product.productId === after.data.product.productId &&
    before.data.product.printingId === after.data.product.printingId &&
    before.data.product.artworkId === after.data.product.artworkId,
});

export const transitions = [openVersions, closeEditor] as const;

// This is exactly the predicate execution also uses, not a second help system.
export function discover(ui: Ui): string[] {
  return transitions.filter(action => action.availability(ui).allowed).map(action => action.id);
}

// Pure guard check around an injected operation. The real engine additionally
// provides input/target/freshness checks, deadlines, effects, locks and envelopes.
export async function guardedClose(
  observe: () => Promise<Ui>,
  closeCleanEditor: () => Promise<void>,
): Promise<Ui> {
  const before = closeEditor.availability(await observe());
  if (!before.allowed) throw new Error(before.code);
  await closeCleanEditor();
  const after = await observe();
  if (!closeEditor.acceptsDestination(before.state, 'closed', after)) {
    throw new Error('POSTCONDITION_FAILED');
  }
  return after;
}
