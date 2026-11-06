# Existing toolkit and format details

Read for setup, CLI selection, Arena ownership/wildcards, alternative formats or
lookup problems. Commands below belong to the imported toolkit; inspect --help
for the installed version. Treat dated format notes as observations to refresh
from official sources before relying on them. Store task data under the working
directory, not /tmp or the installed skill. A successful process exit is not a
passing audit: inspect the result JSON.

## Supported Formats

| Format | Deck Size | Copy Limit | Sideboard | Platform | Legality Key | Notes |
|--------|-----------|------------|-----------|----------|-------------|-------|
| commander | 100 | 1 (singleton) | No | Paper + MTGO | commander | 40 life, multiplayer |
| brawl | 60 | 1 (singleton) | No | Arena | standardbrawl | 25/30 life, Standard pool |
| historic_brawl | 100 | 1 (singleton) | No | Arena (+ paper) | brawl | 25/30 life, all Arena sets |
| competitive_brawl | 100 | 1 (singleton) | No | Arena only | competitivebrawl | 25 life, 1v1, **no free mulligan** |
| standard | 60 | 4 | 15 | Arena + Paper | standard | Rotating |
| alchemy | 60 | 4 | 15 | Arena only | alchemy | Digital mechanics |
| historic | 60 | 4 | 15 | Arena only | historic | All Arena sets |
| timeless | 60 | 4 | 15 | Arena only | timeless | No bans |
| pioneer | 60 | 4 | 15 | Paper + Arena | pioneer | RTR forward |
| modern | 60 | 4 | 15 | Paper + MTGO | modern | 8th Edition forward |
| premodern | 60 | 4 | 15 | Paper + MTGO | premodern | 4th Edition through Scourge |
| legacy | 60 | 4 | 15 | Paper + MTGO | legacy | Eternal, ban list |
| vintage | 60 | 4 (restricted=1) | 15 | Paper + MTGO | vintage | Restricted cards limited to 1 copy |
| sealed | 40 (minimum) | none (as opened) | the unused pool | Arena + Paper | pool containment | Built from the opened pool + basics (CR 100.2b) |
| draft | 40 (minimum) | none (as opened) | the unused pool | Arena + Paper | pool containment | Same rules as sealed; the pool is what you drafted |

---

## Setup (First Run)

```bash
uv sync --directory <skill-install-dir>
download-mtgjson
```

Subsequent runs skip if `.venv` exists and bulk data is fresh (24h).

---

## Tooling Notes

### JSON File Writing

**Use the Write tool** for any JSON file containing card names. Apostrophes in names (e.g., "Ashnod's Altar") break shell quoting in heredocs and inline Python. Write tool permissions are cacheable across the session; `python3 -c "..."` re-prompts every time.

Do NOT write JSON via Bash heredocs (`cat > /tmp/foo.json << 'JSONEOF' ... JSONEOF`). Heredocs are functionally fine but they produce un-cacheable Bash permission patterns: Claude Code's permission engine bakes the heredoc body into the allow pattern, so every invocation with different content re-prompts the user. The Write tool generates a single `Write(/tmp/**)` permission that can be granted once and reused.

**The same caching trap applies to `python3 -c "..."`, `awk '...'`, `jq '...'`, and any other Bash pattern where the code body varies between invocations.** Each unique body is a fresh permission pattern. If you need to extract one field from a JSON file, prefer: (a) passing the file directly to a script that already knows how to parse it, (b) `Read` with `offset`/`limit` on the JSON file, or (c) `Grep` on the file. Reach for `python3 -c` only when those options genuinely don't cover the case, and accept the re-prompt cost when you do.

### Scratch File Paths

Reuse these stable paths within a session: `/tmp/cuts.json`, `/tmp/adds.json`, `/tmp/sideboard-cuts.json`, `/tmp/sideboard-adds.json`, `/tmp/candidates.json`, `/tmp/pet-cards.json`.

