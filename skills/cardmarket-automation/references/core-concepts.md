# Core Concepts

> Read this before extending or modifying any part of the skill. These are the architectural invariants that keep the system safe, predictable, and maintainable. Breaking any of them is a regression.

---

## 1. State Machine

The skill models the browser as a finite state machine with five states:

| state | meaning |
|---|---|
| `start` | Site entry / search box |
| `results` | Search result tiles |
| `detail` | One card page |
| `versions` | Artwork / version list |
| `own-offers` | Selling → My Offers → Singles |

Every action is bound to the state(s) it can run in. `next` declares which actions are valid after the current one. The runtime detects the actual state from the browser URL via `detectState()`. An action that runs in the wrong state must fail with `wrong_state`, not guess.

**Rule:** Never assume a state. Always detect it. Never skip a state transition.

---

## 2. Browser Attachment (Never Launch)

The skill **attaches** to the user's already-open Chrome via `playwright-cli attach --extension=chrome --session=cardmarket-automation`. It **never** opens, launches, replaces, or closes the browser.

- No browser → `BROWSER_REQUIRED` (hard stop, exit code 3).
- Attach failed → `ATTACH_FAILED` (hard stop, exit code 3).
- The calling agent must tell the user to open Chrome; it must not try to fix it itself.

**Rule:** The browser belongs to the user. The skill is a passenger, not a driver.

---

## 3. Read vs Write

Every action is explicitly typed:

```ts
kind: 'read'  // run directly via: cli run <id>
kind: 'write' // requires: cli plan <id> → review → cli execute --plan <id> --approve <hash>
```

- **Read actions** are idempotent and safe to call directly.
- **Write actions** mutate the user's account. They **cannot** be called via `run`. They require a three-step approval workflow:
  1. `plan` – creates a stored plan with a preview, `planId`, and `approvalHash`.
  2. The user reviews the exact plan and gives explicit authorization.
  3. `execute` – runs the stored plan. Verifies the plan hasn't changed (account key, preview, config hash) before executing.

**Rule:** Never execute a write without a stored, approved plan. Never call `execute` without the exact `planId` and `approvalHash`.

---

## 4. Strict Input Validation

Input is validated against a `Fields` schema before the action runs:

- Unknown keys → `INVALID_INPUT`.
- Wrong type (string where number expected, etc.) → `INVALID_INPUT`.
- No type coercion. `"5"` is not a valid integer; `5.0` is not a valid integer.
- Enum values are matched exactly, case-sensitive.
- Numeric `min`/`max` bounds are enforced.
- Missing `required` fields → `INVALID_INPUT`.
- Optional fields with no value use `default`; if no default and not required, the field is omitted from the validated input.

**Rule:** The schema is the contract. If a parameter is not in the schema, it does not exist. Never add implicit parameters.

---

## 5. Output Post-Condition Validation

Every action defines a `validateOutput()` function. After the browser operation completes, the raw result is passed through `validateOutput()` **and** `jsonValue()`. If either fails, the action is considered failed with `POSTCONDITION_FAILED`, even if the browser operation itself succeeded.

`jsonValue()` enforces:
- Only JSON-native types (null, boolean, string, number, array, object).
- No circular references.
- Plain objects only (no class instances, no prototypes).

**Rule:** A successful browser call is not a successful action. The output must pass validation.

---

## 6. Critical Filter Guarantee

Three seller filters are **critical**: `condition`, `language`, and `location`.

After applying and submitting these filters on a detail page, the runtime **reads back** the active filter values. The read-back value for each critical filter must **exactly equal** the submitted value. If it does not:

1. Retry once (the page may not have settled).
2. If still mismatched → `POSTCONDITION_FAILED` with `filter-not-applied <name>` (for `nav.filter`) or `filter-mismatch <name> expected=<a> actual=<b>` (for `stock.market-comparison`).

The action **never** silently continues with a wrong filter. A wrong filter means wrong prices.

**Rule:** If a critical filter cannot be verified, the action fails. There is no fallback.

---

## 7. Error Taxonomy

Every error is one of a fixed set of `ErrorCode` values. Each maps to a specific exit code and a specific message that tells the calling agent what to do:

| code | exit | meaning |
|---|---|---|
| `INVALID_INPUT` | 2 | Bad parameter; fix input |
| `UNKNOWN_ACTION` | 2 | No such action; use `list`/`describe` |
| `AUTH_REQUIRED` | 3 | Not logged in; runtime opened login form |
| `HUMAN_REQUIRED` | 3 | Cloudflare or manual step; user must act |
| `BROWSER_REQUIRED` | 3 | Browser not attached; hard stop |
| `ATTACH_FAILED` | 3 | Attach failed; check setup |
| `APPROVAL_REQUIRED` | 3 | Plan/approval missing or wrong |
| `UI_DRIFT` | 4 | Selector gone; repair POM |
| `AMBIGUOUS_SELECTOR` | 4 | Locator matches >1 element; stop |
| `POSTCONDITION_FAILED` | 4 | Output or business state unverified |
| `PLAN_CHANGED` | 4 | State changed since plan; new plan needed |
| `PLAN_EXPIRED` | 4 | Plan TTL passed; new plan needed |
| `PLAN_USED` | 5 | Already attempted; verify business state |
| `UNKNOWN_COMMIT` | 5 | Write may have happened; verify, don't retry |
| `BUSY` | 4 | Lock held by another process |
| `TIMEOUT` | 4 | Bounded op timed out |
| `INTERNAL` | 4 | Unspecified failure |

