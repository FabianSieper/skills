# Isolated rules review

Read for the rules phase or earlier when a core commander assumption needs proof.
Run `deck-research rules-queue <run>`; it combines questions from the commander
model, existing cards and candidates. Answer one question at a time.

For each question:
1. Specify the starting objects/zones, relevant characteristics, choices and costs.
2. Describe the exact event/sequence and points where priority/state-based actions
   or replacement effects matter. Distinguish paying costs from resolving effects.
3. Retrieve full Oracle text, card rulings and applicable Comprehensive Rules.
   Use `rulings-lookup --card ...`, `rules-lookup --rule ...`/`--term ...`.
4. Save actual primary-source text under `<run>/evidence/`, with URL and date.
5. Give a concise answer, applicable conditions and a counterexample/limitation.
   Mark unresolved when the evidence cannot establish the result.

For changing forms, analyze what remains on the same object, what changes with
copiable characteristics, and what ends after a zone change. Check retained
abilities, already-created effects, counters, attachments and stack objects
separately. Commander-specific conclusions belong in the run's commander model.

Write `rules_review.json` as a list:

```json
[
  {"id": "Canonical Card Name::timing-1", "status": "verified",
   "answer": "Conclusion with conditions and relevant failure case",
   "sources": [
     {"path": "evidence/ruling.txt", "locator": "Rule number or dated card ruling",
      "quote": "Exact supporting text that occurs in the saved source"}
   ]}
]
```

Copy IDs from the queue. Status is `verified`, `rejected` or `unresolved`.
Run `complete <run> rules`. It checks every answer and the presence of cited text.
Verified conclusions must be grounded in real retrieved evidence; the validator
cannot determine whether a model fabricated a source file. A rejected/unresolved
interaction can remain in the analysis but cannot support a central recommendation.
The final gate blocks an affected add/cut or unresolved commander-model premise.

If a rules-lawyer skill is available, delegate difficult questions with this exact
state description and evidence. Otherwise perform the same focused review. Escalate
to a stronger reviewer only for unresolved critical questions and record the actual
model used. Never silently turn uncertainty into a confident recommendation.
