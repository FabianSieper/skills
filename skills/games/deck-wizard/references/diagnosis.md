# Aggregate roles and diagnose slot pressure

`next` performs structure automatically after complete existing-card coverage;
`deck-research aggregate <run>` is also available. It writes role counts/groups,
physical count, front-face lands, land options, curve, commander dependency and
conditional/unconditional land sources. Role totals overlap intentionally.

For diagnosis, read the summary and compare cards within each needed job. Create
`diagnosis.json` and a *provisional* `cut_pool.json`. Use deck-specific targets;
generic role bands are prompts to investigate, not automatic deckbuilding laws.

For each shortage/oversupply: report measured count, named providers, desired
function and consequence. Separate similar-looking functions (selection vs draw,
toolbox contents vs delivery into the graveyard, protection vs recursion).

Evaluate cut suitability through role need, role saturation, replaceability,
commander dependency, user preference, curve, setup, opportunity cost and nonbos.
Several flags derived from the same fact are one piece of evidence. A strong card
in an oversupplied role may be a better cut than a modest unique answer.

Compare 3–6 same-job competitors at a time. Explain the best case for retaining
each candidate. Identify unique critical functions and their remaining providers.
Do not rank all 100 cards by a single quality number. A 20–30-card pool can be
useful for a major overhaul; a narrow request needs fewer candidates.

```json
{
  "gaps": [
    {"id": "protect-1", "role": "commander_protection", "observed": 2,
     "evidence": "Names, their restrictions and measured coverage",
     "consequence": "How removal interrupts the actual plan",
     "target_reason": "Why this deck needs more/reliable coverage"}
  ],
  "critical_role_floors": {"land": 35, "commander_protection": 2, "card_advantage": 6},
  "land_surplus_evidence": "No land reduction justified, or measured reason and minimum",
  "unique_functions": [{"id": "graveyard-recovery", "job": "One critical narrow job", "role": "graveyard_recursion", "providers": ["Exact card"]}]
}
```

Numbers above are illustrative. Set floors from this deck's actual needs. A floor
above the current count expresses a shortage; validation prevents further decline.

```json
[
  {"name": "Potential Cut", "job": "Specific role",
   "roles": ["Exact roles from this card's deck_card_analysis entry"],
   "competitors": ["Existing competitor"],
   "replaceability": "high: these providers cover the same conditions",
   "opportunity_cost": "This slot could address measured gap protect-1",
   "flags": ["ROLE_OVERSUPPLY", "HIGH_REPLACEABILITY"],
   "reason": "Independent evidence for looking at this slot",
   "lost_if_removed": "Full lost functionality, including less obvious clauses"}
]
```

`roles` is mandatory and must equal the card's analyzed `roles` list from
`deck_card_analysis.json`; validation enforces it. It makes the swap-phase
provider coverage checkable before drafting `proposed_swaps.json`.

Useful flags include `DEAD_WITHOUT_COMMANDER`, `WIN_MORE`, `TOO_MUCH_SETUP`,
`OVERLAPPING_ROLE`, `ROLE_OVERSUPPLY`, `LOW_IMPACT`, `BAD_MANA_EFFICIENCY`,
`WRONG_GAME_PHASE`, `NONBO`, `USER_DISLIKES_PATTERN`, `OUTCLASSED`, `TOO_NARROW`,
`HIGH_REPLACEABILITY`, `HIGH_OPPORTUNITY_COST`. Give evidence instead of treating
flags as scores. Protected cards are absent from the cut pool.

Lands have their own competitors: color reliability, tapped timing, fetchability,
utility and mana demands. Reduce land count only with measured surplus and a
verified post-change mana base. Low commander synergy is not a land-cut reason.

Run `deck-research complete <run> diagnosis`. Every reported role count must match
the aggregation, every cut must exist, and every competitor must be active.
