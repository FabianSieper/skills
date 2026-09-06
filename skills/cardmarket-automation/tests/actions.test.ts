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

const auth = (over: Record<string, unknown> = {}) => ({ loggedIn: false, ...over });

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

test('registry has the state-machine and user-offer actions', () => {
  assert.deepEqual(
    actions.map((a) => a.id).sort(),
    ['info', 'nav.artwork', 'nav.filter', 'nav.home', 'nav.open', 'nav.own-offers', 'nav.own-offers.filter', 'nav.own-offers.open', 'nav.search', 'nav.versions', 'stock.bulk-price-update', 'stock.market-comparison', 'user.offer.update', 'user.offers'],
  );
  for (const a of actions) {
    if (a.kind === 'write') assert.ok('prepare' in a && 'execute' in a);
    for (const n of a.next)
      assert.ok(actions.some((x) => x.id === n), `next ${n} registered`);
  }
});

test('validateInput happy + sad for nav actions', () => {
  const home = byId('nav.home');
  assert.deepEqual(validateInput(home.parameters, {}), plain({}));
  assert.equal(code(() => validateInput(home.parameters, { index: 0 })), 'INVALID_INPUT');

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

  const ownOffers = byId('nav.own-offers');
  assert.deepEqual(validateInput(ownOffers.parameters, {}), plain({}));
  assert.equal(code(() => validateInput(ownOffers.parameters, { cardName: 'Forest' })), 'INVALID_INPUT');

  const ownOffersFilter = byId('nav.own-offers.filter');
  assert.deepEqual(validateInput(ownOffersFilter.parameters, { cardName: 'Forest', minPrice: 1, foil: 'yes' }), plain({ cardName: 'Forest', minPrice: 1, foil: 'yes' }));
  assert.deepEqual(validateInput(ownOffersFilter.parameters, { cardName: '' }), plain({ cardName: '' }));
  assert.equal(code(() => validateInput(ownOffersFilter.parameters, { foil: 'maybe' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(ownOffersFilter.parameters, { minQuantity: -1 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(ownOffersFilter.parameters, { unknown: 1 })), 'INVALID_INPUT');

  const ownOffersOpen = byId('nav.own-offers.open');
  assert.deepEqual(validateInput(ownOffersOpen.parameters, { index: 0 }), plain({ index: 0 }));
  assert.equal(code(() => validateInput(ownOffersOpen.parameters, {})), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(ownOffersOpen.parameters, { index: 101 })), 'INVALID_INPUT');
});

test('validateInput happy + sad for info', () => {
  const infoAction = byId('info');
  assert.deepEqual(validateInput(infoAction.parameters, {}), plain({
    limit: 30,
    sellers: 50,
    minQty: 0,
    all: false,
    condition: 'excellent',
    language: 'english',
    location: 'germany',
    sellerType: 'any',
    foil: 'any',
    signed: 'any',
    altered: 'any',
  }));
  assert.equal(code(() => validateInput(infoAction.parameters, { limit: 151 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(infoAction.parameters, { sellers: 501 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(infoAction.parameters, { minQty: 1001 })), 'INVALID_INPUT');
  assert.deepEqual(validateInput(infoAction.parameters, { all: true, language: 'german' }), plain({
    limit: 30, sellers: 50, minQty: 0, all: true, condition: 'excellent', language: 'german',
    location: 'germany', sellerType: 'any', foil: 'any', signed: 'any', altered: 'any',
  }));
  assert.equal(code(() => validateInput(infoAction.parameters, { all: 'yes' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(infoAction.parameters, { language: 'klingon' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(infoAction.parameters, { unknown: 1 })), 'INVALID_INPUT');
});

test('validateOutput happy + sad for nav actions', () => {
  const home = byId('nav.home');
  assert.doesNotThrow(() => home.validateOutput({ status: 'ok', state: 'start' }));
  assert.equal(code(() => home.validateOutput({ status: 'ok', state: 'detail' })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => home.validateOutput({ status: 'boom', state: 'start' })), 'POSTCONDITION_FAILED');

  for (const id of ['nav.search', 'nav.open', 'nav.versions', 'nav.artwork', 'nav.filter']) {
    const a = byId(id);
    assert.doesNotThrow(() => a.validateOutput({ status: 'ok', state: 'detail' }));
    assert.equal(code(() => a.validateOutput({ status: 'ok', state: 'somewhere' })), 'POSTCONDITION_FAILED');
    assert.equal(code(() => a.validateOutput({ status: 'boom', state: 'detail' })), 'POSTCONDITION_FAILED');
  }

  const ownOffers = byId('nav.own-offers');
  assert.doesNotThrow(() => ownOffers.validateOutput({ status: 'ok', state: 'own-offers' }));
  assert.equal(code(() => ownOffers.validateOutput({ status: 'ok', state: 'detail' })), 'POSTCONDITION_FAILED');
  for (const id of ['nav.own-offers.filter', 'nav.own-offers.open']) {
    const action = byId(id);
    assert.doesNotThrow(() => action.validateOutput({ status: 'wrong_state', state: 'versions' }));
    assert.equal(code(() => action.validateOutput({ status: 'boom', state: 'own-offers' })), 'POSTCONDITION_FAILED');
  }
});

test('validateOutput happy + sad for info', () => {
  const infoAction = byId('info');

  const start = { state: 'start', ready: true, auth: auth() };
  assert.doesNotThrow(() => infoAction.validateOutput(start));
  assert.equal(code(() => infoAction.validateOutput({ state: 'start' })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => infoAction.validateOutput({ state: 'start', ready: true })), 'POSTCONDITION_FAILED');

  const results = { state: 'results', query: 'Forest', count: 2, cards: [card(), card({ name: 'Bose' })], auth: auth() };
  assert.doesNotThrow(() => infoAction.validateOutput(results));
  assert.equal(code(() => infoAction.validateOutput({ ...results, count: 3 })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => infoAction.validateOutput({ ...results, cards: [card({ fromPrice: 5 })] })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => infoAction.validateOutput({ state: 'results', query: 'Forest', count: 0, cards: [] })), 'POSTCONDITION_FAILED');

  const detail = {
    state: 'detail',
    card: 'Forest',
    url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest',
    filter: filterFixture(),
    info: infoFixture(),
    sellerCount: 1,
    sellers: [seller()],
    auth: auth(),
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
    auth: auth(),
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

  const ownOffers = {
    state: 'own-offers',
    url: 'https://www.cardmarket.com/en/Magic/Stock/Offers/Singles',
    filter: {
      cardName: 'Forest', expansion: 'All', rarity: 'All', condition: 'Excellent', language: 'English',
      comments: '', minPrice: '', maxPrice: '', minQuantity: '', foil: 'Any', signed: 'Any', altered: 'Any', sort: 'Name',
    },
    count: 1,
    offers: [{ articleId: 1, card: 'Forest', cardUrl: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest', condition: 'Excellent', language: 'English', price: '1,23 €', quantity: 1 }],
    pagesVisited: 2,
    complete: true,
    auth: auth({ loggedIn: true }),
  };
  assert.doesNotThrow(() => infoAction.validateOutput(ownOffers));
  assert.equal(code(() => infoAction.validateOutput({ ...ownOffers, count: 2 })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => infoAction.validateOutput({ ...ownOffers, filter: { ...ownOffers.filter, cardName: 1 } })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => infoAction.validateOutput({ ...ownOffers, pagesVisited: 0 })), 'POSTCONDITION_FAILED');

  assert.equal(code(() => infoAction.validateOutput({ state: 'nope' })), 'POSTCONDITION_FAILED');
});

const userOffer = (over: Record<string, unknown> = {}) => ({
  articleId: 1,
  seller: 'S1',
  card: 'Forest',
  set: 'Marvel',
  condition: 'Near Mint',
  language: 'German',
  price: '1,23 €',
  quantity: 15,
  ...over,
});

test('validateInput happy + sad for user.offers', () => {
  const a = byId('user.offers');
  assert.deepEqual(validateInput(a.parameters, {}), plain({ limit: 20 }));
  assert.deepEqual(validateInput(a.parameters, { limit: 0 }), plain({ limit: 0 }));
  assert.equal(code(() => validateInput(a.parameters, { limit: 101 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { unknown: 1 })), 'INVALID_INPUT');
});

test('validateInput happy + sad for user.offer.update', () => {
  const a = byId('user.offer.update');
  assert.deepEqual(validateInput(a.parameters, { articleId: 1, price: 1.23 }), plain({ articleId: 1, price: 1.23 }));
  assert.deepEqual(validateInput(a.parameters, { articleId: 1 }), plain({ articleId: 1 }));
  assert.equal(code(() => validateInput(a.parameters, {})), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleId: 0, price: 1 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleId: 1, price: 0 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleId: 1, condition: 'unknown' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleId: 1, language: 'any' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleId: 1, unknown: 1 })), 'INVALID_INPUT');
});

test('validateOutput happy + sad for user.offers', () => {
  const a = byId('user.offers');
  const found = { state: 'detail', card: 'Forest', set: 'Marvel', url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest', found: true, count: 1, offers: [userOffer()], auth: auth() };
  assert.doesNotThrow(() => a.validateOutput(found));
  assert.doesNotThrow(() => a.validateOutput({ ...found, found: false, count: 0, offers: [] }));
  assert.equal(code(() => a.validateOutput({ ...found, count: 0 })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...found, offers: [userOffer({ price: 5 })] })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ state: 'nope', card: '', set: '', url: '', found: false, count: 0, offers: [], auth: auth() })), 'POSTCONDITION_FAILED');
});

test('validateOutput happy + sad for user.offer.update', () => {
  const a = byId('user.offer.update');
  const ok = { state: 'detail', articleId: 1, card: 'Forest', set: 'Marvel', url: 'https://www.cardmarket.com/en/Magic/Products/Singles/Marvel/Forest', offer: userOffer(), changes: { price: 1.23 }, verified: true, auth: auth() };
  assert.doesNotThrow(() => a.validateOutput(ok));
  assert.equal(code(() => a.validateOutput({ ...ok, state: 'versions' })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, changes: {} })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, changes: { unknown: 1 } })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, verified: 'yes' })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, offer: userOffer({ quantity: '15' }) })), 'POSTCONDITION_FAILED');
});

test('validateInput happy + sad for stock.market-comparison', () => {
  const a = byId('stock.market-comparison');
  assert.deepEqual(validateInput(a.parameters, {}), plain({
    limit: 0,
    location: 'germany',
    sellerType: 'any',
    foil: 'any',
    signed: 'any',
    altered: 'any',
  }));
  assert.equal(code(() => validateInput(a.parameters, { limit: 1001 })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { location: 'klingon' })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { unknown: 1 })), 'INVALID_INPUT');
});

