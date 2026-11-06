# Import lists and collections

Read for pasted/exported lists and Arena collections. Paper Commander then
continues with acquisition.md; other formats follow format-tuning.md.

## Phase 1, Path A: Parse + Hydrate Existing Deck

### Parse Deck List

```
parse-deck <path> --format <format> --output <working-dir>/deck.json
```

- Auto-detects input format (Moxfield, MTGO, Arena, plain text, CSV)
- Routes sideboard cards to the `sideboard` field (separate from `cards`)
- Strips Moxfield set code suffixes and merges duplicate card names automatically
- Reports: `parse-deck: N cards, M sideboard -> /path/to/deck.json`

**Always pass `--format <format>` explicitly.** Without it, `parse-deck` defaults to `commander` and every downstream tool (legality-audit, price-check) sees the wrong format.

Supported formats: `commander` (100 cards), `brawl` (60 cards, Standard card pool), `historic_brawl` (100 cards, Historic/Arena card pool), `standard`, `alchemy`, `historic`, `pioneer`, `timeless`, `modern`, `legacy`, `vintage` (all 60 cards with 15-card sideboard), `sealed` / `draft` (40-card minimum from an opened pool — Path C). Use `--deck-size` to override the default deck size.

If the format is not obvious from context, ask the user.

#### Commander Formats

If `commanders` is empty (common with Moxfield exports that lack `//Commander` headers), ask the user who the commander is. Don't guess — the first card in the list is often the commander, but not always. Supports partner commanders, friends forever, and background pairings.

Run `set-commander <deck.json> 'Commander Name'` to move the card from the cards list to the commanders list. **`set-commander` is idempotent** — calling it on a card already in the `commanders` zone is a silent no-op, so it's safe to chain after `parse-deck` even when the deck file already had a Moxfield `Commander` header.

#### Collection Ownership (Arena)

If the user has an Arena collection:
1. Ask for Untapped.gg CSV export first (most reliable source)
2. `mark-owned <deck.json> <collection.csv> --bulk-data <path>` to populate `owned_cards` (accepts both CSV and parsed-deck JSON)
3. Use `mtga-import` only for extracting wildcard counts, not collection data
4. Count what the collection covers by the ownership rule (Tooling Notes): four owned copies cover any quantity, basic lands are owned unless a paper deck asks for a special printing

Always pass `--bulk-data` for Arena collections (see Tooling Notes > Populating `owned_cards` for details on aliasing).

### Hydrate Card Data

```
deck-hydrate <working-dir>/deck.json [--bulk-data <path>]
```

Returns an envelope with `sidecar_path`, `card_count`, `missing`, `digest`. This builds `deck.hydrated.json` beside the deck JSON — every mainboard + sideboard + commander + companion card joined against the card data, keyed inside the file by the deck's content, the bulk's identity, and the payload version. **Check `missing`** — names the card data couldn't resolve are warned once on stderr and excluded from counts.

**Do NOT Read the sidecar directly** — it's large and floods context. Use `card-summary` or `scryfall-lookup "<Name>"` for targeted reads; `Grep '<regex>' <working-dir>/deck.hydrated.json` is fine for oracle-text pattern scans.

**There is no cache path to track.** Every deck CLI takes only `<deck.json>` (plus optional `--bulk-data`) and hydrates itself through this same sidecar. Edit the deck and re-run any tool — it just works. `deck-hydrate` itself is just the explicit warm/verification step right after acquisition, so you see `missing` before running analyses.

After hydration, proceed to **Phase 2: Tuning**.

---
