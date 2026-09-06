# Cardmarket Skill – Verifikation & Status

> **Status: all states live-verified, auto-login ready** – State machine, login state, own offers on a card detail page, and guarded updates were validated on 2026-09-06. The Selling → My Offers → Singles listing and the AUTH_REQUIRED auto-login (open form → wait for user → re-run) were live-verified on 2026-09-07.

## Browserlos (erledigt)
- Scaffold `src/` (types, config, engine, actions, runtime, pages), `tests/`, `examples/`.
- `npm run typecheck` ✔, `npm test` ✔.
- `npm run cli -- list` ✔, `describe <id>` ✔.
- `site.config.ts`: `baseURL`, `requiresLogin=false`, Browser-Session `cardmarket-automation`,
  Attach `extension/chrome`, `cliCommand=playwright-cli`, Budgets (15s/90s).
- Read-only-Gates ✔: alle Aktionen `kind: read`; Schreibaktionen erfordern
  `APPROVAL_REQUIRED`; `plan/execute` existieren, aber dieser Skill nutzt sie nicht.
- Input/Output-Verifikation ✔: unbekannte Felder & Out-of-Range → `INVALID_INPUT`;
  Schema-Mismatch → `POSTCONDITION_FAILED`.
- **Beispiel-Inputs auf nacktes JSON-Objekt korrigiert.**

## Tooling-Befund (playwright-cli)
- Kein `browser`-Verb: `attach`/`list`/`click`/`press`/`type`/`fill`/`snapshot`/
  `screenshot`/`run-code`; Session fix via `--session`; CLI ist stateless.
- `attach` ohne Extension → `BROWSER_REQUIRED` (kein Browser gestartet); mit
  `--extension=chrome` → `ATTACH_FAILED`, solange der Operator den
  „Allow and select"-Dialog nicht auswählt.
- `open` startet einen managed Headless-Browser → **verboten**.

