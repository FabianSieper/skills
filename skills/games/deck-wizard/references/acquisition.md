# Exact deck and evidence acquisition

Read for ingest/data/exclusions. Finish the current phase and run `status` again.

## Ingest

Prefer structured API, full official export, complete user list, then rendered page
only when completeness and zone membership are proven.

Archidekt: `deck-research ingest <run>` fetches the full endpoint with trailing slash
and saves the response. Offline/reused snapshot:
`deck-research ingest <run> --payload <raw.json>`.

The runner checks deck ID, cards/categories, quantities and commander presence.
Unknown categories make a potentially active entry unresolved. An explicit
exclusion, inactive category, deletion/archive takes precedence. Commander
Sideboard, Maybeboard and To Be Removed are excluded even when another category is
active. If the website header counts differently, report that difference.
Several categories never multiply an entry. Different printings aggregate after
canonical-name resolution. Partner commanders count once each; verify eligibility
and pairing against current Oracle/rules evidence during understanding.

For lists, `parse-deck <absolute-file> --format <format> --output <deck.json>`, then
`ingest <run> --deck-json <deck.json>`. Read list-import.md for collections/import
formats. Resolve missing commanders from source/user evidence with `set-commander`.

**Done:** completeness true; unresolved 0. A complete 101-card deck can be diagnosed
but its size violation leads the report. Evaluate a separate size-repair cut with
the same rigor; final total must be legal. A partial fetch is not a deck-size fact.
For inaccessible/private responses obtain a full export. Visibility flags alone
do not prove incompleteness; inspect the actual fields.

## Data

Run `deck-hydrate <run>/deck.json --bulk-data <bulk>` and resolve all `missing` names.
Then import the full sidecar:

```text
deck-research import-data <run> --records <run>/deck.hydrated.json \
  --source <bulk-file-or-URL> --as-of <actual-source-ISO-timestamp>
```

The importer resolves canonical names and unambiguous face/printing aliases.
It keeps all Oracle paragraphs/faces. An explicitly empty Oracle text can describe
a vanilla card; absent data is different. Timestamps include timezone.
Retrieve fresh Scryfall data when a price/legality field is absent or stale.

For name lists use `scryfall-lookup --batch <names.json> --bulk-data <bulk>
--cache-dir <project>/.cache`, then import its full result file.
Use `rulings-lookup` and `rules-lookup` for interactions. Save primary evidence
under `<run>/evidence/` with URL/date and the actual quoted text.

**Done:** every distinct active card has complete faces, explicit mana value and
color identity. Prices are never silently converted from missing to zero.

## Exclusions

Read only sources identified by the user or clearly associated with the task.
For Notion, use connected tools, inspect the database properties, retrieve all
matching rows and finish pagination. Tool failure is not an empty blacklist.
Earlier recommendations are excluded only when requested; rejected cards always
follow the saved request.

Write `external_blacklist.json`:

```json
{
  "names": [],
  "sources": [
    {"id": "exact-source-id-from-request", "complete": true,
     "retrieved_at": "2026-11-06T12:00:00+00:00", "names": ["Example Card"]}
  ]
}
```

Without external sources use `{"names": [], "sources": []}`. Run
`deck-research complete <run> exclusions`. The filter combines active Oracle
identities, aliases, external names and `rejected_cards` deterministically.
