import test from 'node:test';
import assert from 'node:assert/strict';
import { stateFromUrl } from '../src/lib/state.ts';

test('own-offers URL is distinct from a public seller offers URL', () => {
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Stock/Offers/Singles'), 'own-offers');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Stock/Offers/Singles?site=2'), 'own-offers');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Users/example/Offers/Singles'), 'unknown');
});

test('unrecognized URLs never default to the start state', () => {
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Unexpected/Surface'), 'unknown');
  assert.equal(stateFromUrl('https://www.cardmarket.com/not-en/Products/Search'), 'unknown');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Products/Singles/'), 'unknown');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Cards/Forest/Versions/extra'), 'unknown');
  assert.equal(stateFromUrl('https://evil.example/en'), 'unknown');
  assert.equal(stateFromUrl('https://www.cardmarket.com.evil.example/en'), 'unknown');
  assert.equal(stateFromUrl('about:blank'), 'unknown');
});

test('verified entry and query routes are recognized without trusting query text', () => {
  assert.equal(stateFromUrl('https://www.cardmarket.com/en'), 'start');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic'), 'start');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Products/Search?searchString=Forest'), 'results');
  assert.equal(stateFromUrl('https://www.cardmarket.com/en/Magic/Products/Singles/Set/Forest?foo=/Products/Singles/'), 'detail');
});
