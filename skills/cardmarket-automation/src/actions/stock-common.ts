import type { Page } from 'playwright';

import { AutomationError } from '../runtime/errors.ts';
import { OwnOffersPage } from '../pages/OwnOffersPage.ts';
import type { OwnOfferFilter, OwnOfferFilterState } from '../types.ts';

/** Verified page size of the own-offers Singles table (20 rows per page). */
export const OWN_OFFERS_PAGE_SIZE = 20;

/**
 * Page number carried by an own-offers URL (`?site=N`); defaults to 1.
 * The URL is the only reliable record of which page the user started on.
 */
export function startPageOf(url: string): number {
  const match = /[?&]site=(\d+)/.exec(url);
  const value = match !== null ? Number(match[1]) : 1;
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** 1-based stock page containing the offer at `index` in the full list order. */
export function pageOfIndex(index: number): number {
  return Math.floor(index / OWN_OFFERS_PAGE_SIZE) + 1;
}

/**
 * Convert a read `OwnOfferFilterState` (visible labels and raw input values)
 * into an `OwnOfferFilter`. Empty values are dropped so `applyFilters` only
 * touches controls that actually differ from the form defaults after a
 * home-reset open.
 */
export function asFilter(state: OwnOfferFilterState): OwnOfferFilter {
  const filter: Record<string, string> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value !== '') filter[key] = value;
  }
  return filter as unknown as OwnOfferFilter;
}

/**
 * Restore the own-offers Singles view at a specific page after a major
 * navigation reset, using only compliant primitives:
 *   goHome (only allowed raw goto) -> UI menu open -> re-apply the captured
 *   stock filter -> click through pagination to the target page.
 */
export async function restoreOwnOffers(page: Page, filter: OwnOfferFilter, targetPage: number): Promise<OwnOffersPage> {
  const ownOffers = new OwnOffersPage(page);
  await ownOffers.goHome();
  await ownOffers.open();
  if (await ownOffers.applyFilters(filter)) await ownOffers.submitFilters();
  await ownOffers.waitUntilReady();
  for (let current = 1; current < targetPage; current++) {
    if (!(await ownOffers.goToNextPage()))
      throw new AutomationError('UI_DRIFT', `own-offers-page-${targetPage}`);
  }
  return ownOffers;
}
