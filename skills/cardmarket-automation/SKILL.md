---
name: cardmarket-automation
description: Registrierte, read-only Playwright-Aktionen für Cardmarket (Kartensuche, Preis-/Seller-Details, Artwork-/Versions-Liste). Der Skill hängt an den bereits geöffneten Browser des Nutzers an (fest benannte playwright-cli-Session) und startet nie einen eigenen Browser. Verwende bei Fragen zu Cardmarket-Kartenpreisen, -Verfügbarkeit, Sellers oder Druckvarianten.
---

# Cardmarket-Automatisierung (Skill)

> **Browser-Kontrakt:** Der Operator hat seinen Browser (Chrome) bereits geöffnet.
> Dieser Skill hängt nur an diesen an (Session `cardmarket-automation`,
> `playwright-cli attach --extension=chrome`) und **startet/ersetzt/schließt nie einen
> Browser**. Browser fehlt → harter Stopp (`BROWSER_REQUIRED` / `ATTACH_FAILED`).
>
> **Status:** `live_verified` – implementiert, dokumentiert, live validiert
> (`references/verification.md`). „Search 2.0" (2026-09) hat das Such-UI von der
> Startseite entfernt; der Einstieg läuft jetzt über eine Game-Seite
> (`searchEntry`, s. u.). Keine Aktion ohne Bestätigung in einen Plan.

## Aktionen (read-only, öffentlich, kein Login)

| ID | Was sie tut | Parameter |
|---|---|---|
| `cards.search` | Kartensuche → Kacheln (Set, ab-Preis, Detail-URL) | `query`, `limit=20` |
| `cards.price` | Karte → Detailseite: Top-Block (Rarity, Bestand, Trend) + Seller-Angebote | `name`, `sellers=50` |
| `cards.artworks` | Versionen/Artworks auflisten; optional Seller-Mengen-Check je Kachel | `name`, `minQty=0`, `limit=40` |

Alle starten auf dem **Such-Einstieg** (`config.searchEntry` = `/en/Magic`) und
navigieren nur über sichtbare UI-Elemente (Suche, Ergebnis-Kachel, „Show Versions")
– kein Direct-Goto/Deep-Link zu Detail-/Versions-URLs. Der Einstieg ist eine
Game-Seite, weil „Search 2.0" (2026-09) das Such-UI von der Startseite (`/en`)
entfernt hat (das Form bleibt auf Game-Seiten). Typischer Flow:
`cards.search → cards.price → cards.artworks`.

Details (Parameter, Output-Schema, Selektoren): `references/actions.md`, `references/selectors.md`.

## Aktionen aufrufen

```bash
npm run cli -- list                          # registrierte Action-IDs
npm run cli -- describe cards.price          # Parameter + Output-Schema einer Action
npm run cli -- run cards.search --input f.json   # JSON-Input = Dateipfad (kein Inline-JS)
npm run cli -- doctor                        # Browser anhaftbar? (Browser-Check)
```

`--input` erwartet die Parameter als **nacktes JSON-Objekt** (nicht in
`{action, input}` eingewickelt) – sonst `INVALID_INPUT`:
```json
{ "query": "Forest", "limit": 20 }
```
Beispiel-Inputs: `examples/input.json` (search), `examples/input-price.json` (price),
`examples/input-artworks.json` (artworks).

Der Agent wählt **ausschließlich** eine registrierte Action-ID + validiert den Input –
nie freien JS-Code, kein `run-code` mit eigenen Selektoren.

## CLI-Betrieb & Diagnose

**Zeiteinheiten:** `timeout`/`actionBudgetMs`/`planTtlMs` sind **Millisekunden**.
Auch der Bash-Tool-`timeout` verhält sich hier in **ms** (Beobachtung: `timeout: 120`
brach einen mehrsekündigen `run` ab) → nicht zu klein setzen: `list`/`describe`/
`doctor` ≈ `3000`, `run` ≥ `180000` (Skill-Budget `actionBudgetMs` = `90000`).

**Session-/UI-Diagnose** (read-only, **erlaubt**; dient nur dem Troubleshooting,
ersetzt keine registrierte Aktion):
```bash
playwright-cli list --json
playwright-cli attach --extension=chrome --session=cardmarket-automation
playwright-cli -s=cardmarket-automation --raw run-code --filename=<diag.ts>
```
`-s` (nicht `--session`) + `--raw` sind Pflicht; `run-code` erhält `page`, dort nur
**read-only** DOM-Snippets (Locators, `count()`, `textContent`) – keine eigenen
Aktionen/Selektor-POMS; `open` bleibt verboten (eigener Browserstart).

**`BUSY` (Runtime-Lock):** Lock liegt in `.local/runtime.lock` (PID + Zeitstempel).
Ein abgebrochenes `run` (z. B. zu kurzer Bash-Timeout) hinterlässt ein **stale**
Lock. Vor dem Löschen PID prüfen: `ps -p <pid>` – Lock nur bei **keinem**
laufenden Prozess entfernen, sonst auf den laufenden Prozess warten.

**Vor dem ersten `run`:** `references/build-state.json` + `references/verification.md`
lesen (Status, Known Gaps, letzte Live-Validierung).

## Fehler- und Stoppregeln

| Situation | Verhalten |
|---|---|
| Browser fehlt / nicht anhängbar | `BROWSER_REQUIRED` / `ATTACH_FAILED` – **harter Stopp**, kein Browserstart |
| Cloudflare-Persistenz > 90 s | `HUMAN_REQUIRED` – Operator löst die Challenge manuell in Chrome |
| Kein Treffer / keine Versionen | `found: false` mit leeren Listen (kein Fehler) |
| Unknown Action-ID | `UNKNOWN_ACTION` |
| UI-Drift / ambiguer Selektor | `UI_DRIFT` / `AMBIGUOUS_SELECTOR` – an Builder, nie `.first()`/`.nth()`/force |
| Ungültiger Input | `INVALID_INPUT` – Parameter korrigieren |
| `BUSY` (Lock belegt) | s. „CLI-Betrieb & Diagnose": PID checken, nur stale Lock entfernen |

## Verifikation

- Browserlos: `npm run typecheck`, `npm test`, `npm run cli -- list` / `describe`
- Live (Checkliste `references/verification.md`): `cards.search`, `cards.price`,
  `cards.artworks` (inkl. `minQty`); Submit via `form.requestSubmit()`

## Referenzen

- `references/actions.md` – Parameter + Output-Schema je Action
- `references/flows.md` – Standard-/Alternativ-Flows, Abbruch
- `references/selectors.md` – verifizierte Selektoren + Strategie
- `references/verification.md` – Status + Live-Checks + Known Gaps
- `references/build-state.json` – maschinenlesbarer Status
- `examples/` – Beispiel-Inputs für `run --input`
