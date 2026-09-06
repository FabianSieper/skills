---
name: cardmarket-automation
description: Guarded Cardmarket state-machine automation (login state, search, detail, sellers, versions, artworks, own offers, approved offer updates). Attaches to existing Chrome session. Use for card prices, availability, sellers, filters, print variants, or explicit own-offer changes.
---

# Cardmarket Automation

> **CONTRACT:** Attach to existing Chrome (`playwright-cli attach --extension=chrome --session=cardmarket-automation`). **NEVER** open/replace/close the browser. Missing browser = `BROWSER_REQUIRED` (hard stop). Writes require `plan`, exact user review, and `execute` approval; never modify an offer without an explicit instruction.
>
> **ARTWORK RULE:** When checking prices, you must **always navigate to the detail page of a specific artwork** (via `nav.versions` → `nav.artwork` → `detail`). Different artwork variants of the same card name can have drastically different prices. Never report a price based only on the search results page — the "From X €" shown there can be for a completely different artwork. Always confirm the exact artwork image on the detail page before reading or quoting a price.

## States

| state | meaning | use for |
|---|---|---|
| `start` | site/game/search entry | begin a new task, reach the login prompt |
| `results` | search result tiles | identify a card, open one result |
| `detail` | one card page | read top block and other sellers using the default or requested filter; open versions or own offers |
| `versions` | artwork/version list | read versions, open one artwork |
| `own-offers` | Selling → My Offers → Singles | filter and read the logged-in user's stock; open one listing's card detail |

The `info` command detects the current state and returns `{ state, ..., auth }`.

`start`, `results`, `detail`, and `versions` are public. `own-offers` requires a logged-in session. `auth.loggedIn` is `false` when the page shows a username/password login form at the top.

## Automatic Login Handling

When any action returns `AUTH_REQUIRED`, the skill **automatically** calls `nav.home` to navigate the attached browser to the Cardmarket login page, then prompts the user to enter credentials. After the user logs in, retry the original action. This happens without user intervention — you do not need to manually call `nav.home` after an `AUTH_REQUIRED` error.

## Automatic Login Handling

When any action returns `AUTH_REQUIRED`, the skill **automatically** calls `nav.home` to navigate the attached browser to the Cardmarket login page, then prompts the user to enter credentials. After the user logs in, retry the original action. This happens without user intervention — you do not need to manually call `nav.home` after an `AUTH_REQUIRED` error.

## Transitions

| from | command | parameters | to |
|---|---|---|---|
| any | `nav.home` | – | `start` |
| `start` / any | `nav.search` | `query` | `results` |
| `results` | `nav.open` | `index` | `detail` |
| `detail` | `nav.versions` | – | `versions` |
| `versions` | `nav.artwork` | `index` | `detail` |
| `detail` | `nav.filter` | `condition`, `language`, `location`, `sellerType`, `foil`, `signed`, `altered` | `detail` |
| any, logged in | `nav.own-offers` | – | `own-offers` |
| `own-offers` | `nav.own-offers.filter` | `cardName` and any visible stock filter | `own-offers` |
| `own-offers` | `nav.own-offers.open` | `index` | `detail` |

Nav commands return status only: `{ status, state }`.

Status values: `ok`, `not_found`, `not_available`, `wrong_state`.

## Read State

Run `info` to read the current state.

| parameter | default | range | used by |
|---|---:|---:|---|
| `limit` | 30 | 1–150 | `results`, `versions` |
| `sellers` | 50 | 0–500 | `detail` |
| `minQty` | 0 | 0–1000 | `versions` seller-quantity check |
| `all` | `false` | boolean | `own-offers`; when `true`, follows each bottom next-page control to the last page |
| `condition`, `language`, `location`, `sellerType`, `foil`, `signed`, `altered` | seller defaults | valid seller filters | `detail`; applied before other sellers are read |

`info` output is state-specific and includes `auth: { loggedIn }`. See `references/actions.md`.

On a detail page, `info` always applies Cardmarket's canonical seller default (`excellent`, `english`, `germany`, all extras) unless its seller-filter parameters are supplied. Pass the requested filter values to `info` whenever comparing an own offer against other sellers.

## Own Offers Listing

Use `nav.own-offers` for Selling → My Offers → Singles. Apply `nav.own-offers.filter` with `{ "cardName": "Forest" }` to search your stock by card name; its other parameters correspond to the editable left-side filters and use their visible labels where relevant. `info` returns rows and the currently active stock filter.

