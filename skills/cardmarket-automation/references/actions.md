# Actions Reference

Actions are read-only except `user.offer.update`, which is a guarded write action requiring `plan` and `execute` approval.

## Command Table

| ID | Kind | State | Parameters | Output |
|---|---|---|---|---|
| `nav.home` | read | any → `start` | – | `{ status, state }` |
| `nav.search` | read | any → `results` | `query` (str, req) | `{ status, state }` |
| `nav.open` | read | `results` → `detail` | `index` (int, req) | `{ status, state }` |
| `nav.versions` | read | `detail` → `versions` | – | `{ status, state }` |
| `nav.artwork` | read | `versions` → `detail` | `index` (int, req) | `{ status, state }` |
| `nav.filter` | read | `detail` → `detail` | filter fields (all optional) | `{ status, state }` |
| `info` | read | auto-detect | `limit`, `sellers`, `minQty` | state-specific payload |
| `user.offers` | read | `detail` | `limit` | own-offer payload |
| `user.offer.update` | write | `detail` | `articleId` + changes | update payload |

## Nav Status

`status` values:

- `ok` – transition succeeded
- `not_found` – requested `index` is out of range
- `not_available` – expected page affordance is missing
- `wrong_state` – command precondition is not met

`state` values: `start`, `results`, `detail`, `versions`.

## Parameters

### `nav.home`
- No parameters.
- Navigates to `https://www.cardmarket.com/en`.

### `nav.search`
- `query`: card name or search string. Required, 1–100 chars.

### `nav.open`
- `index`: result tile position. Required, 0–100.

### `nav.versions`
- No parameters.

### `nav.artwork`
- `index`: artwork/version tile position. Required, 0–1000.

### `nav.filter`
All fields are optional and default to the current canonical filter:

| field | default | values |
|---|---|---|
| `condition` | `excellent` | `mint`, `near-mint`, `excellent`, `good`, `light-played`, `played`, `poor`, `any` |
| `language` | `english` | `english`, `french`, `german`, `spanish`, `italian`, `s-chinese`, `japanese`, `portuguese`, `russian`, `t-chinese`, `any` |
| `location` | `germany` | canonical key or alias, e.g. `germany`, `de`, `uk`, `any` |
| `sellerType` | `any` | `private`, `professional`, `powerseller`, `any` |
| `foil` | `any` | `any`, `yes`, `no` |
| `signed` | `any` | `any`, `yes`, `no` |
| `altered` | `any` | `any`, `yes`, `no` |

`nav.filter` submits the filter form and settles the seller list before returning.

### `info`
| field | default | range |
|---|---:|---:|
| `limit` | 30 | 1–150 |
| `sellers` | 50 | 0–500 |
| `minQty` | 0 | 0–1000 |

### `user.offers`
| field | default | range |
|---|---:|---:|
| `limit` | 20 | 0–100 |

Only own `stockRow` entries are returned. The action is empty outside `detail`.

### `user.offer.update`
| field | required | type / values |
|---|---|---|
| `articleId` | yes | integer from `user.offers` |
| `price` | no | number, 0.01–1,000,000 EUR |
| `quantity` | no | integer, 1–1,000,000; must exist as an option in the edit modal |
| `condition` | no | `mint`, `near-mint`, `excellent`, `good`, `light-played`, `played`, `poor` |
| `language` | no | `english`, `french`, `german`, `spanish`, `italian`, `s-chinese`, `japanese`, `portuguese`, `russian`, `t-chinese` |
| `foil` | no | boolean |
| `signed` | no | boolean |
| `altered` | no | boolean |
| `comments` | no | string, 0–100 chars |

At least one change field is required; `prepare` fails with `INVALID_INPUT` when only `articleId` is supplied. Image upload is not part of the action.

## `info` Output Shapes

### `start`
```json
{ "state": "start", "ready": true, "auth": { "loggedIn": false } }
```

### `results`
```json
{
  "state": "results",
  "query": "Forest",
  "count": 2,
  "cards": [
    { "name": "Forest", "set": "Marvel", "image": "https://...", "fromPrice": "From 0,02 €", "url": "https://..." }
  ],
  "auth": { "loggedIn": false }
}
```