**Rule:** Never invent a new error code. Every failure maps to one of these. The calling agent's response is determined by the code, not the message.

---

## 8. Page Object Model (POM)

Browser interactions are encapsulated in page objects under `src/pages/`:

- `StartPage` – site entry, login detection
- `SearchPage` – search box, result tiles
- `DetailPage` – top block, sellers, filter form
- `VersionsPage` – version list
- `OwnOffersPage` – stock table, pagination, stock filter
- `CardDetailPage` – seller-filter settle/read-back, seller extraction
- `OwnOfferEditPage` – edit form for own offers
- `seller-filters.ts` – canonical filter maps, `resolveSellerFilter()`

Actions **use** page objects. They do **not** write raw Playwright selectors. If a selector is needed, it goes in the page object.

**Rule:** Selectors belong in POM. Actions orchestrate POM methods. Never put a `page.locator()` in an action file.

---

## 9. Fingerprint / Implementation Hash

The build creates a **fingerprint** from the implementation: `modulePath` + SHA-256 of the module code. This is stored in the CLI binary and used to:

- Invalidate cached plans if the implementation changes.
- Detect `PLAN_CHANGED` when the config hash doesn't match at execute time.

**Rule:** Changing action code invalidates existing plans. This is intentional and must not be bypassed.

---

## 10. Lock Mechanism

A project-level runtime lock (`.local/runtime.lock`) prevents concurrent CLI invocations:

- Created via exclusive file open (`wx` flag).
- Contains `{ pid, startedAt }`.
- Released in a `finally` block.
- If the lock file exists and the PID is no longer running, the lock is stale. Check the PID before removing.

**Rule:** `BUSY` means another process is active. Do not blindly delete the lock. Verify the PID first.

---

## 11. Plan / Approval Workflow

Write actions follow a strict three-phase protocol:

### `plan`
1. Validate input against the action schema.
2. Run `prepare()` in the browser – reads the current state and returns a `Preview` (`{ identity, changes }`).
3. Store the plan as a JSON file with a UUID `planId`.
4. Compute `approvalHash` = SHA-256 of the canonical plan JSON.
5. Return `planId`, `approvalHash`, `preview`, `expiresAt`, and `instruction`.

### User Review
The user sees the exact `preview` and gives explicit authorization. The agent must show the plan and obtain approval before calling `execute`.

