# Import Commander lists and collections

Read for pasted/exported lists or a paper collection. Save files under the run.

```text
parse-deck <absolute-list> --format commander --output <run>/deck.json
set-commander <run>/deck.json "Exact Commander Name"
deck-research ingest <run> --deck-json <run>/deck.json
```

The parser detects plain text, Moxfield/MTGO/Arena exports and CSV; an Arena export
is only an input syntax here, not a change of game format. Sideboard entries stay
separate and are excluded from active Commander analysis. Duplicate names merge.
Use `set-commander` only after source/user evidence identifies the commander;
it is idempotent. Two commanders need actual eligibility/pairing evidence.

Inspect active counts and missing names. Hydrate once, inspect `missing`, then
import the complete sidecar through the acquisition phase. The sidecar is keyed to
deck content and bulk identity; tools reuse it automatically. Read targeted packets
instead of loading the entire sidecar into the model context.

For a supplied paper collection, `mark-owned <deck.json> <collection>` records
ownership. Preserve special-printing requirements. A collection-only deck must
stay inside the supplied inventory. Monetary research budgets currently mean
gross additions; ownership does not silently change them to net cost.