**Warning — `/tmp` files persist across sessions.** The Write tool requires a prior `Read` for any existing file, so the first `Write` to a reused `/tmp/*.json` path in a new session fails with *"File has not been read yet"*. If you batched that `Write` in parallel with a Bash call that reads the same file, **the Bash silently consumes the stale prior-session content** — the parallel Write error doesn't block the Bash, so `cut-check` / `scryfall-lookup --batch` / `price-check` / `build-deck` will happily run against the wrong data. Symptom: tool results list cards you never proposed. **Rule:** (a) at session start, `Read` each scratch path you plan to reuse before the first `Write`, OR (b) run `Write` sequentially (not parallel) and verify success before the dependent Bash call. Never batch `Write(/tmp/foo.json)` + `Bash(tool reading /tmp/foo.json)` in a single message. If a tool result lists cards that don't match your intended input, suspect stale-file consumption before suspecting a tool bug.

### Alchemy Card Warning

Alchemy adds **digital-only originals** beyond the Standard pool, with mechanics that only work on Arena (conjure, seek, perpetually, etc.). Verify their oracle text like any other card. Arena reverted every **rebalanced** (`A-`) card to its paper version on 2026-09-22 and the card data no longer carries rebalanced `A-` records, so look up the plain card name. If Arena ever rebalances a card again, the `A-` name is the one with the live oracle text.

### AskUserQuestion Cap

**AskUserQuestion caps at 4 options — never silently drop the rest.** The tool's schema rejects more than 4 options per question. When presenting a longer list (5+ close-call swaps, 5 alternative commanders, etc.), do NOT pick 4 and hide the rest. List **every** option in the preceding text message with enough detail to decide on, then use AskUserQuestion only as a lightweight picker — either (a) put the top 3 on buttons plus a 4th "Other (specify in notes)" so the user can name any option from the text list, or (b) skip AskUserQuestion entirely for that decision and let the user reply in plain text. The failure mode to avoid is 4 option chips that look like the complete set when the text above mentioned 5+.

### Path Requirements

- **Absolute paths only.** `uv` rebases the working directory to the skill install; relative paths resolve against the wrong root.
- **Cache directory:** Always `<working-dir>/.cache`, not the skill install directory. Keeping the cache in the working directory avoids outside-workspace permission prompts. (This is for `scryfall-lookup --batch` on name lists — candidates, pet cards, combo pieces.)
- **Hydration:** Every deck CLI hydrates itself from a sidecar beside the deck (`deck.json` → `deck.hydrated.json`), keyed to the deck's content + bulk identity + version — a stale sidecar can't be read. Edit the deck and re-run any tool; there's nothing to re-hydrate or re-point by hand.

**Always pass `--format <format>` to `parse-deck` once the format is established.** Without this, `parse-deck` defaults to `commander` and every downstream tool sees the wrong format.

### Competitive Brawl (Arena)

`competitive_brawl` is a first-class format — pass `--format competitive_brawl` and the
tools handle it. Do NOT audit it as `historic_brawl` and hand-wave the failures.

It is Arena's ranked Brawl queue (June 2026): 100-card singleton, 1v1, 25 life,
**no free mulligan** (unlike ordinary Brawl), no commander damage, planeswalkers
legal as commanders without explicit permission text.

Two things to know about its card pool:

1. **Its ban list is not ordinary Brawl's.** Wizards publishes it in the MTG Arena
   announcements (the 2026-10-12 update created a second list, **banned as a
   commander**: cards legal in the 99 that can't lead a deck — Oko, Ragavan, Nadu,
   Wrenn and Six and others), and MTGJSON carries both lists in its
   `competitivebrawl` legality key, which is what the tools read. Don't keep or trust a
   hand-copied list: after a B&R update, run `download-mtgjson` and the tools follow.
   Every other Arena card is legal, including most of the cards ordinary Brawl
   bans (Mana Drain, Demonic Tutor, Fierce Guardianship, Ancient Tomb, Chrome Mox…).
   The tools read MTGJSON's own `competitivebrawl` legality key, so a `banned` under
   `brawl` means nothing here; `not_legal` means the card isn't on Arena at all.
   MTGJSON spells "banned as a commander" `restricted`; the tools read it as
   `banned_as_commander` (legal in the 99, never a one-copy limit), so `find-commanders`
   and deck-forge leave those cards out of the commander pick and `legality-audit`
   fails one in the command zone (`commander_zone`: `banned_as_commander`). A card bulk
   downloaded before 2026-10-10 lacks the key, so every card reads `not_legal`; the
   loader warns when it builds the index from such a bulk. Run `download-mtgjson`.
