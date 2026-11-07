# Build a new deck

Read only for a new paper Commander deck. Reuse confirmed commander, goals, budget,
preferences, exclusions and collection constraints. Ask only material missing
questions. When the commander is undecided, compare its actual game plan, setup,
resilience and fit before committing to a provisional choice.

Build a provisional 100-card list, including the commander(s), from verified full
card records. Allocate mana, interaction, card advantage, protection and engine
slots according to the chosen plan. Respect collection-only restrictions when
requested; unknown ownership is not proof that a card is available.

Parse with `parse-deck <absolute-list> --format commander --output <deck.json>`.
Verify counts, then initialize a persistent run and use `ingest --deck-json`.
The skeleton enters the same full understanding, per-card analysis, broad search
and challenge workflow as an existing deck. A skeleton is an intermediate artifact.
