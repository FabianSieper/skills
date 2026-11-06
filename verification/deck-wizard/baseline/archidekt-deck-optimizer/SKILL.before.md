---
name: archidekt-deck-optimizer
description: >-
  Use when a deck lives on archidekt.com (a deck URL or numeric deck id) and needs an
  audit or an optimization plan: reading the deck reliably, checking the deck-size and
  copy gates, finding mana, ramp, answer, redundancy and synergy gaps, and producing an
  out/in swap list the owner can apply. Triggers: "optimize my Archidekt deck", "what is
  wrong with this deck", "legality-audit said PASS but the deck has 101 cards", a deck
  URL pasted into the conversation. Read-only: it never writes to archidekt.com. Do not
  use for building a deck from scratch (deck-wizard) or for clicking through the
  Archidekt UI (archidekt-navigation).
---

# Archidekt Deck Optimizer

**Core principle:** the deck is already built and already on Archidekt. The job is to read it as data, gate it, audit every card against its real oracle text, and hand back a swap plan — never to guess from the rendered page or from training data.

## Inputs and prerequisites

**Required from you:** the deck URL or numeric id, and the format if it is not Commander. Everything else is optional but changes the recommendation: what "better" means for this deck (bracket, budget, playgroup meta, life total variant), and which cards are load-bearing by intent rather than by math.

**Fetched by the skill itself:** the Archidekt deck payload (categories, quantities, printings, salt, prices, oracle text), Scryfall rulings for every card it reasons about, MTGJSON legalities for the format gate, EDHREC synergy and Commander Spellbook combos, and the Comprehensive Rules text for keyword definitions.

**Needs to be present in the environment:** `python3` (the ingest script uses only the standard library); `uv` and the deck-wizard install for the analysis CLIs; the MTGJSON bulk cache (`download-mtgjson`) — without it `legality-audit`, `price-check` and `rulings-lookup` fall back or fail; a downloaded Comprehensive Rules file (`download-rules`) if you want rule citations; and the Phase card-IR crosswalk sidecar for `deck-tune`, `deck-signals` and `cut-check`. When that sidecar is missing the tools do not error, they return zeros and empty lists — see [references/degraded-ir.md](references/degraded-ir.md).

**Only for the apply step:** a logged-in browser session and the `munim-computer-use` tools via `archidekt-navigation`. Reading is pure HTTP — no browser, no MCP, no login. Deck edits have no documented public endpoint: Archidekt's API is read-only, so applying a swap list means either the site's own Import/Quick-add UI or the browser route.

## Workflow

### 1. Ingest the deck as data, not as HTML

```bash
python3 scripts/fetch_archidekt_deck.py https://archidekt.com/decks/27970654 \
  --out <workdir>/deck.json --dump-oracle <workdir>/oracle.txt
```

One call returns the deck in deck-wizard shape, plus `<deck.json>.meta.json` containing every in-deck card's oracle text, mana cost, CMC, types, P/T, salt, price and category list (`cards`, sorted by mana value), and the derived numbers (size, curve, coloured pip demand, colour identity, land/creature counts, violations). `--dump-oracle` writes the same oracle text as plain text for grepping.

**Stop here if:**
- the API returns 404 or the deck is flagged `private`/`unlisted` → ask the owner for an exported list, or fall back to `webfetch` of the deck URL; do not reconstruct a deck from a partial read.
- the script reports `unclassified entries` → the category set is incomplete; resolve it before trusting any size number.

### 2. Gate the deck before analysing anything

Read the `GATES:` block. Archidekt's `Size` includes the commander, so a legal EDH deck reports 100 total, and a category flagged `includedInDeck: false` (`To Be Removed`, `Maybeboard`) parks cards that stay visible but do not count.

A deck that is one card over the limit is the first finding, not a footnote — every later recommendation has to keep the size at the limit.

### 3. Run the deck-wizard pipeline on the ingested deck

`deck-stats`, `legality-audit`, `mana-audit`, `combo-search`, `price-check` all take the deck JSON directly (absolute paths; `--bulk-data` for the MTGJSON cache).

**Conditional:** when deck-wizard reports degraded card IR (`crosswalk ... lanes degraded`, empty `swaps`, all-zero flags, `engine_pool 0`), its structural verdicts are unavailable, not negative. Switch to the fallback in [references/degraded-ir.md](references/degraded-ir.md) and compute the same numbers from the meta file.

### 4. Ground every judgement in oracle text

The meta file already carries oracle text for all in-deck cards — use it as the primary source. Before claiming an interaction, confirm it with rulings:

```bash
uv run rulings-lookup --card "Training Grounds" --card "Necrotic Ooze" --bulk-data <mtgjson-path>
uv run scryfall-lookup "Drown in the Loch"
```