test('validateOutput happy + sad for stock.market-comparison', () => {
  const a = byId('stock.market-comparison');
  const ok = {
    state: 'own-offers',
    count: 1,
    offers: [{ articleId: 1, card: 'Forest', price: '1,23 €', marketFrom: '0,50 €', marketSellers: 3, belowMarket: false }],
    auth: auth({ loggedIn: true }),
  };
  assert.doesNotThrow(() => a.validateOutput(ok));
  assert.equal(code(() => a.validateOutput({ ...ok, state: 'detail' })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, count: 2 })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, offers: [{ articleId: 1, card: 'Forest', price: 5, marketFrom: '0,50 €', marketSellers: 3, belowMarket: false }] })), 'POSTCONDITION_FAILED');
});

test('validateInput happy + sad for stock.bulk-price-update', () => {
  const a = byId('stock.bulk-price-update');
  assert.deepEqual(validateInput(a.parameters, { articleIds: ['1', '2'], prices: ['1.23', '2.50'] }),
    plain({ articleIds: ['1', '2'], prices: ['1.23', '2.50'] }));
  assert.equal(code(() => validateInput(a.parameters, {})), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleIds: ['1'] })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleIds: [], prices: [] })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleIds: '1', prices: ['1.23'] })), 'INVALID_INPUT');
  assert.equal(code(() => validateInput(a.parameters, { articleIds: ['1', '2'], prices: ['1.23', '2.50'], unknown: 1 })), 'INVALID_INPUT');
});

