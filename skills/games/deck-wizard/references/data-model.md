# Persistent research contract

Read at initialization or when an artifact fails validation. Commands run as
`uv run --directory <skill-dir> deck-research <command> <absolute-run> ...`.
The runner coordinates the existing toolkit; it does not generate interpretations.

## Request

Normalize confirmed goals and preferences. Label assumptions in `meta`/`variant`.
Ask only for material information absent from the context. Write a JSON file:

```json
{
  "deck_source": "https://archidekt.com/decks/123456/example",
  "format": "commander",
  "goals": ["Improve resilience and repeatable card advantage"],
  "avoid": ["infinite combos"],
  "preferences": ["multiple useful roles"],
  "power_level": "high-power casual",
  "meta": "unknown",
  "variant": "ordinary multiplayer Commander",
  "protected_cards": [],
  "rejected_cards": [],
  "excluded_cards": [],
  "excluded_categories": [],
  "retire_roles": [],
  "external_exclusion_sources": [],
  "recommendation_count": null,
  "max_swaps": 10,
  "budget": {"currency": "EUR", "per_card": null, "total_additions": null},
  "freshness": {"price_hours": 24, "legality_hours": 24, "oracle_hours": 720, "exclusion_hours": 24},
  "output": {"images": true, "language": "de"},
  "external_write": null
}
```

Initialize: `init <run> --request <file>`. Update from new user instructions:
`update-request <run> --request <file>`. The saved request is authoritative.
`recommendation_count` is an explicitly requested exact count of simultaneous
swaps; `max_swaps` is a ceiling. Prefer the smallest useful change set. Present
mutually exclusive alternatives separately; they are not one validated deck.
If fewer justified swaps exist than requested, report the shortfall and causes.

Budget means per-card and gross addition cost in one currency. Shipping and proceeds
from cuts are excluded. Owned-copy and Arena wildcard accounting remain the
`mark-owned`/`price-check` workflow. A monetary check does not verify wildcards.
`max_price_eur` is accepted as a legacy per-card alias.
`retire_roles` is empty by default. Populate it only from an explicit user decision
to abandon a function/strategy, recording that decision in the request. It allows
removing a role's last provider; the analysis must still explain the resulting loss.

## Artifacts

Every path below is under `<run>`. Names are `.json` except `report.html`.

| Phase | Outputs | Operation |
|---|---|---|
| ingest | deck_raw, deck, active_cards, excluded_cards, unresolved_cards, deck_validation | `ingest` |
| data | card_data, market_data, name_resolution | `import-data` |
| exclusions | external_blacklist | write, `complete <run> exclusions` |
| understanding | commander_model | write, `complete ... understanding` |
| existing | deck_card_analysis; analysis/ and packets/ | `packet`, `accept-batch`, `complete ... existing` |
| structure | deck_role_summary, role_groups | `aggregate` |
| diagnosis | diagnosis, cut_pool | write, `complete ... diagnosis` |
| search | search_plan | write, `complete ... search` |
| discovery | candidates_raw, search_log | `import-candidates`, `complete ... discovery` |
| filter | candidates_filtered, candidate_rejections | `filter` |
| candidates | candidate_analysis | `packet`, `accept-batch`, `complete ... candidates` |
| rules | rules_review_queue, rules_review; evidence/ | `rules-queue`, write, `complete ... rules` |
| swaps | proposed_swaps | write, `complete ... swaps` |
| review | strategic_review | write, `complete ... review` |
| final | new-deck, swap_validation, final_recommendations | `validate` |
| report | report.json, report.html | `report` |

`status` reports the next phase and its reference. `complete` checks interpretive
artifacts; deterministic phases require their named command. A phase boundary does
not end the task. Preserve stale results as prior evidence, not current conclusions.

## Reuse and invalidation

Reuse MTGJSON bulk data, the toolkit's hydrated sidecars and name-list cache. Run
`deck-hydrate` to validate a sidecar's deck/bulk identity; import full records.
Oracle characteristics and dated market/legalities are stored separately.
`--as-of` is the actual source timestamp; copying an old cache never refreshes it.

Receipts store content fingerprints, dependency inputs and completion timestamps.
Never manually edit them into a passing state.

- Deck/Oracle changes invalidate dependent understanding and evaluations. Packets
  are keyed to deck context; old source facts and analyses remain available to read.
- Goals/preferences invalidate understanding and downstream phases.
- External exclusions invalidate filtering; deck interpretation/search is reusable.
- Budget/freshness changes repeat filtering and proposal validation. Search remains
  reusable; candidate analysis survives when the filtered pool is unchanged.
- Output-only changes regenerate the report.
- Market-only refresh with identical Oracle records preserves understanding.
- Missing/corrupt artifacts require repair. Final delivery rechecks actual age.

The runner does not poll external services autonomously. At resume refresh deck and
exclusion snapshots when potentially changed; compare source IDs, updated timestamps
and content. Record complete pagination. Runtime artifacts belong in the project,
not in the installed skill or a shared `/tmp/cuts.json`.

Deterministic checks prove shape, coverage, counts and constraints. They cannot
prove a model's strategic interpretation. Oracle evidence, rules reviews and a
separate challenger cover that gap; smaller-model quality must be measured rather
than inferred from these instructions.
