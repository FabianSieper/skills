---
name: cardmarket-automation
description: Read-only Cardmarket state-machine automation (search, detail, sellers, versions, artworks). Attaches to existing Chrome session. Use for card prices, availability, sellers, filters, or print variants.
---

# Cardmarket Automation

> **CONTRACT:** Attach to existing Chrome (`playwright-cli attach --extension=chrome --session=cardmarket-automation`). **NEVER** open/replace/close the browser. Missing browser = `BROWSER_REQUIRED` (hard stop).

## States

| state | meaning | use for |
|---|---|---|
| `start` | game/search entry | begin a new task |
| `results` | search result tiles | identify a card, open one result |
| `detail` | one card page | read top block, sellers, current filter, apply filter, open versions |
| `versions` | artwork/version list | read versions, open one artwork |

The `info` command detects the current state and returns `{ state, ... }`.

## Transitions

| from | command | parameters | to |
|---|---|---|---|
| `start` / any | `nav.search` | `query` | `results` |
| `results` | `nav.open` | `index` | `detail` |
| `detail` | `nav.versions` | – | `versions` |
| `versions` | `nav.artwork` | `index` | `detail` |
| `detail` | `nav.filter` | `condition`, `language`, `location`, `sellerType`, `foil`, `signed`, `altered` | `detail` |

Nav commands return status only: `{ status, state }`.

Status values: `ok`, `not_found`, `not_available`, `wrong_state`.

## Read State

Run `info` to read the current state.

| parameter | default | range | used by |
|---|---:|---:|---|
| `limit` | 30 | 1–150 | `results`, `versions` |
| `sellers` | 50 | 0–500 | `detail` |
| `minQty` | 0 | 0–1000 | `versions` seller-quantity check |

`info` output is state-specific. See `references/actions.md`.

## Recommended Loop

1. `npm run cli -- doctor` – verify browser attachment.
2. Run `info` – detect the current state.
3. Choose one transition from the state:
   - need a card? `nav.search`
   - in results? `info`, then `nav.open`
   - in detail? `info`, `nav.filter`, or `nav.versions`
   - in versions? `info`, then `nav.artwork`
4. After each nav command, run `info` again.

## Execution

```bash
npm run cli -- list                         # List IDs
npm run cli -- describe <id>                # Show params + output schema
npm run cli -- run <id> --input <file.json> # Execute (file = naked JSON object)
npm run cli -- doctor                       # Check browser attachment
```

**Input Format:** Naked JSON object (e.g., `{ "query": "Forest" }`). No wrappers.

**Result Envelope:** The action payload is in `data.result`; suggested follow-ups are in `data.allowedNextActions`.

## CLI & Diagnostics

- **Timeouts:** Bash `timeout` is in ms. `run` ≥ `180000`, `doctor` ≈ `3000`.
- **Debug:** `playwright-cli -s=cardmarket-automation --raw run-code --filename=<diag.ts>` (read-only DOM snippets only).
- **Lock:** `BUSY` = stale lock in `.local/runtime.lock`. Check PID before removing.

## Errors

| Error | Meaning |
|---|---|
| `BROWSER_REQUIRED` | Chrome not attached (hard stop) |
| `HUMAN_REQUIRED` | Cloudflare challenge > 90s (solve manually) |
| `UI_DRIFT` | Selector missing/ambiguous (report to builder) |
| `INVALID_INPUT` | Param out of range/enum |
| `wrong_state` | Command cannot run in the current state |
| `not_available` | Expected page affordance is missing |

## References

- `references/actions.md` – Full parameter & output schemas
- `references/flows.md` – State-machine flows
- `references/verification.md` – Status & known gaps
- `references/selectors.md` – Page-object boundary
