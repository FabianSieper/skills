---
name: cardmarket-automation
description: Read-only Cardmarket automation (search, price, sellers, artworks). Attaches to existing Chrome session. Use for card prices, availability, sellers, or print variants.
---

# Cardmarket Automation

> **CONTRACT:** Attach to existing Chrome (`playwright-cli attach --extension=chrome --session=cardmarket-automation`). **NEVER** open/replace/close browser. Missing browser = `BROWSER_REQUIRED` (hard stop).

## Actions

| ID | Keywords / Intent | Parameters |
|---|---|---|
| `cards.search` | find card, search, look up | `query` (str), `limit` (int=20) |
| `cards.price` | price, cost, sellers, availability, stock | `name` (str), `sellers` (int=50), `condition`, `language`, `location`, `sellerType`, `foil`, `signed`, `altered` |
| `cards.artworks` | versions, artworks, print variants, reprints | `name` (str), `minQty` (int=0), `limit` (int=40) |

## Execution

```bash
npm run cli -- list                        # List IDs
npm run cli -- describe <id>               # Show params + output schema
npm run cli -- run <id> --input <file.json># Execute (file = naked JSON object)
npm run cli -- doctor                      # Check browser attachment
```

**Input Format:** Naked JSON object (e.g., `{ "query": "Forest" }`). No wrappers.

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
| `found: false` | No results (not an error) |

## References

- `references/actions.md` – Full parameter & output schemas
- `references/flows.md` – Action sequences
- `references/verification.md` – Status & known gaps
