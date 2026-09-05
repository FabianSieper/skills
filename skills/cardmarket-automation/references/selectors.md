# Selektoren – Cardmarket

> Verifiziert in Live-Sitzungen (Juli 2026, `playwright-cli attach
> --extension=chrome`). Status: `live_verified` – Re-Verifikation mit
> angehängtem Browser (Session `cardmarket-automation`) bestanden. Alle
> Selektoren sind stabil (IDs/semantische Klassen), keine generierten
> CSS-Ketten, keine XPath.

## Suchformular (Topbar, überall präsent)

| Element | Selektor |
|---|---|
| Form | `form#searchForm` |
| Input | `input#ProductSearchInput` (name `searchString`) |
| Submit | `button#search-btn` |

Submit → `GET /en/Magic/Products/Search?category=-1&searchString=<q>&searchMode=v2`

## Suchergebnisse

| Element | Selektor |
|---|---|
| Kachel (Link) | `a.galleryBox` |
| Titel | `.card-title` |
| Set-Symbol | `.card-title .expansion-symbol[aria-label]` |
| Bild | `img` (alt = Kartenname) |
| Preis | Text-Match `From [^\n]+` |

~30 Kacheln pro Seite; die Kachel-`href` ist die Detail-URL
(`/en/Magic/Products/Singles/<Set>/<Card>`).

## Detailseite

| Element | Selektor |
|---|---|
| Titel | `main h1` (exakt ein Treffer, via Guard) |
| Hauptbild | 2. `<img>` in `<main>` (1. = Chart-Thumb) – per `evaluate` |
| Top-Block | `main [class*="labeled"]` mit `dt`/`dd`-Paaren (Block mit `Rarity`) |
| Seller-Zeile | `main .article-row` |
| Seller | `.seller-info .seller-name a[href]` |
| Ort | `[aria-label^="Item location"]` (Präfix `Item location: ` entfernt) |
| Condition | `.article-condition` (Vollname in `data-bs-original-title`) |
| Sprache | `.product-attributes span[aria-label]` |
| Preis | `.col-offer span.color-primary` |
| Menge | `.item-count` |
| Mehr laden | `main button:has-text("SHOW MORE RESULTS")` (Verhalten unvollständig verifiziert – die Action liest nur die bereits gerenderten Zeilen) |
| Versions-Link | `a:has-text("Show Versions")` (Count-Guard: 0 → null, >1 → `AMBIGUOUS_SELECTOR`) |

Top-Block-Labels (dt): `Rarity`, `Number`, `Printed in`, `Reprints`,
`Available items`, `From`, `Price Trend`, `30-days average price`,
`7-days average price`, `1-day average price`.

## Versions-/Artwork-Seite

| Element | Selektor |
|---|---|
| Kachel (Link) | `a.card[href*="/Products/Singles/"]` |
| Bild | `img.is-front` (alt = Kartenname) |
| Set | `h3 span.expansion-symbol[aria-label]` (Fallback: `h3 span.text-start`) |
| Meta-Zeilen | `p` (kann leer sein): `Version N`, `N Available`, `From X €` |
| Heading | `h1` mit `N versions` (exakt ein Treffer, via Guard) |

Beispiel-URLs:
- Detail: `https://www.cardmarket.com/en/Magic/Products/Singles/Magic-The-Gathering-Marvel-Super-Heroes/Forest-V3`
- Versions: `https://www.cardmarket.com/en/Magic/Cards/Forest/Versions`

## Strategie-Hinweise

- Wiederholte Kacheln/Zeilen: explizite `nth(i)`-Enumeration (Einzeltreffer
  nie mit `.first()`/`.nth()` "reparieren").
- Sub-Elemente aus Kacheln/Zeilen: `element.evaluate(...)` – vermeidet
  Strict-Mode- und `.first()`-Probleme und ist robust gegen fehlende
  optionale Sub-Elemente.
- Einzelne, nicht-wiederholte Ziele (h1, Versions-Link): Guard
  `uniqueVisible` / Count-Check mit `UI_DRIFT` bzw. `AMBIGUOUS_SELECTOR`.
- Cloudflare: `SitePage.waitForCloudflare()` – persistiert >90 s →
  `HUMAN_REQUIRED`; alle Navigationsmethoden rufen sie auf.