2. **Rebalanced cards were reverted on 2026-09-22.** Arena turned every Alchemy `A-`
   rebalance back into the paper printing, in every format, and the card data has caught
   up: the `A-` records are gone and the paper cards carry the real legality (paper
   Nadu is banned as a commander under `competitivebrawl`; Harald, King of Skemfar
   is legal). Treat any leftover `A-` result as stale data.

**Determining Arena availability generally:** a card is craftable iff its MTGJSON record
has `arena` in `games`. Checking the legality key alone is not sufficient — `banned` and
`not_legal` both mean "not legal in ordinary Brawl" but only the latter means "not on
Arena."

Source of truth for the ban lists: Wizards' MTG Arena announcements
(https://magic.wizards.com/en/news/mtg-arena/announcements-october-12-2026 for the
2026-10-12 update), as captured in MTGJSON's `competitivebrawl` key.

### Arena Rarity Warning

The `rarity` field in the deck's hydrated sidecar is the **default Scryfall printing's rarity**, which drifts from Arena's actual wildcard cost. Always use `price-check --format <fmt> --medium digital --bulk-data <path>` for Arena wildcard budgeting. The medium, not the format, picks wildcards vs USD: Arena-only formats (Brawl, Historic Brawl, Alchemy, Historic, Timeless) are digital anyway, but Standard and Pioneer default to paper, so an Arena build of those needs `--medium digital` (or `"medium": "digital"` in the deck JSON). When Arena is installed it reads the rarity straight from Arena's own card database (ADR-0057), the lowest rarity among the card's craftable printings, so it matches what Arena charges. Without Arena it falls back to MTGJSON's printings, which are wrong for about 35 cards, mostly Special Guests reprints that MTGJSON lists as mythic.

### Licensed IP Card Warning

