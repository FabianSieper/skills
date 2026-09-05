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

## Known Gaps
- `SHOW MORE RESULTS`-Button: Verhalten unvollständig verifiziert (die Action liest
  nur die bereits gerenderten Zeilen) – `references/selectors.md`.
- Preise als Text im deutschen Format – Downstream-Parsing nötig.