### `detail`
```json
{
  "state": "detail",
  "card": "Forest",
  "url": "https://...",
  "filter": {
    "condition": "excellent",
    "language": "english",
    "location": "germany",
    "sellerType": "any",
    "foil": "any",
    "signed": "any",
    "altered": "any"
  },
  "info": {
    "title": "Forest",
    "rarity": "Common",
    "number": "332",
    "printedIn": "1",
    "reprints": "2",
    "availableItems": "100",
    "from": "0,02 €",
    "priceTrend": "stable",
    "avg30d": "1,00 €",
    "avg7d": "1,00 €",
    "avg1d": "1,00 €",
    "image": "https://...",
    "url": "https://..."
  },
  "sellerCount": 1,
  "sellers": [
    { "seller": "S1", "location": "DE", "condition": "Near Mint", "language": "German", "price": "1,23 €", "quantity": "15" }
  ],
  "auth": { "loggedIn": false }
}
```

### `versions`
```json
{
  "state": "versions",
  "card": "Forest",
  "versionsUrl": "https://...",
  "total": 842,
  "shown": 1,
  "minQuantity": 0,
  "artworks": [
    { "card": "Forest", "set": "Marvel", "version": "Version 1", "available": "10 Available", "fromPrice": "From 1,00 €", "image": "https://...", "url": "https://..." }
  ],
  "auth": { "loggedIn": false }
}
```

When `minQty > 0`, each artwork additionally contains:
- `maxSellerQuantity`
- `sellersAtLeast`
- `qualifies`

### `user.offers`
```json
{
  "state": "detail",
  "card": "Esix, Fractal Bloom",
  "set": "Commander: Murders at Karlov Manor",
  "url": "https://...",
  "found": true,
  "count": 1,
  "offers": [
    {
      "articleId": 2108603357,
      "seller": "Hayrus",
      "card": "Esix, Fractal Bloom",
      "set": "Commander: Murders at Karlov Manor",
      "condition": "Excellent",
      "language": "English",
      "price": "0,25 €",
      "quantity": 1
    }
  ],
  "auth": { "loggedIn": true }
}
```

### `user.offer.update`
```json
{
  "state": "detail",
  "articleId": 2108603357,
  "card": "Esix, Fractal Bloom",
  "set": "Commander: Murders at Karlov Manor",
  "url": "https://...",
  "offer": {
    "articleId": 2108603357,
    "seller": "Hayrus",
    "card": "Esix, Fractal Bloom",
    "set": "Commander: Murders at Karlov Manor",
    "condition": "Excellent",
    "language": "English",
    "price": "0,26 €",
    "quantity": 1
  },
  "changes": { "price": 0.26 },
  "verified": true,
  "auth": { "loggedIn": true }
}
```

## Write Safety

`user.offer.update` uses the engine write contract:
- `plan` opens and reads the edit modal, then closes it without saving.
- The plan binds account, URL, card, article ID, current form values, requested changes, input, implementation, and TTL.
- `execute` re-prepares the same target and blocks on account or form drift.
- A used plan cannot be replayed.
- A lost response after submit becomes `UNKNOWN_COMMIT`; verify with `user.offers` instead of retrying.

## Examples

- `examples/input.json` – `nav.search`
- `examples/input-index.json` – `nav.open` / `nav.artwork`
- `examples/input-filter.json` – `nav.filter`
- `examples/input-price.json` – `info` sellers
- `examples/input-versions.json` – `info` `minQty`
- `examples/input-artworks.json` – `info` versions
- `examples/input-user-offers.json` – `user.offers`
- `examples/input-user-offer-update.json` – `user.offer.update` schema example
- `examples/input-empty.json` – no parameters, valid for `nav.home`, `nav.versions`, `info`, and `user.offers`
- Every CLI `run`/`plan` requires `--input <file.json>`; use `examples/input-empty.json` (`{}`) when no parameters are needed.

## Static Next Hints

- `nav.home.next`: `['info', 'nav.search']`
- `nav.search.next`: `['info', 'nav.open']`
- `nav.open.next`: `['info', 'nav.versions', 'nav.filter', 'user.offers']`
- `nav.versions.next`: `['info', 'nav.artwork']`
- `nav.artwork.next`: `['info', 'nav.versions', 'nav.filter', 'user.offers']`
- `nav.filter.next`: `['info', 'user.offers']`
- `info.next`: `['nav.home', 'nav.search', 'nav.open', 'nav.versions', 'nav.artwork', 'nav.filter', 'user.offers']`
- `user.offers.next`: `['info', 'user.offer.update']`
- `user.offer.update.next`: `['info', 'user.offers']`
