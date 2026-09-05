import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '../src/actions/index.ts';
import { AutomationError } from '../src/runtime/errors.ts';
import { validateInput } from '../src/runtime/input.ts';

const plain = (o: Record<string, unknown>) =>
  Object.assign(Object.create(null), o);

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

const info = () => ({
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

test('registry has the three Cardmarket actions, all read-only', () => {
  assert.deepEqual(
    actions.map((a) => a.id).sort(),
    ['cards.artworks', 'cards.price', 'cards.search'],
  );
  for (const a of actions) {
    assert.equal(a.kind, 'read');
    for (const n of a.next)
      assert.ok(actions.some((x) => x.id === n), `next ${n} registered`);
  }
});

test('validateInput happy + sad', () => {
  const search = byId('cards.search');
  assert.deepEqual(validateInput(search.parameters, { query: 'Forest' }), plain({
    query: 'Forest',
    limit: 20,
  }));
  assert.equal(
    code(() => validateInput(search.parameters, {})),
    'INVALID_INPUT',
  );
  assert.equal(
    code(() =>
      validateInput(search.parameters, { query: 'x', limit: 0 }),
    ),
    'INVALID_INPUT',
  );
  assert.equal(
    code(() =>
      validateInput(search.parameters, { query: 'x', unknown: 1 }),
    ),
    'INVALID_INPUT',
  );

  const price = byId('cards.price');
  assert.deepEqual(
    validateInput(price.parameters, { name: 'Forest' }),
    plain({ name: 'Forest', sellers: 50 }),
  );
  assert.equal(
    code(() => validateInput(price.parameters, { name: '' })),
    'INVALID_INPUT',
  );

  const arts = byId('cards.artworks');
  assert.deepEqual(
    validateInput(arts.parameters, { name: 'Forest' }),
    plain({ name: 'Forest', minQty: 0, limit: 40 }),
  );
  assert.equal(
    code(() =>
      validateInput(arts.parameters, { name: 'Forest', minQty: 1001 }),
    ),
    'INVALID_INPUT',
  );
});

test('validateOutput happy + sad', () => {
  const search = byId('cards.search');
  const sOut = { query: 'Forest', count: 2, cards: [card(), card({ name: 'Bose' })] };
  assert.doesNotThrow(() => search.validateOutput(sOut));
  assert.equal(
    code(() =>
      search.validateOutput({ query: 'Forest', count: 3, cards: [card()] }),
    ),
    'POSTCONDITION_FAILED',
  );
  assert.equal(
    code(() =>
      search.validateOutput({ query: 'Forest', count: 1, cards: [card({ fromPrice: 5 })] }),
    ),
    'POSTCONDITION_FAILED',
  );

  const price = byId('cards.price');
  const pOut = {
    found: true,
    card: 'Forest',
    url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest',
    info: info(),
    sellerCount: 1,
    sellers: [seller()],
  };
  assert.doesNotThrow(() => price.validateOutput(pOut));
  assert.equal(
    code(() =>
      price.validateOutput({ ...pOut, sellers: [seller({ price: 5 })] }),
    ),
    'POSTCONDITION_FAILED',
  );
  assert.equal(
    code(() => price.validateOutput({ ...pOut, sellerCount: 0 })),
    'POSTCONDITION_FAILED',
  );

  const arts = byId('cards.artworks');
  const aOut = {
    found: true,
    card: 'Forest',
    versionsUrl: 'https://www.cardmarket.com/en/Magic/Cards/Forest/Versions',
    total: 842,
    shown: 1,
    minQuantity: 0,
    artworks: [artwork()],
  };
  assert.doesNotThrow(() => arts.validateOutput(aOut));
  const aOutMin = {
    ...aOut,
    minQuantity: 5,
    artworks: [artwork({ maxSellerQuantity: 15, sellersAtLeast: 1, qualifies: true })],
  };
  assert.doesNotThrow(() => arts.validateOutput(aOutMin));
  assert.equal(
    code(() =>
      arts.validateOutput({
        ...aOutMin,
        artworks: [artwork({ sellersAtLeast: 1, qualifies: true })],
      }),
    ),
    'POSTCONDITION_FAILED',
  );
});