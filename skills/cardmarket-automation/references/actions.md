# Actions – Cardmarket

> Status: `live_verified` – die Action-Definitionen, Validatoren und POMs
> sind vollständig implementiert und live gegen die echte Website
> validiert. Keine Action ohne Bestätigung in einen Plan aufnehmen.

## Registered Action-IDs

| ID | Parameters | Output | Next |
|---|---|---|---|
| `cards.search` | `query` (string, required, 1..100), `limit` (int, default 20, 1..50) | `{ query, count, cards: [{ name, set, image, fromPrice, url }] }` | `cards.price`, `cards.artworks` |
| `cards.price` | `name` (string, required, 1..100), `sellers` (int, default 50, 0..500) | `{ found, card, url, info: { title, rarity, number, printedIn, reprints, availableItems, from, priceTrend, avg30d, avg7d, avg1d, image }, sellerCount, sellers: [{ seller, location, condition, language, price, quantity }] }` | `cards.artworks` |
| `cards.artworks` | `name` (string, required, 1..100), `minQty` (int, default 0, 0..1000), `limit` (int, default 40, 1..200) | `{ found, card, versionsUrl, total, shown, minQuantity, artworks: [{ card, set, version, available, fromPrice, image, url, maxSellerQuantity?, sellersAtLeast?, qualifies? }] }` | `cards.price` |

Alle drei sind read-only (`kind: read`), benötigen kein Login
(`accountKey: "public"`) und nutzen nur die public Cardmarket-Endpunkte.

## Parameterdetails

### `cards.search`
- `query` – Suchbegriff (z. B. Kartenname wie `Forest` oder `Mox Pearl`).
- `limit` – Anzahl der Result-Kacheln, maximal 50 (eine Seite zeigt ~30).
- Ergebnis-`name` wird von `cards.price` als Suchbegriff verwendet (die Action
  sucht die Karte und öffnet die erste Result-Kachel).

### `cards.price`
- `name` – Kartenname; die Action startet auf der Startseite, sucht über die
  Such-UI und öffnet die erste Result-Kachel (kein Deep-Link, kein Direct-Goto).
- `sellers` – Anzahl der Seller-Zeilen (0 = nur Top-Block). Maximal 500,
  ohne "SHOW MORE RESULTS"-Klick sind ~50 Zeilen gerendert.
- `info` enthält den strukturierten Top-Block (Rarity, Number, Printed in,
  Reprints, Available items, From, Price Trend, 30-/7-/1-Tage-Durchschnitte)
  plus Hauptbild (`image`, 2. `<img>` in `<main>`).

### `cards.artworks`
- `name` – Kartenname, wird zuerst über `cards.search` aufgerufen.
- `minQty` – ab 1 öffnet die Action die Detailseiten der ersten `limit`
  Artworks und berechnet `maxSellerQuantity`, `sellersAtLeast`, `qualifies`
  (pro Artwork, aus den Seller-Zeilen).
- `limit` – Anzahl der gelisteten Artworks (die Versions-Seite rendert die
  volle Liste, Standard ~800+ für populäre Karten).
- `total` stammt aus der Seiten-Heading (`N versions`); beobachtete kleine
  Diskrepanz zwischen Heading, Button und JSON (842/841/840) – `total` ist
  Indiz, `shown`/`artworks.length` ist die echte Datenmenge.