# Cardmarket Skill – Verifikation & Status

> **Status: `live_verified`** – implementiert, dokumentiert, live validiert.

## Browserlos (erledigt)
- Scaffold `src/` (types, config, engine, actions, runtime, pages), `tests/` (30), `examples/`.
- `npm run typecheck` ✔, `npm test` ✔ (30/30).
- `npm run cli -- list` ✔, `describe <id>` ✔ (Parameter + Output-Schema korrekt).
- `site.config.ts`: `baseURL`, `requiresLogin=false`, Browser-Session `cardmarket-automation`,
  Attach `extension/chrome`, `cliCommand=playwright-cli`, Budgets (15s/90s).
- Read-only-Gates ✔: alle Aktionen `kind: read`; Schreibaktionen erfordern
  `APPROVAL_REQUIRED`; `plan/execute` existieren, aber dieser Skill nutzt sie nicht.
- Input/Output-Verifikation ✔: unbekannte Felder & Out-of-Range → `INVALID_INPUT`;
  Schema-Mismatch → `POSTCONDITION_FAILED`.
- **Beispiel-Inputs auf nacktes JSON-Objekt korrigiert** (`{action, input}`-Wrapper
  würde `INVALID_INPUT` auslösen).

## Tooling-Befund (playwright-cli)
- Kein `browser`-Verb: `attach`/`list`/`click`/`press`/`type`/`fill`/`snapshot`/
  `screenshot`/`run-code`; Session fix via `--session`; CLI ist stateless.
- `attach` ohne Extension → `BROWSER_REQUIRED` (kein Browser gestartet); mit
  `--extension=chrome` → `ATTACH_FAILED`, solange der Operator den
  „Allow and select"-Dialog nicht auswählt.
- `open` startet einen managed Headless-Browser → **verboten**.

## Live (erledigt)
- `cards.search` (query „esix") → `found: true`, 10 Result-Kacheln (Name/Set/Bild/
  ab-Preis/URL); Submit via `requestSubmit()`.
- `cards.price` (Karte „esix") → `found: true`; Top-Block + Seller-Zeilen korrekt
  (z. B. 1 Seller, 1321,25 €, 1 Stück, EN, NEAR MINT).
- `cards.artworks` (Karte „esix") → `found: true`, Versionen-Liste (z. B. 7 Einträge,
  11 versions); `minQty=5` → Seller-Mengen-Check je Kachel (0/51/61, `qualifies`).
- Ergebnis: Status `scaffolded` → `live_verified`.

## 2026-09-05: „Search 2.0"–Regression & Repair
- **Befund (live, Session `cardmarket-automation`):** `/en` → `searchForm=0`,
  `searchInput=0`, `searchBtn=0`; `/en/Magic` → `searchForm=1`, `searchInput=1`,
  `searchBtn=1`. Cardmarket hat das Top-Bar-Such-UI von der Startseite entfernt;
  das Form bleibt auf Game-Seiten. Damit brach `SearchPage.openHome()` (→
  Basis-URL `/en`) alle drei Aktionen bei `search-input` mit `UI_DRIFT`.
- **Repair:** `site.config.ts` +`searchEntry: '/en/Magic'`; `SearchPage`:
  `openHome()` → `openSearchEntry()` mit `gotoAllowed(config.searchEntry)`.
- **Re-Verifikation (live, nach Repair):** `cards.search` „Forest" → `ok`, 20
  Kacheln; `cards.price` „Forest" → `ok`, Top-Block; `cards.artworks` „Esix,
  Fractal Bloom" (ursprünglicher Fehlerfall) → `ok`, 3 Versionen. `typecheck` ✔,
  `npm test` ✔ (30/30).
- **Status bleibt** `live_verified` (erneut validiert, 2026-09-05).

## 2026-09-05: `cards.price` Seller-Filter
- **Feature:** Detailseite wendet vor dem Auslesen den Seller-Filter an
  (Default `excellent`, `english`, `germany`), klickt „Filter", wartet auf Reload
  und liest erst dann Top-Block + Seller-Zeilen.
- **Browserlos:** `npm run typecheck` ✔, `npm test` ✔ (36/36, inkl.
  `tests/seller-filters.test.ts`).
- **Live (Session `cardmarket-automation`):**
  - `Spellskite` Default → URL `?sellerCountry=7&language=1&minCondition=3`,
    5 Seller (alle Germany/English, min. Excellent).
  - `Spellskite` + `language=any` → URL `?sellerCountry=7&minCondition=3`,
    5 Seller (alle Germany, verschiedene Sprachen).
  - `Spellskite` + `location=any`, `condition=mint`, `language=german`
    → URL `?language=3&minCondition=1`, 0 Seller (keine passenden German-Mint-Angebote).
- **Status bleibt** `live_verified` (Seller-Filter validiert, 2026-09-05).

## Known Gaps
- `SHOW MORE RESULTS`-Button: Verhalten unvollständig verifiziert (die Action liest
  nur die bereits gerenderten Zeilen) – `references/selectors.md`.
- Preise als Text im deutschen Format – Downstream-Parsing nötig.
- Such-Einstieg hängt an `searchEntry` = `/en/Magic`; entfernt Cardmarket das
  Top-Bar-Form auch von Game-Seiten, wieder `UI_DRIFT` → Einstieg per read-only
  `run-code`-Diagnose neu bestimmen (vgl. 2026-09-05-Regression).