## Live (alt, vorherige Action-Oberfläche)
- `cards.search` (query „esix") → `found: true`, 10 Result-Kacheln.
- `cards.price` (Karte „esix") → `found: true`; Top-Block + Seller-Zeilen korrekt.
- `cards.artworks` (Karte „esix") → `found: true`, Versionen-Liste; `minQty=5` → Seller-Mengen-Check.
- Ergebnis: Status `scaffolded` → `live_verified` (für alte Oberfläche).

## 2026-09-05: „Search 2.0"–Regression & Repair
- **Befund:** Cardmarket hat das Top-Bar-Such-UI von der Startseite entfernt; das Form bleibt auf Game-Seiten.
- **Repair:** `site.config.ts` +`searchEntry: '/en/Magic'`; `SearchPage`:
  `openHome()` → `openSearchEntry()`.
- **Re-Verifikation:** `cards.search` „Forest" → `ok`; `cards.price` „Forest" → `ok`; `cards.artworks` „Esix, Fractal Bloom" → `ok`.
- **Status** für alte Oberfläche bleibt `live_verified` (2026-09-05).

## 2026-09-05: `cards.price` Seller-Filter
- **Feature:** Detailseite wendet vor dem Auslesen den Seller-Filter an.
- **Browserlos:** `npm run typecheck` ✔, `npm test` ✔.
- **Live:** `Spellskite` Default, `language=any`, und `location=any` + `condition=mint` + `language=german` validiert.
- **Status** für alte Oberfläche bleibt `live_verified` (2026-09-05).

## 2026-09-05: Search-Pagination
- **Feature:** `SearchResultsPage.extractCards(limit)` über multiple Seiten lesen und deduplizieren.
- **Browserlos:** `npm run typecheck` ✔, `npm test` ✔.
- **Live:** `cards.search` mit `limit: 50` über Page-Grenze validiert (Result #30 / #31).
- **Status** für alte Oberfläche bleibt `live_verified` (2026-09-05).

## 2026-09-05: State-Machine-Oberfläche
- **Architektur:** `cards.search`, `cards.price`, `cards.artworks` ersetzt durch:
  - `nav.search`
  - `nav.open`
  - `nav.versions`
  - `nav.artwork`
  - `nav.filter`
  - `info`
- **Vertrag:** Nav-Aktionen liefern nur `{ status, state }`; `info` detectiert den aktuellen State und liefert state-spezifische Daten.
- **Statuswerte:** `ok`, `not_found`, `not_available`, `wrong_state`.
- **State Detection:** `src/lib/state.ts` (`start`, `results`, `detail`, `versions`).
- **Page-Objekte:**
  - `CardDetailPage`: `hasFilterForm()`, `readCurrentFilter()`
  - `SearchResultsPage`: `tileCount()`, `query()`
  - `CardVersionsPage`: `tileCount()`, `cardFromUrl()`
- **Doku:** `SKILL.md` und References auf State-Machine-Oberfläche umgestellt.
- **Browserlos:** `npm run typecheck` ✔, `npm test` ✔.
- **Live:** ausstehend.

## 2026-09-06: State-Machine Live-Verifikation
- **Browser:** `npm run cli -- doctor` → `attached: true`, `browserLaunch: false`.
- **CLI:** `list`/`describe` zeigen die sechs neu registrierten Aktionen.
- **States:** `info` validiert `start`, `results`, `detail`, `versions`.
- **Transitions:** `nav.search` → `results`, `nav.open` → `detail`,
  `nav.versions` → `versions`, `nav.artwork` → `detail`,
  `nav.filter` → `detail`.
- **`info`:** state-spezifische Reads für Start, Resultate, Seller-Details
  und Versionen validiert.
- **`minQty > 0`:** `info` öffnet Detailseiten für die Seller-Mengen-Checks.
- **`wrong_state`:** `nav.versions` aus `versions` liefert
  `{ status: 'wrong_state', state: 'versions' }`.
- **Repair:** `CardDetailPage.openVersions()` navigiert direkt zur aufgelösten
  Versions-URL, weil der sichtbare `Show Versions`-Link beim Klicken nicht
  navigiert.
- **Browserlos:** `npm run typecheck` ✔, `npm test` 38/38 ✔.

## 2026-09-06: Login-State
- **Feature:** `info` liefert in allen States `auth: { loggedIn }`;
  neue Aktion `nav.home` navigiert zu `https://www.cardmarket.com/en`.
- **Detection:** sichtbare `form#header-login`, `form#offcanvas-login`,
  `input[name="username"]` oder `input[name="userPassword"]` bedeuten `loggedIn: false`.
- **Browserlos:** `npm run typecheck` ✔, `npm test` 38/38 ✔.
- **Live:** `nav.home` validiert; `info` in `start`, `results`, `detail`
  und `versions` liefert `auth.loggedIn: false`.
- **Pending:** `loggedIn: true` braucht eine echte angemeldete User-Session.

## 2026-09-06: CLI-Hinweise
- `run` benötigt immer `--input <file.json>`; `examples/input-empty.json`
  enthält `{}` für Parameterlose Kommandos.
- Doku empfiehlt den Timeout der aufrufenden Tool-Umgebung in ms und
  nimmt das auf stock macOS fehlende Bash-`timeout` nicht mehr an.
- **Browserlos:** `npm run typecheck` ✔, `npm test` 39/39 ✔.

## 2026-09-06: Own Offers & Guarded Offer Updates
- **Feature:** `user.offers` liest eigene `stockRow`-Angebote auf der Detailseite;
  `user.offer.update` ändert genau ein Angebot über das `Article_EditArticleModal`.
- **Modal-Felder:** `condition`, `idLanguage`, `isFoil`, `isSigned`, `isAltered`,
  `scan`, `comments`, `price`, `editAmount`; Submit-Button `Edit article`.
- **Sicherheit:** Write-Aktion mit `plan`, Account-/Form-Drift-Check, Approval,
  Plan-Reuse-Blockade und Post-Submit-Verifikation; `prepare` schließt das Modal
  ohne Speichern.
- **Browserlos:** `npm run typecheck` ✔, `npm test` 43/43 ✔.
- **Live:** `user.offers` liefert den Esix-Eintrag `articleId=2108603357`,
  Preis `0,25 €`, Menge `1`, Zustand `Excellent`, Sprache `English`.
- **Live-Write:** mit expliziter Freigabe Preis auf `0,26 €` geändert und verifiziert,
  anschließend auf `0,25 €` zurückgesetzt und verifiziert.
- **Known Gap:** `editAmount` bietet im getesteten Eintrag nur `1`; Mengen-Änderungen
  brauchen einen Eintrag mit mehreren verfügbaren `editAmount`-Optionen.

## 2026-09-06: Own Offers Listing State
- **Feature:** `own-offers` is the authenticated Selling → My Offers → Singles state (`/en/Magic/Stock/Offers/Singles`). `nav.own-offers` opens it, `nav.own-offers.filter` changes the left-side stock filters (especially `cardName`), and `nav.own-offers.open` follows one listing's card-name link to `detail`.
- **Pagination:** `info { all: true }` follows each enabled bottom next control until there is no next page, deduplicates by article ID, leaves the browser on the final page, and rejects a filter that Cardmarket drops during pagination.
- **Comparison guard:** `info` on a `detail` page now applies and verifies the canonical seller default or the caller's explicit seller-filter arguments before it returns other seller rows.
- **Browser-free:** `npm run typecheck` ✔; 38 non-browser tests ✔, including action registration, input validation, output guards, CLI list/describe, and existing write-safety tests.
- **Live:** not run — `npm run cli -- doctor` returned `BROWSER_REQUIRED`; no authenticated attached Chrome session was available. Verify navigation, all named filter controls, a multi-page filtered listing, and opening a row before marking this state live verified.

## 2026-09-07: Auto-Login on AUTH_REQUIRED
- **Feature:** A login-required action run while logged out no longer dead-ends. The runtime opens the Cardmarket login form in the attached browser (clicks the header login trigger, or falls back to the home page), waits up to `loginWaitMs` (120 s) for a human login, then re-runs the same action once. `actionBudgetMs` raised 90 s → 240 s to cover the wait. SKILL.md/flows.md updated; the duplicated "Automatic Login Handling" and "Require Login" sections were consolidated.
- **Fix:** the inlined `openLoginForm` no longer references module scope (`elementVisible`), which made every `page.evaluate(openLoginForm)` throw in the page and silently skip opening the form.
- **Browser-free:** `npm run typecheck` ✔, `npm test` 48/48 ✔.
- **Live (2026-09-07):** `nav.own-offers` while logged out succeeded in one call — the runtime kept the already-visible inline login form, the user logged in (account `Hayrus`), and the action re-ran to `state: own-offers` without a second command.
- **UI_DRIFT found live:** the own-offers POM identified its filter form as `form` index 3, but the logged-in page only has `form#searchForm` + the id-less stock-filter form (the logged-out login form shifts nothing once it is gone). Fixed by identifying the filter form via its `select[name="idLanguage"]` child.
- **Live re-verify:** `info` on `own-offers` now returns the filter state and 20 own offers (first pages) with `auth.loggedIn: true`.

## Known Gaps
- Neue State-Machine-Oberfläche live validiert (2026-09-06);
  `nav.versions` nutzt direkte Versions-URL-Navigation.
- Preise als Text im deutschen Format – Downstream-Parsing nötig.
- Such-Einstieg hängt an `searchEntry` = `/en/Magic`; entfernt Cardmarket das
  Top-Bar-Form auch von Game-Seiten, wieder `UI_DRIFT` → Einstieg per read-only
  `run-code`-Diagnose neu bestimmen.
- Login-Detection im Logged-Out- und Logged-In-Zustand live validiert.
- Mengen-Update im Esix-Testfall nicht weiter prüfbar, weil `editAmount`
  nur die Option `1` liefert.
- `own-offers` needs the authenticated live verification described above. The browserless filter fields cover the current Magic stock UI; unexpected per-game controls deliberately return `UI_DRIFT` instead of choosing a fallback.
