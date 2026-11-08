# Commander setup and targeted tools

Read for first-time setup, unavailable commands or a specific extra audit. The
standard analysis loop is `deck-research next`; it does not require reading this
tool catalog on each run.

## Setup and storage

Python 3.12+ and uv are required. On first installation:

```text
uv sync --directory <skill-dir>
uv run --directory <skill-dir> download-mtgjson
uv run --directory <skill-dir> deck-research --help
```

Use `uv run --directory <skill-dir> <command>` for every packaged CLI below.
The complete CLI catalog is the `[project.scripts]` table in `pyproject.toml`;
read it in full before treating any tool as unavailable. Use absolute
input/output paths: uv changes the working directory. Store task artifacts and
name-list caches under the project/run, outside the installed skill.
Use the environment's structured file-writing tool and verify a write before a
dependent read. Each run has its own files; shared scratch names can consume stale
data from an earlier task.

Reuse installed dependencies, bulk data and hydrated sidecars. Refresh only stale
or missing source data; a market refresh does not require a new strategic analysis.
Record the actual source timestamp, never the time an old cache was copied.
Set uv's cache directory to a writable location when the default cache is outside
the workspace's permissions. Offline mode requires already cached dependencies.

## Main operations

| Need | Command |
|---|---|
| Next work, including deterministic advancement | `deck-research next <run>` |
| Accept a packet and continue | `deck-research next <run> --packet <packet> --response <response>` |
| Validate an authored phase and continue | `deck-research next <run> --complete <phase>` |
| Complete competitors for roles/names | `deck-research competitors <run> --roles ramp card_advantage` or `--names "Exact Card"` |
| Inspect dependency state | `deck-research status <run>` |
| Saved source records for interaction partners | `deck-research cards <run> --names "Exact Card"` |
| Every plan gate finding at once, exit 1 on failures | `deck-research check-plan <run>` |
| Fill verified images in candidate market records | `deck-research refresh-images <run> --names "Exact A, Exact B"` or `--all` |
| Full card data for a list | `deck-hydrate <deck.json> --bulk-data <bulk>`; inspect `missing` |
| Full text for a named card | `scryfall-lookup "Exact Name"` |
| Search mechanical hypotheses | `card-search --format commander --bulk-data <bulk> --help` |
| Rules and dated card rulings | `rules-lookup --rule <number>`; `rulings-lookup --card "Name"` |
| Compare mana before/after | `mana-audit <old.json> --compare <new.json> --bulk-data <bulk>` |
| Existing/near-miss combos | `combo-search <deck.json> --bulk-data <bulk>` |
| Independent deterministic audit | `proposal-check <deck.json> --help`; `legality-audit <deck.json>` |
| Physical counts | `deck-stats <deck.json>` |

Tools take parsed deck JSON, not a separately managed hydrated path. Targeted
name-list lookups use `scryfall-lookup --batch <names.json> --bulk-data <bulk>
--cache-dir <project>/.cache`. Check each command's `--help` for additional options.
Inspect returned audit statuses: exit 0 alone does not establish a passing audit.

Raw `api.scryfall.com` calls require both a `User-Agent` and an `Accept` header
(HTTP 400 otherwise). The `scryfall-lookup` record shape strips `image_uris`, so
run candidates imported from it (or from MTGJSON bulk) lack the `image_url` that
final validation requires for swap additions; fill them with `deck-research
refresh-images`, which fetches the raw API record and verifies each image URL.

Commander has 100 physical cards including its commander(s); ordinary singleton
and color restrictions have card-specific exceptions checked by the legality gate.
Role totals overlap and never replace the physical count. Cards with a land face
have one physical slot; land/spell options cannot both be spent at once.

## Development checks

From this package, run `uv run python -m pytest -q`, then Ruff check/format-check
on `src/mtg_utils/research`, `src/mtg_utils/archidekt_import.py` and `tests/`.
From the repository root also run `npm run generate:preview`, `npm run check` and
`npm test`. These are deterministic checks; real-model quality and wall-time
comparisons require separate recorded runs.
