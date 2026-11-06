# Search from measured needs

Read for search/discovery/filter/candidates. Candidate names are introduced only
after every active card and the structural diagnosis have passed their gates.

## Search plan

Translate each important gap or user goal into a mechanical hypothesis. Specify
what a useful effect must accomplish, under which conditions, and why a current
slot could be improved. General popularity is a discovery hint, not a verdict.

Write `search_plan.json`:

```json
{"themes": [
  {"id": "protect-engine", "priority": "high", "job": "Protect the engine while retaining a useful floor",
   "hypothesis": "Repeatable protection that also contributes to setup should address gap protect-1",
   "evidence": "diagnosis.json gap protect-1; commander_model recovery_plan",
   "query": "Exact card-search/Scryfall query and source scope"}
]}
```

Use separate themes for distinct jobs: activation costs, activation mana, discard,
graveyard setup, protection, recursion, persistent effects, interaction or finishers.
These are examples, not a fixed list for every commander. Run `complete <run> search`.

## Broad discovery

Search the existing bulk pool with `card-search`; include oracle patterns, relevant
types and near-miss combo pieces. EDHREC/Spellbook may supplement coverage. Preserve
exact queries and source timestamps. Avoid price limits during discovery so a later
budget change can reuse the pool. Finish pagination/result limits; refine an overly
broad query into meaningful themes rather than silently keeping its first page.

For each saved theme, import full records from a hydrated list or card-data source:

```text
deck-research import-candidates <run> --records <full-records.json> \
  --theme protect-engine --source <exact-query-or-source-identifier> \
  --as-of <actual-source-timestamp> --exhausted
```

Use `--exhausted` only after the saved query has no remaining results. For 20
requested recommendations, roughly 100–300 raw candidates and 40–60 serious
contenders can be useful. This is a search-depth heuristic, not a quota. A genuinely
narrow space can be smaller; record evidence of exhaustion. Complete every theme,
then run `complete <run> discovery` and `filter <run>`.

## Hard filter

The runner rejects active identities/aliases, exclusions, illegal/unknown cards,
wrong colors, missing/stale prices or legalities, and over-budget cards. It merges
duplicate printings by Oracle identity and selects the cheapest eligible printing
in the requested currency among the researched records. That is not a claim to
have checked every printing on the market. Inspect `candidate_rejections.json`;
refresh missing data before concluding a promising candidate is unsuitable.

## Interpret eligible candidates

Run `packet <run> --kind candidates --size 8`. Use the same complete record schema
as existing-card-evaluation.md, plus:

```json
"fit": "high",
"comparison": "Compared with named current providers, this changes reliability, setup and lost functionality in these specific ways...",
"function_coverage": {"critical-function-id": "Exact mechanism replacing this narrow job"}
```

`fit`: `very_high`, `high`, `medium`, `niche`, `reject`. Only high/very_high may enter
the final change plan. Use the packet's diagnosis and inspect only the relevant
current role competitors. Compare real floor, role compression, costs, timing,
resilience and user preferences. Multiple useful jobs beat merely multiple lines
of text. Avoid pseudo-precision such as 93.7/100.

Flag each unusual interaction in `rules_questions`; do not promote a theoretical
combo whose critical transition is unverified. Note required pieces, access to
them, total mana, removal windows and whether the candidate works alone.
Submit with `accept-batch`, then `complete <run> candidates` after all eligible
records are covered. Group final comparisons by job; prevent combat/finisher
options from crowding out measured protection, draw or mana needs.
