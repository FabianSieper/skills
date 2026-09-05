---
name: cardmarket-automation
description: Registrierte, read-only Playwright-Aktionen für Cardmarket (Kartensuche, Preis-/Seller-Details, Artwork-/Versions-Liste). Der Skill hängt an den bereits geöffneten Browser des Nutzers an (fest benannte playwright-cli-Session) und startet nie einen eigenen Browser. Verwende bei Fragen zu Cardmarket-Kartenpreisen, -Verfügbarkeit, Sellers oder Druckvarianten.
---

# Cardmarket-Automatisierung (Skill)

> **Browser-Kontrakt:** Der Operator hat seinen Browser (Chrome) bereits
> geöffnet. Dieser Skill hängt ausschließlich an diesen Browser an
> (fest benannte Session, `playwright-cli attach --extension=chrome`) und
> **startet, ersetzt oder schließt nie einen Browser**. Fehlender oder
> nicht anhängbarer Browser ist ein harter Stopp
> (`BROWSER_REQUIRED` / `ATTACH_FAILED`) – kein Managed-Fallback.
>
> **Status:** `live_verified` – Aktionen sind implementiert, dokumentiert
> und live validiert (siehe `references/verification.md`). Keine Aktion
> ohne Bestätigung in einen Plan aufnehmen.

## Was der Skill kann

Read-only-Aktionen auf `https://www.cardmarket.com` (öffentlich, kein Login):

| Action-ID | Was sie tut |
|---|---|
| `cards.search` | Sucht Karten (Name/Begriff) und liefert Result-Kacheln mit Set, ab-Preis und Detail-URL |
| `cards.price` | Sucht die Karte (Name), öffnet das erste Suchergebnis über die Such-UI und liefert Top-Block (Rarity, Verfügbarkeit, Preistrend) plus Seller-Angebote |
| `cards.artworks` | Listet alle Druckvarianten/Artworks einer Karte (Set, Version, Verfügbarkeit, ab-Preis, Bild, URL); optional Seller-Mengen-Check |

Details (Parameter, Output-Schema, Validierung): `references/actions.md`.

## Typischer Flow

```
cards.search  →  cards.price  →  cards.artworks
```

1. `cards.search` mit `query` → Result-Kacheln
2. `cards.price` mit `name` (und optional `sellers`)
3. `cards.artworks` mit `name` (und optional `minQty` / `limit`)

Alle Aktionen starten auf der Startseite (`www.cardmarket.com`) und navigieren
nur über sichtbare UI-Elemente (Suche, Ergebnis-Kachel, „Show Versions") –
kein Deep-Link / kein Direct-Goto auf Teil-URLs.

## Aktionen aufrufen

```bash
# Alle registrierten Aktionen (listet die verfügbaren Action-IDs)
npm run cli -- list

# Eine Aktion aufrufen (JSON-Input über --filename, kein Inline-JS)
npm run cli -- run cards.search --filename /pfad/zum/input.json
```

Der Agent wählt **ausschließlich** eine registrierte Action-ID plus
Validierung des JSON-Inputs – nie freien JavaScript-Code,
kein `run-code` mit eigenen Selectors, keine Snapshot-Referenzen.

Beispiel-Inputs: `examples/input.json`, `examples/input-price.json`,
`examples/input-artworks.json`.

## Fehler- und Stoppregeln

| Situation | Verhalten |
|---|---|
| Browser fehlt / nicht anhängbar | `BROWSER_REQUIRED` / `ATTACH_FAILED` – **harter Stopp**, kein Browserstart |
| Cloudflare-Persistenz > 90 s | `HUMAN_REQUIRED` – Operator löst die Challenge manuell in Chrome |
| Kein Treffer / keine Versionen | `found: false` mit leeren Listen (kein Fehler) |
| Unknown Action-ID | `UNKNOWN_ACTION` – Skill zurück an `website-automation-builder` |
| UI-Drift / ambiguer Selektor | `UI_DRIFT` / `AMBIGUOUS_SELECTOR` – Skill zurück an Builder, nicht mit `.first()`/`.nth()`/force "reparieren" |
| Ungültiger Input | `INVALID_INPUT` – Parameter korrigieren und erneut versuchen |

## Verifikation

- Browserlos: `npm run typecheck`, `npm test`, `npm run cli -- list`,
  `npm run cli -- describe <id>`
- Live (verifiziert, Checkliste in `references/verification.md`):
  `cards.search` (esix, 10 Treffer), `cards.price` (esix, Top-Block +
  Seller), `cards.artworks` (esix, Versionen + `minQty`); Submit via
  `form.requestSubmit()`, `allowedNextActions` registriert

## Referenzen

- `references/actions.md` – Parameter, Output-Schema, Parameterdetails je Action
- `references/flows.md` – Standard- und Alternativ-Flows, Abbruchverhalten
- `references/selectors.md` – alle verifizierten Selektoren und Strategie-Hinweise
- `references/verification.md` – Verifikationsstatus und verifizierte Live-Checks
- `references/build-state.json` – maschinenlesbarer Build-Status
- `examples/` – Beispiel-Inputs für `run`