Some crossover sets use different card names on Arena than in paper/Scryfall: Through the Omenpaths (OM1, the Arena version of Marvel's Spider-Man), Ikoria Godzilla variants, Crimson Vow Dracula variants, and Avatar: The Last Airbender cards all have name discrepancies. **Always pass `--bulk-data` to `mark-owned`** when working with Arena collections — this enables `printed_name` and `flavor_name` aliasing so cards like "Skittering Kitten" (Arena name) correctly match "Masked Meower" (Scryfall name). Without `--bulk-data`, these cards silently appear unowned.

### Parsed Deck JSON Schema

**60-card constructed:**

```json
{
  "format": "pioneer",
  "deck_size": 60,
  "sideboard_size": 15,
  "commanders": [],
  "cards": [{"name": "Lightning Bolt", "quantity": 4}, ...],
  "sideboard": [{"name": "Roiling Vortex", "quantity": 3}, ...],
  "total_cards": 60,
  "total_sideboard": 15,
  "owned_cards": [{"name": "Lightning Bolt", "quantity": 4}, ...]
}
```

Constructed formats always have `"commanders": []`. The `sideboard` field holds sideboard entries separately from mainboard `cards`.

**Commander/Brawl/Historic Brawl:**

```json
{
  "format": "commander",
  "deck_size": 100,
  "commanders": [{"name": "...", "quantity": 1}, ...],
  "cards":      [{"name": "...", "quantity": 1}, ...],
  "total_cards": 100,
  "owned_cards": [{"name": "...", "quantity": 1}, ...]
}
```

All card lists (`commanders`, `cards`, `sideboard`, `owned_cards`) share the `[{name, quantity}]` shape. `owned_cards` starts empty from `parse-deck` and is populated by `mark-owned`. `price-check` reads it to subtract owned copies from the budget; entries with `quantity < 1` are treated as "not owned."

**Parsed deck JSON is the only input every deck tool takes.** Once you have a parsed deck JSON from `parse-deck`, pass it **directly** to every deck CLI — `deck-hydrate`, `price-check`, `deck-stats`, `mana-audit`, `legality-audit`, `combo-search`, `card-summary`, `deck-signals`, `slot-budgets`, `deck-tune`, and the rest all take `<deck.json>` (plus the shared optional `--bulk-data <path>`) and hydrate themselves through their own sidecar — never a separately-tracked hydrated path. Do NOT extract card names into a separate `/tmp/*.json` via `python3 -c` or similar. (The exception is scripts whose input is a *subset* of the deck — `cut-check --cuts <path>` and `build-deck --cuts <path> --adds <path>` expect JSON lists of name strings, not parsed deck JSON, because the caller is specifying which cards to act on. Writing a small `/tmp/cuts.json` via the Write tool is correct in those cases.)

### Script Invocation

All scripts are invoked via `uv run <script-name>` from the skill install directory. Examples in this document elide the `uv run` prefix for brevity.

### Card Count Verification

After writing or editing a deck text file by hand, always parse it immediately and verify the total card count matches the format's expected size. Off-by-one errors from manual edits are common and silent. **Preventive:** before writing the deck file, tally your categories visibly in the narrative:
> - **100-card** (Commander / Historic Brawl): e.g., "Lands 36 + Ramp 10 + Draw 10 + Removal 10 + Wipes 3 + Utility 8 + Engine 18 + Wincons 4 = 99 + 1 commander = 100"
> - **60-card singleton** (Brawl): scale each category by 0.6 and round. E.g., "Lands 22 + Ramp 6 + Draw 6 + Removal 6 + Wipes 2 + Utility 5 + Engine 11 + Wincons 1 = 59 + 1 commander = 60"
> - **60-card constructed**: "Creatures 24 + Instants/Sorceries 16 + Lands 20 = 60"

### Populating `owned_cards`

When building from a user's collection, use the dedicated helper rather than inline `python3 -c`:

```
mark-owned <deck.json> <collection.json> [--bulk-data <bulk-data-path>]
```

**Always pass `--bulk-data` for Arena collections** — this enables `printed_name` and `flavor_name` aliasing so crossover cards match correctly. The script is idempotent and safe to chain after every `parse-deck` / `set-commander` call.

`mark-owned` also does front-face aliasing for DFC / split / adventure / modal cards: a deck that lists `"Fable of the Mirror-Breaker"` (front face only, common in Arena/Moxfield exports) matches a collection entry for `"Fable of the Mirror-Breaker // Reflection of Kiki-Jiki"` (Scryfall's canonical combined form) and vice versa. You do not need to normalize these by hand before calling `mark-owned`.

**Ownership rule — follow it whenever you count copies or wildcards.** Basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes) count as owned in any quantity. On Arena that has no exception (basic styles are cosmetic). In paper the exception is a deck that asks for a special printing — foil or etched, full-art, borderless, a showcase or other special frame, a promo — which is owned only if the collection holds that exact printing (a collection that lists basics by name only, or not at all, doesn't); a plain set pin like "Forest (M21) 274" stays owned. Snow-Covered basics are different cards, collected like any other. On Arena, owning four copies of a card covers any quantity: four Hare Apparent or Rat Colony ("any number") fill every slot, four Seven Dwarves ("up to seven") fill seven — but three owned is three copies. Otherwise, in either medium, you have what you own. The tools already apply this through one function (`Format.copies_short`): `price-check` (USD shortfall in paper, wildcards on Arena), `deck-tune`'s purse (each added copy is free only if the collection covers that copy), and deck-forge's cost readouts. When you reason by hand — "can they build this?", "how many wildcards?" — apply the same rule, not a raw owned-vs-needed comparison.

### Decision Table

| Task | Tool |
|------|------|
| Find format-legal cards by oracle text, type, CMC | `card-search --format <fmt> --bulk-data <path>` |
| Warm/verify the deck's hydrated sidecar (check `missing`) | `deck-hydrate <deck.json> [--bulk-data <path>]` |
| **Run the Step-6 deterministic spine (scorecard + candidate swaps)** — every format | `deck-tune <deck.json> [--bulk-data <path>] [--bracket <1-5>] [--max-swaps <N>] [--budget <usd> \| --wildcards <rarity=N,…>] [--medium paper\|digital] [--exclude <name>]… [--collection <collection>] --output <wd>/tune.json` |
| See what the commander/deck cares about (signal lanes) — *ad-hoc; the spine's `focus` has this* | `deck-signals <deck.json> [--bulk-data <path>] [--json]` |
| Role-density budgets (lands/ramp/draw/interaction/wipes) — *ad-hoc; the spine's `template` has this* | `slot-budgets <deck.json> [--bulk-data <path>] [--shape <S>] [--json]` (deck size comes from the deck JSON) |
| Rank a separate candidate list by synergy — *the spine's `swaps` already rank adds* | `deck-rank <deck.json> <candidates.json> [--bulk-data <path>] [--limit <N>] [--json] [--medium paper\|digital] [--meta auto\|off\|<archetype>]` (candidates from `card-search --json`) |
| Look up a specific card's oracle text | `scryfall-lookup "<Card Name>"` |
| View card table (mainboard) | `card-summary <deck.json> [--nonlands-only] [--lands-only] [--type <T>] [--bulk-data <path>]` |
| View card table (sideboard) | `card-summary <deck.json> --sideboard [--bulk-data <path>]` |
| Scan the deck for cards matching an oracle pattern | `Grep '<regex>' <wd>/deck.hydrated.json` — full oracle text, no truncation |
| Count cards / verify total matches deck size | `deck-stats <deck.json> [--bulk-data <path>]` |
| Find combos in the deck | `combo-search <deck.json> [--bulk-data <path>] [--max-near-misses <N>]` |
| Find combos by card or outcome | `combo-discover --card "<Name>" --format <fmt>` |
| Check whether a proposed cut breaks a near-miss | `Grep '<cut-name>' <combo-search.json>` to find near-miss lines where this card appears as a partner |
| Check deck legality | `legality-audit <deck.json> [--bulk-data <path>] [--cite-rules/--no-cite-rules] [--rules-file <path>]` |
| Check mana base health | `mana-audit <deck.json> [--bulk-data <path>]` |
| Compare mana before/after | `mana-audit <deck.json> --compare <new-deck.json> [--bulk-data <path>]` |
| Price check (paper) | `price-check <deck.json> --bulk-data <path>` |
| Price check (Arena wildcards) | `price-check <deck.json> --format <fmt> --medium digital --bulk-data <path>` |
| **Check a proposal against every mechanical gate (Steps 7 + 10)** | `proposal-check <deck.json> --cuts <c.json> --adds <a.json> [--sideboard-cuts …] [--sideboard-adds …] [--budget <usd> \| --wildcards <rarity=N,…>] [--medium paper\|digital] [--collection <collection>] [--allow-combo-loss] [--multiplier-low N --multiplier-high N] [--output-dir <dir>]` (writes `new-deck.json` + sidecar and `proposal-check.json`; exits 1 on a FAIL) |
| Apply mainboard + sideboard changes | `build-deck <deck.json> --cuts <c.json> --adds <a.json> --sideboard-cuts <sc.json> --sideboard-adds <sa.json> [--bulk-data <path>] [--output-dir <dir>]` (writes `new-deck.json` + its own `new-deck.hydrated.json` sidecar) |
| Compare deck versions | `deck-diff <old-deck.json> <new-deck.json> [--bulk-data <path>]` |
| Export for import | `export-deck <deck.json>` (auto-picks Arena section headers for Arena formats; `--style moxfield\|arena` to force) |
| Mark owned cards from collection | `mark-owned <deck.json> <collection.csv> [--bulk-data <path>]` |
| Know which deck cards I own and how many | `mark-owned <deck.json> <collection.json> [--output PATH] [--bulk-data <path>]` |
| Plan wildcard spend / get per-card or aggregate Arena rarity | `price-check <deck.json> --format <fmt> --medium digital --bulk-data <path>` |
| Get a card's Arena-lowest rarity | `price-check --format <fmt> --medium digital` (never the deck's hydrated sidecar `rarity` field) |
| Find owned, legal, commander-eligible cards from a collection | `find-commanders <collection.json> --format <fmt> --bulk-data <path> --output <working-dir>/.cache/candidates.json` |
| Research metagame/strategy | WebSearch + WebFetch (or `web-fetch` script) |
| Run the self-grill (Step 8 hard gate) | Two parallel `Agent` calls with `subagent_type: "general-purpose"` |
| Cite MTG Comprehensive Rules for a ruling | `rules-lookup --rule <n>` / `--term <keyword>` / `--grep "<regex>"` |
| Fetch Scryfall per-card rulings | `rulings-lookup --card "<name>" --bulk-data <path>` |
| Deeper rules question (layer/timing/stack) | Invoke the `rules-lawyer` skill via the Skill tool |

Only write `python3 -c` when none of these cover the need. When you do, batch every related question into a single body — each unique body is a fresh permission pattern, so one big script beats five small ones.

### Rules Lawyer

For trivial rules questions that arise during tuning ("what does trample say?", "is this trigger mandatory?"), run `rules-lookup --term <keyword>` directly — a single CLI call returns the glossary definition plus the relevant CR rule numbers. For nuanced multi-rule questions (layer interactions, replacement-effect timing, stack ordering across triggered and activated abilities), invoke the `rules-lawyer` skill, which owns the escalation-to-subagent path.

`cut-check` and `legality-audit` auto-attach CR citations to their JSON output — `--cite-rules` is **default-on**. When a CR file is present in the working directory (i.e., you ran `download-rules --output-dir <wd>` in the same working dir), each flagged interaction / violation carries a rule number + snippet with no extra flag. Pass `--no-cite-rules` to opt out on a specific invocation; when no CR is reachable the tools still exit 0 and emit a `WARN: rule_citations not attached` line to stdout.

Run `download-rules --output-dir <working-dir>` once per session before any Step 1 legality-audit call (24-hour freshness check, same pattern as `download-mtgjson`).

---


## Script Reference

### Core Scripts

- `parse-deck <path> [--format FORMAT] [--deck-size N] [--output PATH]` — Parse deck list. Writes JSON to stdout or `--output` PATH. Supports Moxfield, Arena, MTGO, plain text, CSV. `<path>` must be absolute.
- `set-commander <deck.json> "Name" ["Name2"]` — Move card to commanders list. Idempotent.
- `deck-hydrate <deck.json> [--bulk-data <path>]` — Warm/verify the deck's hydrated sidecar (`deck.json` → `deck.hydrated.json`, keyed to the deck's content + bulk identity + version). Stdout is JSON envelope `{sidecar_path, card_count, missing, digest}`. Every other deck CLI hydrates itself the same way, so this is only needed as an explicit checkpoint (inspect `missing`) right after acquisition.
- `scryfall-lookup --batch <names.json> --bulk-data <path> --cache-dir <dir>` — Hydrate a NAME LIST (candidates, pet cards, combo pieces) — not a deck. Stdout is JSON envelope `{cache_path, card_count, missing, digest}`.
- `scryfall-lookup "<Card Name>" --bulk-data <path>` — Single card lookup
- `card-summary <deck.json> [--nonlands-only] [--lands-only] [--type <T>] [--sideboard] [--bulk-data <path>]` — Card table display (mainboard by default). Also accepts a JSON list of card records (e.g. a `scryfall-lookup --batch` `cache_path`), detected by shape.
- `card-search --bulk-data <path> [--format FORMAT] [--color-identity CI] [--oracle REGEX] [--type TYPE] [--cmc-min N] [--cmc-max N] [--price-min N] [--price-max N] [--sort price-desc] [--limit 25] [--json] [--fields F1,F2,...] [--arena-only] [--paper-only] [--is-commander]` — Search local bulk data
- `combo-search <deck.json> [--bulk-data <path>] [--max-near-misses N] [--output PATH]` — Find existing combos and near-misses
- `combo-discover [--card "<name>"] [--result "<outcome>"] [--color-identity CI] [--format FORMAT] [--arena-only] [--paper-only] [--bulk-data PATH] [--output PATH]` — Discover combos by outcome or card
- `legality-audit <deck.json> [--bulk-data <path>] [--output PATH] [--cite-rules/--no-cite-rules] [--rules-file <path>]` — Check legality, copy limits, sideboard size, deck minimum, color identity
- `mana-audit <deck.json> [--compare <new-deck.json>] [--bulk-data <path>] [--output PATH]` — Mana base audit (Burgess/Karsten for commander, constructed formula for 60-card)
- `price-check <deck.json> [--format <fmt>] [--medium paper|digital] --bulk-data <path> [--budget <N>] [--output PATH]` — Budget check. The medium picks the mode: digital (Arena) reports wildcard costs by rarity, paper reports USD. Default: the deck JSON's `medium`, else the format's (Standard and Pioneer default to paper).
- `deck-stats <deck.json> [--bulk-data <path>] [--output PATH]` — Deck statistics
- `deck-signals <deck.json> [--bulk-data <path>] [--json]` — The deck's signal lanes (what the commander's oracle text cares about), via the deck-forge detector. Deterministic.
- `slot-budgets <deck.json> [--bulk-data <path>] [--shape aggro|midrange|control|combo] [--json]` — Role-density bands (lands/ramp/card_draw/interaction/board_wipe) vs the template. Deck size comes from the deck JSON. Deterministic.
- `deck-rank <deck.json> <candidates.json> [--bulk-data <path>] [--limit N] [--json] [--medium paper|digital] [--meta auto|off|<archetype>]` — Rank candidate records (from `card-search --json`) by synergy with the deck's lanes, then price, then curve. Never EDHREC popularity. On a digital build with a cached `arena-meta` archetype, its card share breaks synergy ties before price (`meta_share` in `--json`; ADR-0059).
- `build-deck <deck.json> --cuts <c.json> --adds <a.json> [--sideboard-cuts <sc.json>] [--sideboard-adds <sa.json>] [--bulk-data <path>] [--output-dir <dir>]` — Apply changes. Cuts/adds accept `[{name, quantity}]` dicts or plain name strings. Writes `new-deck.json` and its own `new-deck.hydrated.json` sidecar.
- `deck-diff <old.json> <new.json> [--bulk-data <path>]` — Compare deck versions
- `export-deck <deck.json> [--style auto|moxfield|arena]` — Export import text with sideboard/companion sections. `auto` (default) emits Arena's `Commander` / `Deck` section headers for Arena formats and bare Moxfield lines otherwise.
- `mark-owned <deck.json> <collection.csv> [--bulk-data <path>] [--output PATH]` — Mark owned cards. Always pass `--bulk-data` for Arena.
- `download-mtgjson — Download MTGJSON card data
- `cut-check <deck.json> --cuts <path> --multiplier-low N --multiplier-high N [--commander "<Name>"] [--trigger-type TYPE ...] [--opponents N] [--bulk-data <path>] [--output PATH]` — Mechanical pre-grill analysis (commander formats only). Commander is read from the deck's `commanders` zone by default; `--commander` overrides.
- `edhrec-lookup "<Commander Name>" ["<Partner>"]` — EDHREC recommendations (commander formats only)
- `web-fetch "<url>" --max-length 10000` — Fetch web page with browser headers and curl fallback
- `find-commanders <parsed.json> --bulk-data <path> [--format FORMAT] [--color-identity CI] [--min-quantity N] [--output PATH]` — Find commander-eligible cards from collection
- `mtga-import --bulk-data <path> [--log-path PATH] [--output-dir DIR] [--force]` — Extract Arena collection and wildcards from Player.log. Refuses to overwrite a `collection.json` it didn't write (e.g. a `parse-deck` CSV collection) unless `--force`.
