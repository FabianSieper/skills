# Sealed and Draft

Read only for an opened/drafted pool. Preserve pool containment and compare every
viable colour pair before choosing a build. Continue with format-tuning.md.

## Phase 1, Path C: Sealed / Draft (a limited pool)

A limited deck is built from the cards the user opened plus basic lands (CR 100.2b): no copy limit, no sideboard cap (the sideboard is the unused pool), a 40-card minimum, and legality is **pool containment**. The whole toolchain models it as the `limited` family (ADR-0055) — never borrow a constructed format at 40 cards.

```
parse-deck <arena-export.txt> --format sealed --output <working-dir>/deck.json
# a bare list of the opened cards (no deck yet): add --pool-only
deck-hydrate <working-dir>/deck.json
```

The export's Deck section becomes `cards`, Deck + Sideboard become the `pool` zone, and the Sideboard section stays the sideboard. Then, **before forming any opinion about a colour pair**:

1. `pool-colors <working-dir>/deck.json` — every mono colour and colour pair the pool supports on equal footing (playables, creatures, removal, evasion, power-4-plus bodies, rares). Read the whole table; the best pair is a finding, not a premise.
2. `set-scan --set <CODE>` — what the SET holds (removal by rarity, sweepers, evasion, the biggest bodies). Judge every answer and threat against the set opponents draw from, never against the cards the user opened.
3. Build the best 40 for the top two or three pairs and compare them on equal footing; 17 lands is the norm (`mana-audit` reads the 16–18 limited band).
4. `legality-audit <working-dir>/deck.json` — the containment check (every copy in the pool) plus the 40-card minimum. `deck-tune` runs the limited template (creatures, removal, curve buckets) and searches only the pool.

Step 8's Self-Grill for a limited build asks the Proposer and Challenger to **rank every viable colour pair from the pool-colors table and justify the ordering** — no candidate pair is named in the prompt, and the table is the input, not a finished list.