Anything about a candidate replacement card must be looked up, never assumed.

### 5. Map interactions before cutting

A card's value is situational in a combo-adjacent deck. Build the graph as nodes plus typed edges (`synergy`, `anti`, `neutral`) with a one-line `why` per edge, then rank by net degree. The cards to look at first are the ones whose edges contradict the engine — a card that only helps when the engine is off is a cost, not a bonus.

### 6. Propose swaps as pairs, verified

Each proposal is one row: `out → in`, **exactly one sentence** justifying the pair, format legality, price. That sentence must say why the incoming card is better than the outgoing one *in this deck*, naming the oracle text on both sides — what the cut was doing for the engine, what the add does for it. A row whose sentence only describes the new card ("X is a great tutor") is not a justification: the comparison is the deliverable. No bullet lists, no multiple reasons per row.

Never output a swap list that changes the deck size. Run `legality-audit` on the resulting deck and re-run `mana-audit`/`deck-stats` to confirm land count and curve did not regress.

Worked pair:

```
Good: Dress Down → Mirror-Mad Phantasm — Dress Down's "Creatures lose all abilities"
      switches off Ooze, Lazav, Mikaeus and Ballista, while Phantasm's {1}{U} shuffle
      turns the self-mill the deck already runs into a Laboratory Maniac win.
Bad:  "Mirror-Mad Phantasm is a strong combo piece and Dress Down is situational."
```

### 7. Deliver

A gap table (gap → evidence → consequence), a swap table, and the smallest set of changes that fixes the most gaps. The plan is the deliverable; applying it in the Archidekt UI is a separate task (see `archidekt-navigation`).

## Quick reference

| Need | Tool | Notes |
|---|---|---|
| Deck inventory + curve + pips | `scripts/fetch_archidekt_deck.py` | Read-only; writes `deck.json` + `deck.json.meta.json` |
| Format legality, colour identity, singleton | `uv run legality-audit <deck.json>` | Does **not** check deck size |
| Land band and colour balance | `uv run mana-audit <deck.json>` | Land count only; verify colour sources by hand |
| Combos already present / one card away | `uv run combo-search <deck.json>` | Commander Spellbook |
| Oracle text and rulings | `rulings-lookup`, `scryfall-lookup` | Required for every claim |
| Budget | `uv run price-check <deck.json> --format commander` | |

## Common mistakes

- **Reading the deck off the rendered page.** The API (`/api/decks/<id>/`, trailing slash required) is exact; the page is not, and `/api/decks/<id>` without the slash 404s.
- **Treating `legality-audit: PASS` as "the deck is legal."** It checks format legality, colour identity and copy limits only — a 101-card deck passes.
- **Counting a split card by its front face.** Archidekt's top-level `types` is the front face only and `manaCost` is empty for split cards; `Malakir Rebirth // Malakir Mire` is a land half and a castable instant half.
- **Counting parked cards.** Cards in a category with `includedInDeck: false` are parked, not in the deck — but they still show up in a naive list.
- **Treating degraded tool output as a finding.** An empty `swaps` list means the tool had no data, not that the deck has no problems.
- **Cutting a card that is load-bearing on one axis only.** Wall of Blood is a terrible copy target and an excellent pump; decide which axis the deck actually needs.

## Related skills

| Skill | Where it plugs in |
|---|---|
| `deck-wizard` | Steps 3–6. It owns the tuning pipeline (`deck-stats`, `legality-audit`, `mana-audit`, `combo-search`, `price-check`, `rulings-lookup`, `scryfall-lookup`) and the Iron Rule that every card claim must come from oracle text, not training data. Its Step 8 self-grill is the check on the swap list. |
| `archidekt-navigation` | Only after the plan is accepted: the verified UI mechanics for reading the deck page header, filtering the grid, moving cards between categories, and undoing a wrong move. Hand it the out/in list; it does the clicking. |
| `grilling` | Optional, when the owner wants the plan stress-tested before committing: challenger pass on each "cut X, add Y" claim. |

## Boundaries

- Read-only. This skill produces an audit and a plan; it does not edit decks on Archidekt, place orders, or touch a browser.
- It does not build decks from scratch, recommend commanders, or run Sealed/Draft — that is `deck-wizard`.
- It does not do UI mechanics (filtering, moving cards between categories, undo) — that is `archidekt-navigation`.

## References

- [references/archidekt-api.md](references/archidekt-api.md) — the verified endpoint, category semantics and split-card behaviour. Read it when the ingest output disagrees with the deck page, when a deck has split cards, or when the API call fails.
- [references/degraded-ir.md](references/degraded-ir.md) — how to compute the structural numbers by hand. Read it only when deck-wizard reports degraded card IR.
