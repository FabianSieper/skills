import test from 'node:test';
import assert from 'node:assert/strict';
import { actions } from '../src/actions/index.ts';
import { ACTION_CONTRACTS, availableActionIds, legalDestination, outcomeFor, validateContractRegistry } from '../src/runtime/contracts.ts';

test('every registered Cardmarket action has one complete contract', () => {
  assert.doesNotThrow(() => validateContractRegistry(actions.map(action => action.id)));
  assert.deepEqual(Object.keys(ACTION_CONTRACTS).sort(), actions.map(action => action.id).sort());
  for (const contract of Object.values(ACTION_CONTRACTS)) {
    assert.ok(contract.from.length > 0);
    assert.ok(Object.keys(contract.outcomes).length > 0);
    for (const destinations of Object.values(contract.outcomes)) assert.ok(destinations.length > 0);
  }
});

test('available actions are generated from state and account facts', () => {
  assert.ok(availableActionIds('results', 'public').includes('nav.open'));
  assert.ok(!availableActionIds('results', 'public').includes('user.offer.update'));
  assert.ok(!availableActionIds('detail', 'user:Hayrus').includes('user.offer.update'));
  assert.ok(!availableActionIds('unknown', 'public').includes('nav.open'));
  assert.ok(!availableActionIds('own-offers', 'user:Hayrus', true).includes('stock.bulk-price-update'));
});

test('outcome and destination checks reject wrong-state success claims', () => {
  const contract = ACTION_CONTRACTS['nav.open']!;
  assert.equal(outcomeFor({ status: 'not_found' }), 'not_found');
  assert.equal(legalDestination(contract, 'not_found', 'results'), true);
  assert.equal(legalDestination(contract, 'ok', 'results'), false);
  assert.equal(legalDestination(contract, 'ok', 'detail'), true);
});
