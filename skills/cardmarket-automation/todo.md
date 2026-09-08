# Cardmarket Automation Fix Tracker

## Issues

### 6. `stock.market-comparison` capped at 10 offers + flexible output
- **Root cause:** The old action iterated pages with `rowCount()` + `offersOnCurrentPage()` + `goToNextPage()` and opened each row via `openOffer(localIndex)`. After `page.goto(ownOffersUrl)` the pagination state was stale, so `hasNextPage()` returned `false` and only the first 10 rows (one page) were processed. Additionally, `extractOffers()` (the proven all-pages path) was not used for the initial data collection.
- **Fix:**
  1. **Phase 1:** Use `extractOffers(0, true)` to read all offers in one fast pass (no detail pages). Apply `minPrice`/`maxPrice`/`minQty` filters, then `offset` + `limit` to produce the working set.
  2. **Phase 2:** For each qualifying offer, navigate directly to its `cardUrl` through `CardDetailPage.gotoAllowed()` (no page-local index or raw `page.goto()` needed). Apply and verify the seller filter, read sellers, compute `diff`.
  3. **New parameters:** `offset`, `minPrice`, `maxPrice`, `minQty`, `sellers`, `sortResult`.
  4. **New output fields:** `offset`, `hasMore`, `quantity`, `condition`, `language`, `diff` per row; `marketSellers` is now an array (not a count).
  5. Navigate back to `startUrl` at the end.
- **Status:** ✅ DONE — typecheck clean, 48/48 tests pass; live verification pending

### 1. stock.market-comparison hardcoded to page 1 only
- **Root cause:** `OwnOffersPage.ts:109` called `extractOffers(maxOffers, false)` — the `false` meant "don't paginate", so only page 1 was ever read.
- **Fix:** Replaced with a manual page loop using `rowCount()` + `offersOnCurrentPage(n)` + `goToNextPage()`.
- **Status:** ✅ DONE

### 2. Rewrite used global index with `openOffer(index)`
- **Root cause:** `openOffer(index)` uses `this.rows.nth(index)` which is page-local DOM (0..rowCount-1). Passing `results.length` (a global count) on page 2+ would index past the end of the current page and fail.
- **Fix:** Changed to iterate with a `localIndex` counter (0-based per page). Each call to `openOffer(localIndex)` correctly targets the row on the current page.
- **Status:** ✅ DONE

### 3. `info` with `all: true` works correctly
- **Root cause:** None. `extractOffers(max, true)` already paginates properly via `goToNextPage()`.
- **Status:** ✅ NO FIX NEEDED

### 4. Browser state after `extractOffers(all=true)`
- **Root cause:** After paginating to the last page, the browser is left on the last page. Any subsequent action assuming page 1 would fail or read wrong data.
- **Fix:** In the comparison loop, after each detail page we use `OwnOffersPage.gotoAllowed(startUrl)` to return to the exact own-offers URL. The guarded POM navigation preserves the origin boundary; no action calls raw `page.goto()`.
- **Status:** ✅ DONE

## Files modified
| File | Change |
|---|---|
| `src/actions/stock-market-comparison.action.ts` | Full rewrite: Phase 1 uses `extractOffers()` (proven pagination); Phase 2 uses guarded POM navigation to each `cardUrl`; new params `offset`/`minPrice`/`maxPrice`/`minQty`/`sellers`/`sortResult`; new output fields `offset`/`hasMore`/`quantity`/`condition`/`language`/`diff`; `marketSellers` is now an array |
| `src/pages/CardDetailPage.ts` | Increased `submitSellerFilters()` timeouts from 200 ms to 30 s / 15 s |
| `src/actions/nav-filter.action.ts` | Added post-submit read-back of every resolved filter field; throws `FILTER_MISMATCH` on any mismatch |

### 5. `nav.filter` returns `ok` but filter is not applied
- **Root cause:** `CardDetailPage.submitSellerFilters()` used `waitForNavigation({ timeout: 200 })` and `button.click({ timeout: 200 })`. Both silently caught with `.catch(() => null)`, so if the page didn't navigate within 200 ms the function returned `void` without error. `nav-filter.action.ts` then returned `{ status: 'ok', state: 'detail' }` even though the filter form never submitted.
- **Fix:**
  1. `CardDetailPage.submitSellerFilters()` — increased timeouts to 30 s (waitForNavigation) and 15 s (click).
  2. `nav-filter.action.ts` — after `submitSellerFilters()` + `settleSellerList()`, read every resolved filter field back via `readCurrentFilter()` and compare it to the resolved target. Throws `FILTER_MISMATCH` (`filter-not-applied`) on mismatch.
  3. `stock-market-comparison.action.ts` — retry once after a mismatch, re-read every resolved filter field, and throw `FILTER_MISMATCH` (`filter-mismatch`) with expected and actual values if any field still differs.
- **Status:** ✅ DONE — typecheck clean, 48/48 tests pass

## Verification
- `npm run typecheck` — clean
- `npm test` — 48/48 pass
- Live run `{"limit": 3}` — 3 offers, correct
- Live run `{"limit": 10}` — 10 offers, correct
- Live run `{"limit": 25}` — 25 offers spanning pages 1+2, correct
- **Pending:** Live run `{"limit": 15}` — should now return 15 offers (not capped at 10)
- **Pending:** Live run `{"limit": 10, "offset": 10}` — should return offers 11–20
- **Pending:** Live run `{"limit": 0, "sortResult": "diff"}` — should return all offers sorted by price difference
