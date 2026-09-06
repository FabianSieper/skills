# Actions Reference

All actions are **read-only**.

| ID | Keywords | Parameters | Output |
|---|---|---|---|
| `cards.search` | search, find, look up | `query` (str, req), `limit` (int=20) | `{ query, count, cards: [{ name, set, image, fromPrice, url }] }` |
| `cards.price` | price, sellers, availability, stock, cost | `name` (str, req), `sellers` (int=50), `condition`, `language`, `location`, `sellerType`, `foil`, `signed`, `altered` | `{ found, card, url, filter, info, sellerCount, sellers: [{ seller, location, condition, language, price, quantity }] }` |
| `cards.artworks` | versions, artworks, reprints, variants | `name` (str, req), `minQty` (int=0), `limit` (int=40) | `{ found, card, versionsUrl, total, shown, minQuantity, artworks: [{ card, set, version, available, fromPrice, image, url, maxSellerQuantity?, sellersAtLeast?, qualifies? }] }` |

## Parameters

### `cards.search`
- `query`: Card name or search string.
- `limit`: Max result tiles (1-50).

### `cards.price`
- `name`: Card name.
- `sellers`: Max seller rows (0 = top block only).
- `condition`: `mint|near-mint|excellent|good|light-played|played|poor|any` (Default: `excellent`).
- `language`: `english|french|german|spanish|italian|s-chinese|japanese|portuguese|russian|t-chinese|any` (Default: `english`).
- `location`: Canonical key or alias (e.g., `germany`, `de`, `uk`, `any`). (Default: `germany`).
- `sellerType`: `private|professional|powerseller|any` (Default: `any`).
- `foil`, `signed`, `altered`: `any|yes|no` (Default: `any`).

### `cards.artworks`
- `name`: Card name.
- `minQty`: Seller quantity check threshold (0 = skip).
- `limit`: Max artwork entries (1-200).

## Output Details
- `cards.price.filter`: Resolved canonical values applied before reading.
- `cards.price.info`: Top block fields (rarity, number, printedIn, reprints, availableItems, from, priceTrend, avg30d, avg7d, avg1d, image).
- `cards.artworks`: `maxSellerQuantity`, `sellersAtLeast`, `qualifies` only present if `minQty > 0`.
