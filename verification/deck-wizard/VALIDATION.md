# Deck Wizard validation — 2026-11-06

## Delivered scope

Source: `skills/games/deck-wizard`; installed: `~/.agents/skills/deck-wizard`.
The old Wizard's format/build/limited paths and tooling are retained. The merged
Commander/Archidekt path adds persistent, content-checked phases, bounded model
packets, evidence gates and deterministic validation. The 51-section supplied
workflow is represented in the phase references and executable runner rather than
copied into a single long prompt. The SQLite-style card-cache requirement reuses
the imported toolkit's existing cache/bulk mechanisms; no second cache is required.

Existing cards are understood before candidate discovery. Repeated basics share
one analysis but retain their quantity. All Oracle clauses and four game states
must be covered. Cuts are evaluated within roles and paired with additions;
individual and cumulative swaps preserve required roles and named functions.
Changes to relevant inputs invalidate dependent receipts. Current validation is
required before output; external writes still require the user's requested scope.

## Checks actually run

| Check | Result |
| --- | --- |
| Source `python -m pytest tests/test_research.py -q` | 44 passed |
| Installed copy: same command | 44 passed in 1.68s |
| `npm test` | 13 existing repository tests passed |
| `npm run check` | PASS; four skills, 38 existing case definitions |
| Ruff check of new research modules, importer and tests | All checks passed |
| Ruff format check of those files | Nine files already formatted |
| Local Skills CLI 1.7.1 discovery | Exactly four repository skills; no baseline duplicates |
| `uv sync --offline` in source and installation | PASS; independent Python 3.13 runtimes |
| Installed `deck-research --help` and `archidekt-import --help` | PASS |
| Source-to-install file comparison | 769 non-runtime files identical |
| Installed-skill registry | Local source points at this repository; optimizer absent |
| Navigation skill hash before/after | Unchanged |

Regression coverage includes membership/exclusion precedence, wrong IDs, unknown
categories, quantities, partner/sideboard handling, aliases, missing phase evidence,
packet size and complete clause/state coverage, stale packets, selective invalidation,
exhausted search queries, legality/colors/prices, incomplete or stale external lists,
rules evidence, protected cards, loss of functions, cumulative cuts, exact final
counts, resume/report generation and HTML escaping. Existing tests were retained;
the repository's expected registered-skill count changed from three to four.

Reproduce package checks from the package directory:

```sh
uv sync --offline
uv run --offline python -m pytest tests/test_research.py -q
uv run --offline ruff check src/mtg_utils/research src/mtg_utils/archidekt_import.py tests/test_research.py
uv run --offline ruff format --check src/mtg_utils/research src/mtg_utils/archidekt_import.py tests/test_research.py
```

`--offline` assumes dependencies have already been cached; omit it for first-time
setup on another machine. Run `npm run check` and `npm test` from the repo root.

## Smaller-model evidence

GPT-6 Luna (`gpt-6-luna`, high reasoning) reviewed the implementation in two passes.
Its findings led to gates for exhausted search queries, concrete replacement
providers, protected aliases, blacklist freshness, providers that survive the whole
swap sequence, and the last provider of specialized roles. Regression tests cover
those defects.

A separate GPT-6 Luna agent executed an actual five-card synthetic analysis packet
through acceptance and phase completion. Its first response was rejected for a
mistyped Oracle hash, then accepted after correction. The runner now generates
response templates to prevent that copying error. The model distinguished acquired
activated abilities from ETB triggers and identified resource/board-state limits.
See [the preserved inputs and output](model-smoke/README.md).

Not run: a broad paired baseline/candidate benchmark, real-deck recommendation
quality evaluation, every inherited tool's upstream test suite, live API/browser
integration, or agent discovery after restarting the app. Deterministic gates cannot
prove that model-authored strategic judgments or citations are substantively correct;
source excerpts and a separate challenge pass remain necessary. URL validation
checks structure, not live reachability. No external database or deck was changed.

## Installation and recovery

Installed using Skills CLI 1.7.1 from this local repo for Codex. The source runtime
was temporarily moved outside the package during copying and restored afterwards;
the installed runtime was built independently from cached dependencies.

The previous Wizard and optimizer directories, plus the previous registry, are in:

`~/Downloads/skill-backups/mtg-consolidation-20261106T162458Z`

The old optimizer is no longer installed; the Wizard path now contains the merged
version. Archidekt navigation remains installed and unchanged. Full receipt:
[installation.json](installation.json). Original instructions and source hashes are
also preserved in `baseline/` with filenames that are not discoverable as skills.

Source changes are saved locally and uncommitted. No push or publication was made.
