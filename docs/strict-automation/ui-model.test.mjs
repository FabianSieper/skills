import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUi, discover, closeEditor, openVersions, guardedClose } from './ui-model.ts';

const evidence = {
  observationId: 'observation-1', contextRevision: 'revision-1',
  observedAt: '2026-09-08T12:00:00Z',
};
const account = { kind: 'account', accountRef: 'account-1' };
const product = { cardId: 'c1', productId: 'p1', printingId: 'print1', artworkId: 'art1' };
const detail = { node: 'detail', data: { product, versionsAvailable: true } };
const editor = { node: 'detail.offer-edit', data: { product, articleId: 'a1', priceMinor: 150, dirty: false } };
const ready = (node, auth = account) => resolveUi(evidence, auth, [node], null);

test('unknown and overlapping recognition never become home or ready', () => {
  assert.equal(resolveUi(evidence, account, [], null).reason, 'unrecognized');
  const ambiguous = resolveUi(evidence, account, [detail, editor], null);
  assert.equal(ambiguous.reason, 'ambiguous');
  assert.deepEqual(discover(ambiguous), []);
});

test('blocking overlay suppresses underlying page actions', () => {
  const blocked = resolveUi(evidence, account, [detail], 'consent');
  assert.equal(blocked.underlying.node, 'detail');
  assert.deepEqual(discover(blocked), []);
});

test('discovery and dispatch use identical state, auth and dirty-form predicates', () => {
  assert.deepEqual(discover(ready(detail)), ['nav.versions']);
  assert.deepEqual(discover(ready(editor)), ['offer.edit.close']);
  const dirty = ready({ ...editor, data: { ...editor.data, dirty: true } });
  assert.deepEqual(discover(dirty), []);
  assert.equal(closeEditor.availability(dirty).actual, 'dirty-form');
  assert.equal(closeEditor.availability(ready(editor, { kind: 'unknown', reason: 'missing-marker' })).code, 'AUTH_REQUIRED');
  assert.equal(closeEditor.availability(ready(detail)).code, 'WRONG_STATE');
});

test('public availability does not depend on account identity', () => {
  assert.deepEqual(discover(ready(detail, { kind: 'guest' })), ['nav.versions']);
  assert.deepEqual(discover(ready({ ...detail, data: { ...detail.data, versionsAvailable: false } })), []);
});

test('versions destination must belong to the selected card', () => {
  const before = ready(detail);
  const versions = cardId => ready({ node: 'versions', data: {
    cardId, cardName: 'Example', artworks: { revision: 'v1', items: [], nextCursor: null },
  } });
  assert.equal(openVersions.acceptsDestination(before, 'opened', versions('c1')), true);
  assert.equal(openVersions.acceptsDestination(before, 'opened', versions('other')), false);
  assert.equal(openVersions.acceptsDestination(before, 'opened', before), false);
});

test('wrong source state prevents the injected interaction entirely', async () => {
  let calls = 0;
  await assert.rejects(guardedClose(async () => ready(detail), async () => { calls++; }), /WRONG_STATE/);
  assert.equal(calls, 0);
});

test('successful interaction is rejected when freshly observed identity changed', async () => {
  let observations = 0;
  let interactions = 0;
  const changed = { ...detail, data: { ...detail.data, product: { ...product, artworkId: 'other' } } };
  await assert.rejects(guardedClose(
    async () => ready(observations++ === 0 ? editor : changed),
    async () => { interactions++; },
  ), /POSTCONDITION_FAILED/);
  assert.equal(interactions, 1);
  assert.equal(observations, 2);
});

test('legal close returns freshly observed detail state', async () => {
  let observations = 0;
  const result = await guardedClose(async () => ready(observations++ === 0 ? editor : detail), async () => {});
  assert.equal(result.node, 'detail');
  assert.deepEqual(discover(result), ['nav.versions']);
});