### `execute`
1. Verify `planId` format (UUID v4) and `approvalHash` (64 hex chars).
2. Load the stored plan.
3. Verify `digest(plan) === approvalHash` (plan hasn't been tampered with).
4. Verify no prior attempt marker exists (`PLAN_USED` if it does).
5. Verify plan hasn't expired (`PLAN_EXPIRED`).
6. Verify config hash matches (`PLAN_CHANGED` if implementation changed).
7. Re-run `prepare()` – verify account key and preview match the stored plan.
8. Write attempt marker (before executing).
9. Run `execute()` in the browser.
10. Verify output via `validateOutput()`.
11. Update attempt marker to `completed`.

If step 9 throws: `UNKNOWN_COMMIT` (the write may or may not have happened).

**Rule:** The plan is the contract between the user's intent and the execution. Any mismatch between the stored plan and the current state aborts execution.

---

## 12. State Detection

`detectState(page)` inspects the browser URL and returns the current state. This is called at the start of every browser operation. If the detected state does not match the state the action expects, the action fails with `wrong_state`.

**Rule:** Never trust the caller's claim about the current state. Always detect it.

---

## 13. Automatic Login Handling

When a login-required action (`nav.own-offers`, `stock.market-comparison`, `user.offer.update`, `stock.bulk-price-update`, `info` on `own-offers`) is run while the browser is logged out:

1. The runtime opens the Cardmarket login form in the user's browser.
2. It waits up to 2 minutes for the user to enter credentials.
3. It re-runs the same action.

If the login times out → `AUTH_REQUIRED` with step `login-timeout`. The login page is already open. Tell the user, let them log in, then re-run the exact same command.

**Rule:** The user never has to log in "first". The runtime handles it. But if it times out, the agent must not start a different flow.

---

## 14. CLI Protocol

The CLI has a fixed command set:

```
cli list                              # List all action IDs
cli describe <id>                     # Show params + output schema
cli run <id> --input <file.json>      # Read action
cli plan <id> --input <file.json>     # Write action: create plan
cli execute --plan <id> --approve <hash>  # Write action: execute
cli doctor                            # Check browser attachment
```

- Input is always a JSON file (`--input <path>`). The file contains a naked JSON object.
- `/dev/null` and `/dev/stdin` do **not** work as input files (they are not regular files; `stat().isFile()` returns `false`). Use a temp file instead.
- The result envelope is `{ ok, runId, durationMs, data?, error? }`.

**Rule:** The CLI protocol is the only interface. Do not add new CLI subcommands without updating this document and SKILL.md.

---

## 15. No `require` in Browser Code

The browser run-code context does **not** have `require` defined. Any module that runs in the browser (page objects, actions via `modulePath`) must not import Node builtins in a way that resolves to `require`.

- Expose `modulePath` via `import.meta.url`.
- Let the CLI runtime resolve the path.
- Keep browser-side code `require`-free.

**Rule:** If a module throws `require is not defined`, the fix is to restructure the import, not to add a polyfill.

---

## 16. Artwork Rule (Price Accuracy)

When checking prices, **always navigate to the detail page of a specific artwork**. Different artwork variants of the same card name can have drastically different prices. The "From X €" shown on search results pages can be for a completely different artwork.

**Rule:** Never report a price based only on the search results page. Always confirm the exact artwork on the detail page before reading or quoting a price.

---

## 17. Filter Transparency in Agent Output

Whenever the agent reports card/seller data that was read from a public detail page **with active filters**, it must **always** state which filters were applied. This applies to:

- `info` on a detail page (sellers block)
- `stock.market-comparison` (per-offer market data)
- `nav.filter` result (the applied filter)
- Any future action that reads filtered seller data

### Why

A price without its filter context is misleading. "From 0.25 €" means nothing unless the user knows it was for `condition=Excellent, language=English, location=Germany`. The agent must make the filter context explicit in every presentation.

### Presentation Rule

When presenting filtered card/seller data to the user, the agent **must** include a compact filter line before or above the data table:

```
Filters: condition=Excellent, language=English, location=Germany, sellerType=any, foil=any, signed=any, altered=any
```

Then the data as a minimal table. Example:

**`info` on detail page:**
```
Filters: condition=Excellent, language=English, location=Germany, sellerType=any, foil=any, signed=any, altered=any

| seller         | price    | condition | language  | location  | qty |
|----------------|----------|-----------|-----------|-----------|-----|
| Hayrus         | 0,25 €   | Excellent | English   | Germany   | 1   |
| ClaudiaHRO     | 0,09 €   | Near Mint | English   | Germany   | 5   |
| j0hnsmith      | 0,09 €   | Excellent | English   | Germany   | 1   |
```

**`stock.market-comparison` (per-offer):**
```
Filters: location=Germany, sellerType=any, foil=any, signed=any, altered=any
(Condition and language are derived per card from the own offer.)

| card               | own     | market  | diff  | condition | language  | belowMarket |
|--------------------|---------|---------|-------|-----------|-----------|-------------|
| Ace's Baseball Bat | 0,25 €  | 0,25 €  | 0     | Excellent | English   | ✓           |
| Barbara Wright     | 0,60 €  | 0,60 €  | 0     | Excellent | English   | ✓           |
| Beacon of Creation | 1,60 €  | 1,60 €  | 0     | Excellent | English   | ✓           |
```

**`nav.filter` result:**
```
Applied: condition=Near Mint, language=French, location=Austria
Read-back: condition=Near Mint, language=French, location=Austria ✓
```

### Format Rules

- Filter line: `key=value, key=value, ...` – one line, comma-separated.
- Only include filters that are **not** their default `any`/`0` unless the user explicitly set them.
- Use `✓` / `✗` for boolean flags (`belowMarket`).
- Keep the table minimal: only columns that carry meaning.
- If all filters are defaults, still show the line: `Filters: all defaults (condition=Excellent, language=English, location=Germany)`.
- Never omit the filter context. Even if the user "knows" what filters were used, the agent states them.

---

## Quick Reference: What Must Not Change

| invariant | why |
|---|---|
| Browser is attached, never launched | User owns the browser |
| Write actions require stored approved plan | Prevents unauthorized mutations |
| Unknown input keys are rejected | Schema is the contract |
| Output must pass `validateOutput()` | Browser success ≠ action success |
| Critical filters must match 100% on read-back | Wrong filter = wrong price |
| Errors map to fixed codes | Calling agent depends on the code |
| Selectors live in POM, not actions | Maintainsability boundary |
| Plans are invalidated on implementation change | Prevents executing stale code |
| No `require` in browser code | Browser context limitation |
| Prices come from detail page, not search results | Artwork variants differ |
| Filter context always stated in agent output | Price without filters is misleading |
