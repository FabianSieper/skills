# Cardmarket Skill – Selektoren & Strategie

> **Status:** Selektoren aus Scaffold-Phase + **live verifiziert**
> (`references/verification.md`). Quelle: `src/pages/*.ts`.
> Bei `UI_DRIFT`/`AMBIGUOUS_SELECTOR`: nie `.first()`/`.nth()`/force, an Builder.

## Strategie
- Alles beginnt auf der Startseite; die Startseite enthält kein Such-UI → `goto`
  (Basis-URL) und dann sichtbare Elemente nutzen.
- **Suche via `form.requestSubmit()`** – den sichtbaren Button direkt zu klicken,
  wird von Autocomplete-JavaScript interceptiert (bekannte playwright-cli-
  Beschränkung); `requestSubmit()` umgeht das zuverlässig.
- **Deep-Links / Direct-Goto zu Detail- oder Versions-URLs sind verboten**:
  Detail- und Versionsseiten werden nur über sichtbare UI-Elemente erreicht
  (Ergebnis-Kachel bzw. „Show Versions").
- Preise im deutschen Zahlenformat („0,25 €") – im Output so belassen.

## Suchform (Startseite)
| Element | Selektor |
|---|---|
| Form | `form#searchForm` |
| Suchfeld | `input#ProductSearchInput` |
| Button | `button#search-btn` |
| Submit | `form.requestSubmit()` (Button-Click wird interceptiert) |
| Ergebnis-URL | `/en/Magic/Products/Search?category=-1&searchString=<q>&searchMode=v2` |

## Suchergebnisse
| Element | Selektor |
|---|---|
| Kachel (Link) | `a.galleryBox` |
| Titel | `.card-title` |
| Set-Symbol | `.card-title .expansion-symbol[aria-label]` |
| Bild | `img` (alt = Kartenname) |
| Preis | Text-Match `From [^\n]+` (case-insensitiv) |

## Detailseite (Karte)
| Element | Selektor |
|---|---|
| Titel | `main h1` |
| Hauptbild | 2. `<img>` in `<main>` |
| Top-Block | `main [class*="labeled"]` |
| Seller-Zeile | `main .article-row` |
| Seller | `.seller-info .seller-name a[href]` |
| Ort | `[aria-label^="Item location"]` |
| Condition | `.article-condition` (Vollname in `data-bs-original-title`) |
| Sprache | `.product-attributes span[aria-label]` |
| Preis | `.col-offer span.color-primary` |
| Menge | `.item-count` |
| Mehr laden | `main button:has-text("SHOW MORE RESULTS")` – Verhalten unvollständig verifiziert (die Action liest nur die bereits gerenderten Zeilen) |
| Versions-Link | `a:has-text("Show Versions")` |

Top-Block-Labels: `Rarity`, `Number`, `Printed in`, `Reprints`, `Available items`,
`From`, `Price Trend`, `30-days average price`, `7-days average price`, `1-day average price`

## Versions-/Artwork-Seite
| Element | Selektor |
|---|---|
| Kachel (Link) | `a.card[href*="/Products/Singles/"]` |
| Bild | `img` (erster in Kachel – Vorderseite) |
| Set | `h3 span.expansion-symbol` (aria-label; Fallback `h3 span.text-start`) |
| Meta-Zeilen (`p`, kann leer sein) | `Version N`, `N Available`, `From X €` |
| Heading | `h1` mit `N versions` |
