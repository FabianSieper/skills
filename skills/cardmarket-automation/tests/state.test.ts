import test from 'node:test';
import assert from 'node:assert/strict';
import { stateFromUrl } from '../src/lib/state.ts';

test('own-offers URL is distinct from a public seller offers URL', () => {
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Stock/Offers/Singles'), 'own-offers');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Stock/Offers/Singles?site=2'), 'own-offers');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Users/example/Offers/Singles'), 'start');
});
