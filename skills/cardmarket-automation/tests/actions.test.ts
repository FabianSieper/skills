import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '../src/actions/index.ts';
import { AutomationError } from '../src/runtime/errors.ts';
import { validateInput } from '../src/runtime/input.ts';

const plain = (o: Record<string, unknown>) => Object.assign(Object.create(null), o);

function byId(id: string) {
  const a = actions.find((x) => x.id === id);
  assert.ok(a, `action ${id} registered`);
  return a!;
}

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof AutomationError, 'expected AutomationError');
    return e.code;
  }
  return 'OK';
}

const card = (over: Record<string, unknown> = {}) => ({
  name: 'Forest',
  set: 'Magic: The Gathering – Marvel Super Heroes',
  image: 'https://www.cardmarket.com/img/x.jpg',
  fromPrice: 'From 0,02 €',
  url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest',
  ...over,
});

const seller = (over: Record<string, unknown> = {}) => ({
  seller: 'S1',
  location: 'DE',
  condition: 'Near Mint',
  language: 'German',
  price: '1,23 €',
  quantity: '15',
  ...over,
});

const infoFixture = () => ({
  title: 'Forest',
  rarity: 'Common',
  number: '332',
  printedIn: '1',
  reprints: '2',
  availableItems: '100',
  from: '0,02 €',
  priceTrend: 'stable',
  avg30d: '1,00 €',
  avg7d: '1,00 €',
  avg1d: '1,00 €',
  image: 'https://www.cardmarket.com/img/y.jpg',
  url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest',
});

const filterFixture = () => ({
  condition: 'excellent',
  language: 'english',
  location: 'germany',
  sellerType: 'any',
  foil: 'any',
  signed: 'any',
  altered: 'any',
});

const artwork = (over: Record<string, unknown> = {}) => ({
  card: 'Forest',
  set: 'Marvel',
  version: 'Version 1',
  available: '10 Available',
  fromPrice: 'From 1,00 €',
  image: 'https://www.cardmarket.com/img/z.jpg',
  url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest-V1',
  ...over,
});

test('registry has the six state-machine actions, all read-only', () => {
  assert.deepEqual(
    actions.map((a) => a.id).sort(),
    ['info', 'nav.artwork', 'nav.filter', 'nav.open', 'nav.search', 'nav.versions'],
  );
  for (const a of actions) {
    assert.equal(a.kind, 'read');
    for (const n of a.next)
      assert.ok(actions.some((x) => x.id === n), `next ${n} registered`);
  }
});

test('validateInput happy + sad for nav actions', () => {
  const search = byId('nav.search');
  assert.deepEqual(validateInput(search.parameters, { query: 'Forest' }), plain({ query: 'Forest' }));
  assert.equal(code(() => validateInput(search.parameters, {})), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(search.parameters, { query: '' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(search.parameters, { query: 'Forest', unknown: 1 })), 'INVALID_INPUT');

  const open = byId('nav.open');
  assert.deepEqual(validateInput(open.parameters, { index: 0 }), plain({ index: 0 }));
  assert.equal(code(() => validateInput(open.parameters, {})), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(open.parameters, { index: 101 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(open.parameters, { index: -1 })), 'INVALID_INPUT');

  const versions = byId('nav.versions');
  assert.deepEqual(validateInput(versions.parameters, {}), plain({}));
  assert.equal(code(() => validateInput(versions.parameters, { index: 0 })), 'INVALID_INPUT');

  const artworkAction = byId('nav.artwork');
  assert.deepEqual(validateInput(artworkAction.parameters, { index: 0 }), plain({ index: 0 }));
  assert.equal(code(() => validateInput(artworkAction.parameters, {})), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(artworkAction.parameters, { index: 1001 })), 'INVALID_INPUT');

  const filter = byId('nav.filter');
  assert.deepEqual(validateInput(filter.parameters, {}), plain({
    condition: 'excellent',
    language: 'english',
    location: 'germany',
    sellerType: 'any',
    foil: 'any',
    signed: 'any',
    altered: 'any',
  }));
  assert.equal(code(() => validateInput(filter.parameters, { condition: 'unknown' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(filter.parameters, { location: 'unknown' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(filter.parameters, { unknown: 1 })), 'INVALID_INPUT');
});

test('validateInput happy + sad for info', () => {
  const infoAction = byId('info');
  assert.deepEqual(validateInput(infoAction.parameters, {}), plain({ limit: 30, sellers: 50, minQty: 0 }));
  assert.equal(code(() => validateInput(infoAction.parameters, { limit: 151 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(infoAction.parameters, { sellers: 501 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(infoAction.parameters, { minQty: 1001 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(infoAction.parameters, { unknown: 1 })), 'INVALID_INPUT');
});

test('validateOutput happy + sad for nav actions', () => {
  for (const id of ['nav.search', 'nav.open', 'nav.versions', 'nav.artwork', 'nav.filter']) {
    const a = byId(id);
    assert.doesNotThrow(() => a.validateOutput({ status: 'ok', state: 'detail' }));
    assert.equal(code(() => a.validateOutput({ status: 'ok', state: 'somewhere' })), 'POSTCONDITION_FAILED');
    assert.equal(code(() => a.validateOutput({ status: 'boom', state: 'detail' })), 'POSTCONDITION_FAILED');
  }
});

test('validateOutput happy + sad for info', () => {
  const infoAction = byId('info');

  assert.doesNotThrow(() => infoAction.validateOutput({ state: 'start', ready: true }));
  assert.equal(code(() => infoAction.validateOutput({ state: 'start' })), 'POSTCONDITION_FAILED');

  const results = { state: 'results', query: 'Forest', count: 2, cards: [card(), card({ name: 'Bose' })] };
  assert.doesNotThrow(() => infoAction.validateOutput(results));
  assert.equal(code(() => infoAction.validateOutput({ ...results, count: 3 })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => infoAction.validateOutput({ ...results, cards: [card({ fromPrice: 5 })] })), 'POSTCONDITION_FAILED');

  const detail = {
    state: 'detail',
    card: 'Forest',
    url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest',
    filter: filterFixture(),
    info: infoFixture(),
    sellerCount: 1,
    sellers: [seller()],
  };
  assert.doesNotThrow(() => infoAction.validateOutput(detail));
  assert.equal(code(() => infoAction.validateOutput({ ...detail, sellerCount: 0 })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => infoAction.validateOutput({ ...detail, sellers: [seller({ price: 5 })] })), 'POSTCONDITION_FAILED');

  const versions = {
    state: 'versions',
    card: 'Forest',
    versionsUrl: 'https://www.cardmarket.com/en/Magic/Cards/Forest/Versions',
    total: 842,
    shown: 1,
    minQuantity: 0,
    artworks: [artwork()],
  };
  assert.doesNotThrow(() => infoAction.validateOutput(versions));
  assert.equal(code(() => infoAction.validateOutput({ ...versions, shown: 2 })), 'POSTCONDITION_FAILED');

  const versionsMin = {
    ...versions,
    minQuantity: 5,
    artworks: [artwork({ maxSellerQuantity: 15, sellersAtLeast: 1, qualifies: true })],
  };
  assert.doesNotThrow(() => infoAction.validateOutput(versionsMin));
  assert.equal(code(() => infoAction.validateOutput({ ...versionsMin, artworks: [artwork({ sellersAtLeast: 1, qualifies: true })] })), 'POSTCONDITION_FAILED');

  assert.equal(code(() => infoAction.validateOutput({ state: 'nope' })), 'POSTCONDITION_FAILED');
});
