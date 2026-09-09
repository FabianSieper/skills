# Cardmarket Automation Fix Tracker

## Issues

### 9. Installed skill copy silently stale; no repo→`~/.agents` sync path; generic transport errors
- **Symptom:** OpenCode skill discovery loaded `~/.agents/skills/cardmarket-automation` (pre-09-08 build) instead of the repo's canonical skill; live `status` returned a generic `INTERNAL` (exit 4) with no operator-facing cause, and the stale SKILL.md guided the operator into the legacy raw-transport pitfall.
- **Root cause:** `task install:opencode` installs a remote snapshot via `npx skills add` and never syncs local repo work; the installed copy lacked `node_modules`, so even a manual copy failed on missing `playwright`/`esbuild`. Transport failures mapped to a generic `playwright-cli` step and discarded stderr.
- **Fix:**
  1. New `scripts/sync-installed.mjs` + `Taskfile sync:agents`: copies the repo skill over the global copy (preserves the target's `node_modules`, excludes `.local`/`.playwright-cli`, removes stale top-level entries), idempotent.
  2. Freshness guard: the CLI envelope (success and error) now carries `version` + `implementationHash` (hash covers `src/**`, `site.config.ts`, `package.json`, `package-lock.json` only — docs never invalidate it); `SKILL.md` pins the expected values and instructs to stop and re-sync on mismatch.
  3. `runCli` failures now report a subcommand-level step (`playwright-cli:tab-select`, ...) plus a bounded stderr `cause` (≤240 chars) on `TIMEOUT`/`ATTACH_FAILED`.
  4. `package.json` bumped 0.2.0 → 0.3.0.
- **Verification:** `npm run typecheck` clean; `npm test` 63/63; concept validator ok (45 links / 15 actions); `npm run cli -- list` envelope reports `version 0.3.0` + pinned hash; installed copy synced and validated.
- **Status:** ✅ DONE — live browser verification (Cardmarket tab) still pending

### 10. Tab selection assumed a Cardmarket tab; open non-cardmarket (debug) tabs unusable
- **Symptom:** With a debug tab group already open in Chrome, `status` failed with `BROWSER_REQUIRED no-cardmarket-tab` (the controlled group contained only the extension's Welcome tab); an already-open non-cardmarket tab could not be used, and `Allow & select` could not see tabs outside the controlled group.
- **Fix:**
  1. The transport now selects the first Cardmarket tab, or — if none — the first existing non-extension tab; `BROWSER_REQUIRED no-controllable-tab` only when the group has no usable tab at all.
  2. When a selected tab is outside Cardmarket at action entry, the generated bundle navigates it to the configured home entry via `SitePage.goHome()` — the only raw `goto` the navigation policy allows (operator directive 2026-09-09: use any open tab, navigate to cardmarket if not already there).
  3. `SKILL.md` documents that existing tabs (e.g. from a debug tab group) are brought under control by dragging them into the `Playwright · playwright-cli` group.
  4. `package.json` bumped 0.3.0 → 0.4.0; `SKILL.md` freshness pin re-pinned to the new hash.
- **Status:** ✅ DONE — typecheck clean, 63/63 tests pass, concept validator ok (45 links / 15 actions); live browser verification pending (needs a user-dragged tab in the group)

### 8. CLI transport: `selectCardmarketTab()` broke on `playwright-cli` 0.1.19 `tab-list` output
- **Symptom:** `npm run cli -- status` / `run info` returned `INTERNAL` (exit 4) with the browser session attached; one cli test failed expecting a structured prerequisite error.
- **Root cause:** `playwright-cli 0.1.19` `tab-list --json` returns a wrapper object `{"result": "<markdown tab list>"}` (rendered via `renderTabsMarkdown`), not a JSON array of `{index,url,title}`. The old code did `JSON.parse` (succeeded) and then called `.findIndex` on the object → raw `TypeError` → mapped to `INTERNAL`.
- **Fix:** `src/runtime/cli-browser.ts` now uses `tab-list --raw` and a tolerant `parseTabList()` that handles three payload shapes: JSON array (older CLI), JSON wrapper `{"result": "..."}` (current CLI), and plain markdown lines `- <i>: (current) [title](url)`. Unknown output still throws `CLI_PROTOCOL('tab-list')`; a parsed list without a `https://www.cardmarket.com` tab throws `BROWSER_REQUIRED('no-cardmarket-tab')`.
- **Verification:** new `tests/cli-browser.test.ts` (5 cases); `npm run typecheck` clean; `npm test` 63/63 pass in repo and in the installed `.agents` copy after sync; installed CLI `status` now returns `BROWSER_REQUIRED no-cardmarket-tab` (exit 3) instead of `INTERNAL`.
- **Status:** ✅ DONE

### 7. Navigation transport policy: UI-only forward, history return, home-only goto
- **User rule:** In Cardmarket we navigate only via UI interaction; raw `goto` is reserved for the home page when we want back there.
- **Fix:**
  1. `SitePage`: removed `gotoAllowed(url)`; added `goHome()` (raw goto to `config.baseURL + config.homeEntry`) and `goBack()` (browser history).
  2. `SearchPage`: `openSearchEntry()` now switches to the `/en/Magic` surface via the real top-nav "Magic: The Gathering" link (with a `goHome()` retry) instead of raw goto to `searchEntry`.
  3. `OwnOffersPage`: added `rowIndexFor(articleId)` + `openOfferById(articleId)` (UI row click) and `goBack()`; added `applyFilters(OwnOfferFilter)` coercion for restoring a captured filter state.
  4. `CardDetailPage`: added `backToVersions(expectedUrl)` (real "Show Versions" button click + URL verification).
  5. `nav-home` / `info` actions use the new primitives.
  6. New shared helper `src/actions/stock-common.ts` (`startPageOf`, `pageOfIndex`, `asFilter`, `restoreOwnOffers`): both stock flows restore the user's exact start page (home → menu chain → re-apply filter → walk to original page) after finishing; Phase 2 walks own-offers pages with `goToNextPage()` + `openOfferById()` + `goBack()` instead of raw goto to `cardUrl`.
- **Verification:** `grep` finds no `gotoAllowed` under `src`; typecheck clean; concept verify ok (45 links / 15 actions). Live re-run of `stock.market-comparison` pending (browser session dropped during the session).
- **Status:** ✅ DONE — live CLI re-verification pending

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

### 6. Browser interaction: Root cause analysis — `press Enter` navigates to `about:blank`, refs stale between commands

- **Root cause:** The agent calls `playwright-cli` directly with individual commands (`fill`, `press Enter`, `snapshot`, `click`) instead of using the `run-code` mechanism from `cli-browser.ts`. This causes three problems:

  1. **`press Enter` on Cardmarket forms navigates to `about:blank`** — Cardmarket uses JS-based navigation. Pressing Enter on the Name search form triggers a broken form submit, navigating to `about:blank` and breaking the session. Reproducible: `playwright-cli -s=chrome fill f1e156 esix` followed by `playwright-cli -s=chrome press Enter` → Page URL: `about:blank`.

  2. **Refs become invalid between commands** — Each `playwright-cli` call is an independent Node.js process with its own WebSocket relay. refs (e.g. `f9e207`) are snapshot-local and valid only for the snapshot they were extracted from. After any navigation (including `about:blank`), all refs are dead. A `click f9e207` after a previous `snapshot` fails with `Ref f9e207 not found`.

  3. **`run-code --filename` works, but the agent doesn't use it** — `cli-browser.ts` (lines 166–179) writes a JS file to `.local/run-code/<uuid>.js` and calls `playwright-cli -s=<session> --raw run-code --filename=<path>`. This works reliably (tested with `/tmp/test-run-code.js`). The agent ignores this mechanism and calls `playwright-cli` directly.

  4. **`run-code` with inline code requires an Arrow Function** — `run-code 'console.log("hello")'` fails with `SyntaxError: Unexpected token ';'`. Correct: `run-code 'async (page) => { await page.click("button"); return "done"; }'`. The agent must know that inline code must be an Arrow Function.

  5. **`attach --extension=chrome` creates new relay ports each time** — This is expected behavior. The Chrome extension relay listens on a random port (e.g. 54950). The session is persistent in Chrome, not in the CLI process. The agent should not distinguish between "new session" and "old session".

  6. **Workaround: `goto` with URL parameter** — `playwright-cli -s=chrome goto 'https://www.cardmarket.com/en/Magic/Stock/Offers/Singles?name=esix'` works immediately, without `press Enter` or refs. This is the most reliable way to search on Cardmarket.

- **Fixes for future agents:**
  1. **Never use `press Enter` on Cardmarket forms** — Use `click` on the Search button (but only within a single `run-code` invocation, since refs are snapshot-local). NEVER, IN ANY CIRUMSTANCE, JUST GO TO ANY URL. USE THE NAVIGATION VIA THE UI ELEMENTS. THAT SHOULD BE TRUE IN EVERY SCNEARIO
  2. **Always bundle compound actions in a single `run-code` invocation** — `fill` + `click` or `fill` + `press Enter` must execute atomically in `run-code 'async (page) => { ... }'`.
  3. **Use `run-code --filename` for complex actions** — If the agent calls `playwright-cli` directly, it should mimic the `--filename` mechanism from `cli-browser.ts`: write JS file, call `run-code --filename=<path>`, delete file.
  4. **Always fetch a new `snapshot` after every navigation** — refs are valid ONLY for the snapshot they were extracted from. After `goto`, `click` on a navigating page, or any other navigation-triggering event, a new snapshot must be fetched.
  5. **`run-code` inline code must be an Arrow Function** — Syntax: `run-code 'async (page) => { await page.click("button"); return "result"; }'`. No plain JavaScript, no semicolons at the start.
  6. **`attach --extension=chrome` is not an error** — New relay ports per call are expected. The Chrome session is persistent.
- **Status:** ✅ DONE — **SUPERSEDED.** Entries 6–7 describe the legacy raw `playwright-cli` approach. The current skill is the closed strict CLI (`npm run cli -- ...`), which never exposes these raw-browser failure modes to the operator. The transport notes now live in `references/transport.md` (builder-level only); `SKILL.md` points there instead of teaching raw `playwright-cli`.

### 7. Cardmarket-Suche: `?name=`-URL-Parameter statt UI-Interaktion

- **Problem:** Die Suche über UI-Input-Felder (`#Name` fill + Enter/Click) killt die Browser-Session (Session wird geschlossen, `about:blank`). Zudem gibt es Cloudflare-Schutz ("Just a moment..." Seite) der das Laden erschwert.
- **Lösung:** Direkte URL mit Query-Parameter — `https://www.cardmarket.com/en/Magic/Stock/Offers/Singles?name=esix` — filtert sofort nach Kartenname ohne jegliche UI-Interaktion.
- **Workflows:**
  1. **Einfache Kartensuche:** `goto "https://www.cardmarket.com/en/Magic/Stock/Offers/Singles?name=<kartenname>"` + `document.body.innerText` extrahieren.
  2. **Datenextraktion:** Daten sind clientseitig gerendert, nicht als HTML-Tabellen verfügbar. `document.body.innerText` ist der zuverlässigste Weg.
  3. **Keine Input-Felder nutzen:** `fill("#Name", ...)` führt zum Session-Abbruch.
   4. **Keine refs über Navigation hinaus nutzen:** refs sind snapshot-lokal und nach jeder Navigation ungültig.
- **Status:** ✅ DONE — **SUPERSEDED** (see entry 6): legacy raw `playwright-cli` approach; the current strict CLI never uses raw `goto`/`fill`/refs. Transport notes: `references/transport.md`.

### Navigation clarity (2026-09-08, done)
- **Problem:** a local operator AI could not tell where each action leads, so moving from one UI point to another relied on guessing.
- **Fix:** `availableActionDetails` now returns `description`, `from`, `to` (happy-path destination) and `requiredInput` for each currently legal action; `SKILL.md` adds a state→action→destination map backed by the same data.
- **Status:** ✅ DONE — typecheck clean, 58/58 tests pass, concept validator OK; live `status` at `detail` verified (`nav.versions`→versions, `nav.filter`→detail, `nav.home`→start, `nav.search`→results). Account writes remain `NOT_VERIFIED`.
