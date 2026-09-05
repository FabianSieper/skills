# Cardmarket Skill – Registrierte Aktionen

Alle Aktionen sind **read-only**, öffentlich (kein Login) und starten auf dem
**Such-Einstieg** (Game-Seite `config.searchEntry` = `/en/Magic`; „Search 2.0"
2026-09 hat das Such-UI von der Startseite `/en` entfernt). Aufruf:
`npm run cli -- run <id> --input <datei>` – `<datei>` enthält die
Parameter als nacktes JSON-Objekt (siehe `examples/`). `npm run cli -- list` zeigt alle IDs.

| ID | Parameter | Output | Nächste |
|---|---|---|---|
| `cards.search` | `query` (str, 1–100, req), `limit` (int=20, 1–50) | `{ query, count, cards: [{ name, set, image, fromPrice, url }] }` | `cards.price`, `cards.artworks` |
| `cards.price` | `name` (str, 1–100, req), `sellers` (int=50, 0–500) | `{ found, card, url, info: { title, rarity, number, printedIn, reprints, availableItems, from, priceTrend, avg30d, avg7d, avg1d, image }, sellerCount, sellers: [{ seller, location, condition, language, price, quantity }] }` | `cards.artworks` |
| `cards.artworks` | `name` (str, 1–100, req), `minQty` (int=0, 0–1000), `limit` (int=40, 1–200) | `{ found, card, versionsUrl, total, shown, minQuantity, artworks: [{ card, set, version, available, fromPrice, image, url, maxSellerQuantity?, sellersAtLeast?, qualifies? }] }` | `cards.price` |

## Parameterdetails

### `cards.search`
`query` = Suchbegriff / Kartenname (z. B. „Forest"); `limit` = max. Result-Kacheln.

### `cards.price`
`name` = Kartenname; `sellers` = max. Seller-Angebote (0 = nur Top-Block).

### `cards.artworks`
`name` = Kartenname; `minQty` = Seller-Mengen-Check nur auslösen, wenn > 0; `limit` = max. Artwork-Listen-Einträge.

## Output-Hinweise
- `cards.price.info`: nur die verfügbaren Felder des Top-Blocks; leere Werte = `""`.
- `cards.artworks`: `maxSellerQuantity` / `sellersAtLeast` / `qualifies` sind optional und
  nur gesetzt, wenn `minQty > 0`.
