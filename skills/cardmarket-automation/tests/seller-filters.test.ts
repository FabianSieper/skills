import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFilterTargets,
  COUNTRY_INPUT_KEYS,
  isResolvedSellerFilter,
  normalizeCountryKey,
  resolveCountry,
  resolveSellerFilter,
  SELLER_FILTER_DEFAULTS,
} from '../src/pages/seller-filters.ts';
import { AutomationError } from '../src/runtime/errors.ts';
import type { SellerFilter } from '../src/types.ts';

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof AutomationError, 'expected AutomationError');
    return e.code;
  }
  return 'OK';
}

test('default seller filter is excellent / english / germany / any extras', () => {
  assert.deepEqual(resolveSellerFilter(), {
    condition: 'excellent',
    language: 'english',
    location: 'germany',
    sellerType: 'any',
    foil: 'any',
    signed: 'any',
    altered: 'any',
  });
  assert.deepEqual(SELLER_FILTER_DEFAULTS, {
    condition: 'excellent',
    language: 'english',
    location: 'germany',
    sellerType: 'any',
    foil: 'any',
    signed: 'any',
    altered: 'any',
  });
});

test('country normalization accepts canonical keys and aliases', () => {
  assert.equal(normalizeCountryKey('Germany'), 'germany');
  assert.equal(normalizeCountryKey('DE'), 'germany');
  assert.equal(normalizeCountryKey('Deutschland'), 'germany');
  assert.equal(normalizeCountryKey('Czech Republic'), 'czech-republic');
  assert.equal(normalizeCountryKey('Czechia'), 'czech-republic');
  assert.equal(normalizeCountryKey('Österreich'), 'austria');
  assert.equal(normalizeCountryKey('United Kingdom'), 'united-kingdom');
  assert.equal(normalizeCountryKey('UK'), 'united-kingdom');
  assert.equal(normalizeCountryKey('all'), 'any');
  assert.equal(normalizeCountryKey('nowhere'), null);
  assert.equal(COUNTRY_INPUT_KEYS.includes('germany'), true);
  assert.equal(COUNTRY_INPUT_KEYS.includes('de'), true);
});

test('resolveCountry throws for unknown locations', () => {
  assert.equal(code(() => resolveCountry('nowhere')), 'INVALID_INPUT');
  assert.equal(resolveCountry('de'), 'germany');
});

test('filter resolution accepts overrides and validates enums', () => {
  const f = resolveSellerFilter({
    condition: 'mint',
    language: 'german',
    location: 'uk',
    sellerType: 'professional',
    foil: 'yes',
    signed: 'no',
    altered: 'any',
  });
  assert.deepEqual(f, {
    condition: 'mint',
    language: 'german',
    location: 'united-kingdom',
    sellerType: 'professional',
    foil: 'yes',
    signed: 'no',
    altered: 'any',
  });
  assert.equal(code(() => resolveSellerFilter({ condition: 'bogus' } as unknown as SellerFilter)), 'INVALID_INPUT');
  assert.equal(code(() => resolveSellerFilter({ language: 'bogus' } as unknown as SellerFilter)), 'INVALID_INPUT');
  assert.equal(code(() => resolveSellerFilter({ location: 'nowhere' })), 'INVALID_INPUT');
  assert.equal(code(() => resolveSellerFilter({ sellerType: 'bogus' } as unknown as SellerFilter)), 'INVALID_INPUT');
  assert.equal(code(() => resolveSellerFilter({ foil: 'bogus' } as unknown as SellerFilter)), 'INVALID_INPUT');
});

test('filter targets map to the detail-page form values', () => {
  assert.deepEqual(buildFilterTargets(resolveSellerFilter()), {
    minCondition: '3',
    language: '1',
    sellerCountry: '7',
    sellerType: '',
    isFoil: '0',
    isSigned: '0',
    isAltered: '0',
  });
  assert.deepEqual(
    buildFilterTargets(
      resolveSellerFilter({
        condition: 'mint',
        language: 'german',
        location: 'any',
        sellerType: 'professional',
        foil: 'yes',
        signed: 'no',
        altered: 'no',
      }),
    ),
    {
      minCondition: '1',
      language: '3',
      sellerCountry: '',
      sellerType: '1',
      isFoil: 'Y',
      isSigned: 'N',
      isAltered: 'N',
    },
  );
});

test('resolved filter output guard accepts exact shape only', () => {
  assert.equal(
    isResolvedSellerFilter({
      condition: 'excellent',
      language: 'english',
      location: 'germany',
      sellerType: 'any',
      foil: 'any',
      signed: 'any',
      altered: 'any',
    }),
    true,
  );
  assert.equal(
    isResolvedSellerFilter({
      condition: 'excellent',
      language: 'english',
      location: 'germany',
      sellerType: 'any',
      foil: 'any',
      signed: 'any',
    }),
    false,
  );
  assert.equal(
    isResolvedSellerFilter({
      condition: 'excellent',
      language: 'english',
      location: 'germany',
      sellerType: 'any',
      foil: 'any',
      signed: 'any',
      altered: 'any',
      extra: 'x',
    }),
    false,
  );
  assert.equal(
    isResolvedSellerFilter({
      condition: 'bogus',
      language: 'english',
      location: 'germany',
      sellerType: 'any',
      foil: 'any',
      signed: 'any',
      altered: 'any',
    }),
    false,
  );
});
