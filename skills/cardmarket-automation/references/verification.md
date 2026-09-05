# Verifikation – Cardmarket

> Status: `live_verified`. Der Skill ist implementiert, browserlos und live
> verifiziert. Live-Prüfungen (Session `cardmarket-automation`, angehängter
> Chrome-Browser) bestanden: `cards.search`, `cards.price`, `cards.artworks`
> (inkl. `minQty>0`).

## Erledigt (browserlos)

- [x] Scaffold via `scripts/scaffold.mjs` (Name, HTTPS-URL, Ziel-Verzeichnis)
- [x] `npm install` (esbuild postinstall-Warnung bekannt, esbuild 0.25.9 funktionsfähig)
- [x] `site.config.ts` ausgefüllt (configured, baseURL, allowedOrigins, Session, Budget)
- [x] `src/types.ts` (Daten- und Output-Typen)
- [x] `src/lib/parse.ts` + `tests/parse.test.ts` (parseQty/parsePrice)
- [x] `src/pages/SitePage.ts` (assertReady, gotoAllowed, waitForCloudflare)
- [x] `src/pages/SearchPage.ts`, `SearchResultsPage.ts`, `CardDetailPage.ts`, `CardVersionsPage.ts`
- [x] `src/actions/search|price|artworks.action.ts` + `src/actions/index.ts` (Registry-Array)
- [x] `npm run typecheck` – `tsc --noEmit`, keine Fehler
- [x] `npm test` – 30/30 pass
- [x] `npm run cli -- list` / `describe` (ohne Browser) – ok
- [x] `npm run cli -- run <action> --input <datei>` – Syntax verifiziert;
      `--input` ist ein Dateipfad, kein positionales JSON
- [x] Selektoren aus Live-Sitzungen übernommen (siehe `selectors.md`)

## Tooling-Befund (playwright-cli 0.1.19)

- `attach --extension=chrome --session=cardmarket-automation` verbindet den
  CLI mit dem Relay der Chrome-Extension. Der **Nutzer muss im Browser
  'Allow and select' freigeben**; ohne Freigabe (z. B. abwesend) haengt der
  CLI-Prozess. Fallback auf andere Browser ist ausgeschlossen.
- **`open` strikt verboten**: es startet einen verwalteten Headless-Browser
  (Temp-Profil, `--disable-extensions`), der von Cloudflare geblockt wird
  und nicht der nutzer-geoeffnete Browser ist.
- Der Skill-Adapter (`src/runtime/cli-browser.ts`) nutzt nur `attach` +
  `run-code` (esbuild-Bundle nach `.local/run-code/`), nie `open`.

## Erledigt (live, Session `cardmarket-automation`)

- [x] `cards.search` (esix): 10 Treffer, `allowedNextActions` =
      [cards.price, cards.artworks]; Submit via `form.requestSubmit()`
      (der sichtbare Button-Click wird vom Site-Autocomplete per
      `preventDefault` unterdrückt)
- [x] `cards.price` (esix): `found: true`, Top-Block vollständig
      (Rarity/Number/Printed in/Available/From/Price Trend/Averages),
      20 Seller-Zeilen (seller/location/condition/language/price/quantity)
- [x] `cards.artworks` (esix, `minQty: 0`): 3 Versionen, Heading vs. Tiles
      konsistent (`total: 3`, `shown: 3`)
- [x] `cards.artworks` (esix, `minQty: 1`): `maxSellerQuantity`,
      `sellersAtLeast`, `qualifies`; Rückkehr zur Versions-Liste über den
      sichtbaren „Show Versions"-Link zwischen Kachel-Clicks
- [x] `allowedNextActions` enthält nur registrierte IDs

## Known Gaps (Live-Verifizierung erforderlich)

- Seller-Sprache (`span[aria-label]`) ist plausibel, aber nicht 1:1 verifiziert
- `SHOW MORE RESULTS`-Button: Verhalten (AJAX vs. Reload) unklar; die Action
  liest bewusst nur bereits gerenderte Zeilen
- Versions-Count-Diskrepanz: Heading 842 / Button 841 / JSON 840 (Forest)
- Leer-Zustand der Suchergebnisse nie beobachtet (nur Treffer-Fall)
