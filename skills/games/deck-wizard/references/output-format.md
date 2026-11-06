# Validate and deliver

Read for final/report, and when writing an explicitly requested external update.

Run `deck-research validate <run>`. It rechecks hard candidate filters, dated data,
exact requested count, aliases/exclusions, per-card and total addition budget,
format legality, color identity, copy limits including the command zone, and exact
deck size. It compares physical count, lands/options, curve, roles, dependencies and
land sources for each change alone and cumulatively. Critical roles/functions
must survive. Reviewed rules and the proposal-matching challenge must be complete.

Supplement with the existing `mana-audit <old> --compare <new>`, `deck-stats`,
`combo-search` and `proposal-check` where the card IR is available. Inspect actual
statuses and every lost combo; process exit 0 alone is not a passing audit. If IR
is degraded, use the complete per-card source/role assessments and name the missing
instrument. A qualitative mana assessment is not a probability simulation.

After PASS, run `deck-research report <run>`. It checks freshness again and writes
`report.json` and `report.html`; the HTML escapes card/user text. The structured
report is the persistent source for the final answer. Summarize in the user's
language with:

1. Deck identity, active/excluded/unresolved counts and important initial violations.
2. The actual game plan and key failure modes.
3. Gap → measured evidence → consequence.
4. OUT → IN, one comparative sentence, cost/date, card link and requested image.
5. Before/after counts, roles, lands/curve, total additions cost and tradeoffs.
6. Genuine close calls, limitations, and the smallest useful change set.

The runner validates HTTPS URL syntax and provider metadata, not network
reachability. If the user requires verified live images/links, fetch them and record
the successful responses. Never claim a URL was opened merely because it exists.
Prices are estimates at the recorded timestamp and exclude shipping. Do not mix
USD with EUR or treat missing prices as free cards.

An exact-count shortfall or incomplete evidence produces a diagnostic status,
not a purported complete recommendation list. Report what is missing and why;
continue the appropriate phase when it can be repaired.

## Requested external writes

First finish local validation. Re-read the external destination to avoid duplicates
and source changes. Use canonical Oracle identity where the destination supports
it; otherwise normalized names. Save `external_write_plan.json` with destination,
requested count, intended card IDs/names and actual user authorization.

Use the connected service's current schema/tools. Write only the validated final
set. Keep an incremental `external_write_receipt.json` with each returned row ID,
so an interrupted write can resume without creating duplicates. Read back the
destination and verify requested/created/unique counts plus zero duplicates.
Save readback and discrepancies. A failure after some writes means reconcile the
existing IDs, not resend the entire batch.

For Archidekt, hand the validated plan and baseline source snapshot to
`archidekt-navigation`; re-fetch/reconcile if the deck changed before application.
The analysis runner itself makes no external mutations.
