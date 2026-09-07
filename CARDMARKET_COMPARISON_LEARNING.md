# Cardmarket Market Comparison — Lessons Learned

## Problem
Compare 110 own Cardmarket offers against market prices to identify overpriced and underpriced cards.

## What Worked
- `nav.own-offers` — navigates to the stock page.
- `info { all: true, limit: 50 }` — successfully extracts all 110 offers across 6 pages. Returns `complete: true`.
- `nav.own-offers.filter { sort: "Price (most expensive first)" }` — re-sorts the listing.

## What Failed / Bottlenecks

### 1. `stock.market-comparison` capped at 10 results
**Symptom:** Regardless of `limit` parameter (tried 100, 150, 0, 10000), always returned exactly 10 offers.

**Root cause:** The action iterates through the **current page only** and does not paginate. It reads `rowCount()` from the visible table rows (20 per page by default), but only processes the first 10 rows before the loop exits. The pagination logic (`hasNextPage` / `goToNextPage`) exists in the code (`OwnOffersPage.ts`) but the action breaks after processing 10 items — likely due to a `remaining <= 0` check or the `readOnCurrentPage` calculation being capped at 10.

**Fix for future agents:** The `stock.market-comparison` action code has pagination logic but appears buggy. Either:
- Patch the action to correctly paginate (increase `readOnCurrentPage` or fix the `remaining` check)
- Or manually iterate: use `nav.own-offers.open { index: N }` for each offer, then `info` on the detail page to get seller data, then navigate back. This is slower but reliable.

### 2. `nav.own-offers.open` rejected with `INVALID_INPUT`
**Symptom:** `{"action":"nav.own-offers.open","params":{"index":0}}` returned `INVALID_INPUT`.

**Root cause:** The CLI expects the action ID as a positional argument, not inside the JSON. The correct format is:
```bash
node --experimental-strip-types src/cli.ts run nav.own-offers.open --input /tmp/cm-open.json
```
where `/tmp/cm-open.json` contains just `{"index": 0}`.

**Fix:** Always pass the action as a CLI positional arg (`run <action-id>`), and put params only in the input file.

### 3. CLI invoked from wrong directory
**Symptom:** `node --experimental-strip-types src/cli.ts` failed with `Cannot find module`.

**Root cause:** The CLI was run from `/Users/private/Downloads/skills-repo` (working directory) instead of the skill directory.

**Fix:** Always use the full path: `node --experimental-strip-types /Users/private/.agents/skills/cardmarket-automation/src/cli.ts`

### 4. `stock.market-comparison` is slow — 1.5s per offer
**Symptom:** Each offer takes ~1.5 seconds (open detail, apply filters, read sellers, navigate back). For 110 offers that's ~165 seconds (2.75 minutes) minimum.

**Optimization:** If `stock.market-comparison` worked correctly with pagination, it would handle all 110 offers in one call. Since it doesn't, a batch approach (opening multiple offers via the CLI in sequence) would be faster than manual iteration.

## Recommended Approach for Future Agents

1. **Try `stock.market-comparison { limit: 150 }` first** — it may work in a newer version of the skill. If it returns all offers, you're done.

2. **If capped at 10:** Run it 11 times with `nav.own-offers.filter { sort: "Price (most expensive first)" }` between runs to shift which 10 offers are visible, then merge results. This is a workaround but avoids pagination bugs.

3. **If that's unreliable:** Manually iterate:
   - Get all offers via `info { all: true }`
   - For each offer, call `nav.own-offers.open { index: N }` then `info` on the detail page
   - Extract seller prices from the detail page
   - Navigate back to own-offers after each

4. **Sort by price** before running comparisons to surface outliers quickly. The 5 cheapest and 5 most expensive offers are the most interesting for the user's criteria.

## Key File Paths
- Skill: `/Users/private/.agents/skills/cardmarket-automation/`
- CLI: `src/cli.ts`
- Market comparison action: `src/actions/stock-market-comparison.action.ts`
- Own offers page: `src/pages/OwnOffersPage.ts`
- All 110 offers data: saved in previous `info { all: true }` output (110 offers, 6 pages)

## Offer Summary (from `info { all: true }`)
- 110 total offers
- Most are priced at €0.25 (bulk of Doctor Who cards)
- Notable outliers:
  - "Quantum Misalignment" — €12.00 (highest)
  - "Jaheira, Friend of the Forest" — €4.00 (Japanese language)
  - "Thran Dynamo" — €2.20
  - "Guardian of Faith" — €1.70 (Near Mint)
  - "Beacon of Creation" — €1.60 (Good condition)
  - "Fungal Sprouting" — €1.40
  - "Eternal Witness" — €1.00
  - "The War Games" — €0.15 (lowest)
  - "Time Wipe" — €0.15
  - "Trenzalore Clocktower" — €0.15

## Critical Bug in `stock-market-comparison.action.ts`

The action code looks correct at first glance but has a subtle pagination issue. After the first page processes 10 offers (not 20), the loop exits. This suggests either:

1. **`rowCount()` returns 10 instead of 20** on the first page (Cardmarket may render fewer rows by default)
2. **`hasNextPage()` returns false after the first page** — possibly because after navigating back via `page.goto(ownOffersUrl)`, the pagination control is in a stale state or the `#UserOffersTable` selector matches but the `a.pagination-control[data-direction="next"]` element is not yet rendered or is hidden
3. **`offersOnCurrentPage()` only returns 10 rows** — the `.table-body .article-row` selector may only match 10 visible rows

**Debugging steps for future agents:**
- After `offersOnCurrentPage()`, log the length to verify how many rows were actually read
- After navigating back to own-offers, explicitly check `hasNextPage()` and log the result
- Try calling `goToNextPage()` manually and verify the URL changed
- Consider using `nav.own-offers.filter` to set a higher items-per-page (if Cardmarket supports it)

**Workaround:** Since `info { all: true }` correctly paginates and returns all 110 offers, the `OwnOffersPage.extractOffers()` method works. The bug is isolated to `stock.market-comparison.action.ts`. Either fix the pagination in that action, or use `info { all: true }` + manual detail-page inspection for each offer.

## Quick Fix for the Bug

The most likely fix is to ensure that after `page.goto(ownOffersUrl)`, we wait for the pagination control to be both visible AND enabled:

```typescript
await page.goto(ownOffersUrl, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('#UserOffersTable', { state: 'visible', timeout: 60_000 });
// Add this:
await ownOffers.nextControl.waitFor({ state: 'visible', timeout: 30_000 });
```

Or alternatively, after navigating back, call `await ownOffers.hasNextPage()` immediately and log the result to diagnose.
