# Cardmarket Skill – Verifikation & Status

> **Status: `login-state ready`** – State-Machine live validiert (2026-09-06); neues Login-State-Feature browserlos validiert und im Logged-Out-Zustand live validiert; Logged-In-Check wartet auf User-Session.

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

## Known Gaps
- Neue State-Machine-Oberfläche live validiert (2026-09-06);
  `nav.versions` nutzt direkte Versions-URL-Navigation.
- Preise als Text im deutschen Format – Downstream-Parsing nötig.
- Such-Einstieg hängt an `searchEntry` = `/en/Magic`; entfernt Cardmarket das
  Top-Bar-Form auch von Game-Seiten, wieder `UI_DRIFT` → Einstieg per read-only
  `run-code`-Diagnose neu bestimmen.
- Login-Detection im Logged-Out-Zustand live validiert; Logged-In-Detection
  bleibt ohne echte User-Session unverifiziert.
