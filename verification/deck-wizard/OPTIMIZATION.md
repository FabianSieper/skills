# Commander workflow optimization

Base: `ed964cdbc3616d99250a7984b05786ffc9ce7405`.
Candidate branch: `optimize/commander-workflow`.
User intent: optimize execution without reducing recommendation quality; Commander
is the only requested format. No runtime/model-specific configuration is assumed.

## Diagnosed problems and intended changes

- Candidate interpretation depends on dated market data and the whole pool. A
  timestamp refresh or one additional candidate unnecessarily repeats old work.
  Separate semantic card/context fingerprints from membership and market gates.
- Printing IDs and alternate printed names currently change the Oracle hash.
  Preserve them for identity/exclusions, but exclude them from rules fingerprints.
- Models copy machine identities and repeat state explanations. Add an opt-in
  compact transport, bind its short IDs to a verified packet, and materialize the
  existing complete evaluation schema before validation.
- Batch acceptance fails at the first error. Add explicit partial acceptance with
  all row errors and a repair response, retaining strict legacy acceptance.
- Phase navigation needs repeated calls. Add a next-operation command that only
  advances deterministic or already validated phases and returns the next packet.
- Competitor retrieval requires manual JSON navigation. Expose complete role/name
  lookups, with no popularity or top-k cutoff.
- Unrelated format instructions load unnecessarily. Narrow discovery and active
  references to Commander and shorten setup documentation.

## Requirements retained

Every distinct active card and eligible candidate, every Oracle clause and four
game states remain required. Repeated basics are already deduplicated. Broad
discovery, exclusions, current prices/legalities, protected cards, rules evidence,
challenger review, role/function preservation, individual/cumulative swaps and
final current validation remain mandatory. No heuristic shortlist replaces full
candidate evaluation. Deck/commander/goal/diagnosis changes still invalidate the
relevant interpretations. Existing regression criteria remain unchanged.

## Validation plan

Add isolated regression cases for market/printing refreshes, pool additions and
removals, semantic changes, compact round trips and invalid references, partial
repairs, automatic advancement and complete competitor retrieval. Run all existing
Python tests, Ruff, generated-resource preview and repository checks/tests. Compare
serialized transport sizes using equivalent synthetic outputs.

Real-model recommendation and wall-time comparisons remain `not-run` until actual
model access/profiles are available. Use identical tasks in fresh sessions and at
least three paired repetitions, with blinded assessment of recommendation quality.
This candidate is not a model-validated release. Installation was subsequently
explicitly requested and completed; see the delivery state below.

## Implemented behavior

The Commander entry point now uses `deck-research next`. This returns a compact
packet directly, accepts valid rows with targeted repair files for errors, advances
deterministic phases and stops for every required authored decision. Nonempty rules
queues are returned directly; empty queues are still validated. An already complete
run rechecks freshness before returning a current report.

Packet sizing retains complete context/cards. The soft character budget reduces
the card count; oversized fixed context is retained and cards are budgeted
separately. Exact duplicate state assessments can reference another state, and the
runner reconstructs all four explicit assessments before the existing validator.
Machine identities are supplied from the verified packet. Full legacy response
commands remain supported and strict acceptance remains atomic.

Packets carry the complete inventory. `cards --names` retrieves complete saved
partner records even before interpretation; `competitors --roles/--names` returns
all matching validated providers. No hidden shortlist is introduced. Card-only
packets include every Oracle paragraph once, with face/paragraph keys.

Semantic fingerprints ignore printing metadata and source inventory order. They
retain quantities, zones, rules characteristics and relevant request context.
Adding/removing another candidate does not repeat a surviving candidate's judgment.
Market/exclusion/final gates remain separate and current. Changing goals, costs,
Oracle text or deck context still demands fresh interpretation.

The supported skill is paper Commander only. Its unrelated format guides were
removed; the inherited utility code and its existing regression criteria remain.
The scope change is explicit in skill metadata and request initialization.

## Measured results — 2026-11-07

Reproduction: from `skills/games/deck-wizard`, run
`uv run python ../../../verification/deck-wizard/measure_efficiency.py`.
Raw measurements: [optimization-measurements.json](optimization-measurements.json).
The script requires the baseline Git commit and cached Python dependencies.

| Measurement | Result |
|---|---|
| Setup reference | 4,009 → 510 words; 87.28% smaller |
| Preserved five-card synthetic model response | 15,844 → 15,393 serialized characters; 2.85% smaller |
| Compact response reconstructed | Exactly equal to the full response |
| Market-only refresh, one previously evaluated candidate | 0 new evaluations, 1 reused |
| One candidate added to that pool | 1 new evaluation, 1 reused |

These are deterministic measurements, not token counts or a wall-time speedup.
The preserved model output contains mostly different state explanations, so its
honest transport reduction is modest. Avoided interpretation and tool round trips
are the more significant expected gains; real-model measurements remain necessary.

## Checks and delivery state

- Python: 85 tests pass, including the original 44 unchanged cases and 41 additive
  cases. Actual CLI execution, spaced paths, compact round trips, all faces,
  incomplete repairs, stale data, changed context and missing review are covered.
- Ruff check and format-check pass for research code, importer, tests and the
  measurement script (12 files).
- Generated-resource preview has no changes. Repository integrity check and all
  13 existing repository tests pass.
- Governance, foundation/meta tooling and existing regression criteria are unchanged.
- Real-model quality comparison, model wall time and live API integration: `not-run`.
- Source changes committed as `36badfa84085d753638e97fdddc7b729be453738`.
- Subsequently reinstalled on explicit user request with `npx skills@1.7.1` from
  the local checkout. All 769 source files match; the installed CLI and all 85
  tests pass. Previous local changes and the registry were backed up and verified.
- Push attempted, but GitHub DNS resolution and API access failed. The branch is
  local; a successful remote publication is not claimed.
- [Installation receipt](commander-installation.json). Model validation remains open.

Fingerprint contract version 2 requires normal revalidation of old run receipts.
Historical artifacts are retained; receipt hashes must not be manually upgraded.