For a request to list all own offers, call `info` with `{ "all": true }`. It follows every bottom next-page button, verifies the stock filter has not been lost, and reports `complete: true` only after the last page. It intentionally leaves the browser on that final page.

To compare an own listing's price, filter/read the listing, run `nav.own-offers.open` with its current-page index, then run `info` with the default or requested seller filter. The opened detail page reports the filter that was actually applied and the other seller rows; use `nav.versions` there when the card's other print variants are relevant.

## User Offers

`user.offers` reads the logged-in user's own stock rows on a detail page. Each offer includes a stable `articleId`.

`user.offer.update` is a write action. Use it only after the user explicitly asks for a change:
1. Run `user.offers`.
2. If multiple offers exist, ask the user which `articleId` should change.
3. Create a plan with exactly one `articleId` and the requested changes.
4. Show the plan and obtain approval.
5. Execute the stored plan, then verify with `user.offers`.

Supported changes: `price`, `quantity`, `condition`, `language`, `foil`, `signed`, `altered`, `comments`. Image upload is not supported.

## Recommended Loop

1. `npm run cli -- doctor` – verify browser attachment.
2. Run `info` if you wish to detect the current state.
3. Choose one or more transition from the state, then run the corresponding nav command(s):
   - need a card? `nav.search`
   - in results? `info`, then `nav.open`
   - in detail? `info`, `nav.filter`, or `nav.versions`
   - in versions? `info`, then `nav.artwork`
   - need own stock? `nav.own-offers`, then `nav.own-offers.filter` and `info`
   - in own stock? `info { all: true }` for all pages, or `nav.own-offers.open` to compare one listing
    - `auth.loggedIn === false` and a logged-in session is needed? `nav.home` navigates to the login page automatically; ask the user to enter credentials, then retry
4. After the executed nav command(s), check if output suggests success. If so, go back to #2. If not, analyse after which nav command it went wrong, check the state with `info` and figure out what to do next. If you are stuck, report the issue to the builder.

## Execution

```bash
npm run cli -- list                         # List IDs
npm run cli -- describe <id>                # Show params + output schema
npm run cli -- run <id> --input <file.json> # Read action (input file required; naked JSON object)
npm run cli -- plan <id> --input <file.json> # Write action: create exact plan
npm run cli -- execute --plan <id> --approve <hash> # Write action: execute approved plan
npm run cli -- doctor                       # Check browser attachment
```

**Input Format:** `--input <file.json>` is required for `run` and `plan`. The file contains a naked JSON object (e.g., `{ "query": "Forest" }`); use `examples/input-empty.json` (`{}`) when no parameters are needed.

**Result Envelope:** The action payload is in `data.result`; suggested follow-ups are in `data.allowedNextActions`. Plans return `planId`, `approvalHash`, `preview`, and `instruction`.

## CLI & Diagnostics

- **Timeouts:** Use the calling tool's own timeout in ms; stock macOS has no Bash `timeout` command. Budgets: `run`/`plan`/`execute` ≥ `180000`, `doctor` ≈ `3000`.
- **Debug:** `playwright-cli -s=cardmarket-automation --raw run-code --filename=<diag.ts>` (read-only DOM snippets only).
- **Lock:** `BUSY` = stale lock in `.local/runtime.lock`. Check PID before removing.

## Errors

| Error | Meaning |
|---|---|
| `BROWSER_REQUIRED` | Chrome not attached (hard stop) |
| `HUMAN_REQUIRED` | Cloudflare challenge > 90s (solve manually) |
| `UI_DRIFT` | Selector missing/ambiguous (report to builder) |
| `INVALID_INPUT` | Param out of range/enum |
| `AUTH_REQUIRED` | Write requires a logged-in session |
| `APPROVAL_REQUIRED` | Exact stored plan/approval missing |
| `PLAN_CHANGED` | Account/target/state changed; review a new plan |
| `PLAN_USED` | Plan already attempted; verify business state |
| `UNKNOWN_COMMIT` | Write may have happened; do not retry, verify with read |
| `wrong_state` | Command cannot run in the current state |
| `not_available` | Expected page affordance is missing |

## References

- `references/actions.md` – Full parameter & output schemas
- `references/flows.md` – State-machine flows
- `references/verification.md` – Status & known gaps
- `references/selectors.md` – Page-object boundary
