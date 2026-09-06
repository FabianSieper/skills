# Actions Reference

All actions are **read-only**.

## Command Table

| ID | State | Parameters | Output |
|---|---|---|---|
| `nav.search` | any → `results` | `query` (str, req) | `{ status, state }` |
| `nav.open` | `results` → `detail` | `index` (int, req) | `{ status, state }` |
| `nav.versions` | `detail` → `versions` | – | `{ status, state }` |
| `nav.artwork` | `versions` → `detail` | `index` (int, req) | `{ status, state }` |
| `nav.filter` | `detail` → `detail` | filter fields (all optional) | `{ status, state }` |
| `info` | auto-detect | `limit`, `sellers`, `minQty` | state-specific payload |

## Nav Status

`status` values:

- `ok` – transition succeeded
- `not_found` – requested `index` is out of range
- `not_available` – expected page affordance is missing
- `wrong_state` – command precondition is not met

`state` values: `start`, `results`, `detail`, `versions`.

## Parameters

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

## `info` Output Shapes

### `start`
```json
{ "state": "start", "ready": true }
```

### `results`
```json
{
  "state": "results",
  "query": "Forest",
  "count": 2,
  "cards": [
    { "name": "Forest", "set": "Marvel", "image": "https://...", "fromPrice": "From 0,02 €", "url": "https://..." }
  ]
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
  ]
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
  ]
}
```

When `minQty > 0`, each artwork additionally contains:
- `maxSellerQuantity`
- `sellersAtLeast`
- `qualifies`

## Examples

- `examples/input.json` – `nav.search`
- `examples/input-index.json` – `nav.open` / `nav.artwork`
- `examples/input-filter.json` – `nav.filter`
- `examples/input-price.json` – `info` sellers
- `examples/input-versions.json` – `info` `minQty`
- `examples/input-artworks.json` – `info` versions
- `examples/input-empty.json` – no parameters

## Static Next Hints

- `nav.search.next`: `['info', 'nav.open']`
- `nav.open.next`: `['info', 'nav.versions', 'nav.filter']`
- `nav.versions.next`: `['info', 'nav.artwork']`
- `nav.artwork.next`: `['info', 'nav.versions', 'nav.filter']`
- `nav.filter.next`: `['info']`
- `info.next`: `['nav.search', 'nav.open', 'nav.versions', 'nav.artwork', 'nav.filter']`
