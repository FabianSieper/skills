# Archidekt deck API — verified field map

Read this when the ingest script's output looks wrong, when a deck has split cards or
unusual categories, or when the API call fails. All facts below were observed live on
2026-11-01 against deck 27970654.

## Endpoints

```
GET https://archidekt.com/api/decks/<id>/       # full deck: header, categories, card entries
GET https://archidekt.com/api/decks/<id>/cards/ # card entries only, ~260 KB vs ~1.4 MB
```

- The trailing slash on the deck route is required. `https://archidekt.com/api/decks/27970654` returns 404.
- `/api/decks/<id>/cards/` returns the same per-printing card entries but **no** `categories` array and no deck header. Since parked detection depends on `includedInDeck`, it is only usable together with the deck route.
- `Unknown API route` for other paths (`/api/decks/<id>/export/`, `/categories/`, `/settings/`, `/list/`).
- The API is read-only. Archidekt's own statement is that the API is open "as far as reading is concerned"; deck edits go through the authenticated client routes used by the web app, not a documented public endpoint.
- Public decks answer without auth. A deck with `"private": true` or `"unlisted": true`
  should not be trusted as complete; ask for an export.

## Top level

| Key | Meaning |
|---|---|
| `id`, `name`, `updatedAt` | deck identity and last edit — compare with the page header to confirm you read the current version |
| `deckFormat` | numeric format code; `3` was seen for a Commander deck. Do not infer other codes — pass the format explicitly |
| `categories` | `[{id, name, isPremier, includedInDeck, includedInPrice}]` |
| `cards` | one entry **per printing**, not per card |
| `customCards` | custom cards, empty for normal decks |

## Card entry

```
{id, categories: [names], companion, flippedDefault, label, modifier, quantity,
 customCmc, removedCategories, createdAt, updatedAt, deletedAt, notes,
 card: { oracleCard: {...}, prices: {...}, rarity, games: [...] }}
```

Membership rules the script applies:

- A card is in the deck iff **every** category it carries has `includedInDeck: true`.
  `To Be Removed` and `Maybeboard` are `false`; a card can sit in both a real category
  and a parked one (`Temple of Deceit` → `["To Be Removed", "Land"]`) and is then parked.
- `deletedAt: null` is normal; a non-null value means the entry is gone — do not count it.
- In the audited deck the `Sideboard` category had `includedInDeck: true`, so its cards
  counted toward `Size`. Check the flag per deck instead of assuming sideboard is excluded.
- The same oracle card can appear as several entries (different printings, different
  categories). Aggregate by `oracleCard.name` and sum `quantity`, otherwise the size and
  the copy-limit gate are wrong.

## oracleCard

| Field | Notes |
|---|---|
| `name`, `text` | oracle name and rules text |
| `manaCost` | empty string for split cards; the real cost is on `faces[].manaCost` |
| `cmc` | mana value of the card as cast |
| `types` | **front face only** for split cards |
| `faces` | `[{name, types, manaCost, text, power, toughness, ...}]` |
| `colorIdentity` | full colour words (`"Blue"`, `"Black"`), not symbols |
| `power`, `toughness` | strings; `*` for variable power/toughness |
| `salt` | per-card salt, used by Archidekt's `Salt sum` |
| `legalities` | keyed by format (`commander`, `modern`, …) |
| `defaultCategory`, `gameChanger`, `tutor`, `potentialCombos` | Archidekt's own tagging — useful as a hint, never as the answer |

`card.prices.cm` is the Cardmarket EUR price; the page's `Est cost` uses a different source mix, so expect a small difference.

## Fallback when the API is unavailable

`webfetch https://archidekt.com/decks/<id>` returns the rendered deck as markdown with
category headings, `Qty: N`, printings and prices. It is good enough for an inventory,
not for gating: confirm `Size`, `Est cost` and `Salt sum` from the page header and count
the quantities yourself.
