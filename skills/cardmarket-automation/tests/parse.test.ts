import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQty, parsePrice } from '../src/lib/parse.ts';

test('parseQty', () => {
  assert.equal(parseQty('15'), 15);
  assert.equal(parseQty('1 500'), 1500);
  assert.equal(parseQty('1,500'), 1500);
  assert.equal(parseQty('1.234'), 1234);
  assert.equal(parseQty(''), 0);
  assert.equal(parseQty(null), 0);
  assert.equal(parseQty('abc'), 0);
  assert.equal(parseQty(undefined), 0);
});

test('parsePrice', () => {
  assert.equal(parsePrice('0,02 €'), 0.02);
  assert.equal(parsePrice('1 234,56 €'), 1234.56);
  assert.equal(parsePrice('12 €'), 12);
  assert.equal(parsePrice('12.34 €'), 12.34);
  assert.equal(parsePrice('abc'), null);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice(null), null);
  assert.equal(parsePrice(undefined), null);
});