test('validateOutput happy + sad for stock.bulk-price-update', () => {
  const a = byId('stock.bulk-price-update');
  const ok = {
    state: 'own-offers',
    count: 2,
    updated: [
      { articleId: 1, card: 'Forest', oldPrice: '1,00 €', newPrice: 1.23, verified: true },
      { articleId: 2, card: 'Bose', oldPrice: '2,00 €', newPrice: 2.50, verified: true },
    ],
    auth: auth({ loggedIn: true }),
  };
  assert.doesNotThrow(() => a.validateOutput(ok));
  assert.equal(code(() => a.validateOutput({ ...ok, state: 'detail' })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, count: 1 })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, updated: [{ articleId: 1, card: 'Forest', oldPrice: '1,00 €', newPrice: '1.23', verified: true }, { articleId: 2, card: 'Bose', oldPrice: '2,00 €', newPrice: 2.50, verified: true }] })), 'POSTCONDITION_FAILED');
  assert.equal(code(() => a.validateOutput({ ...ok, updated: [{ articleId: 1, card: 'Forest', oldPrice: '1,00 €', newPrice: 1.23, verified: 'yes' }, { articleId: 2, card: 'Bose', oldPrice: '2,00 €', newPrice: 2.50, verified: true }] })), 'POSTCONDITION_FAILED');
});
