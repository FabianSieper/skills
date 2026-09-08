# Easy navigation and extension, with playwright-cli

Revision 2 supplement, 2026-09-08. Proposed, not implemented. This resolves gaps
in the initial [concept](concept.md); it does not claim every possible website
failure is knowable in advance. Unrecognized situations must remain observable,
bounded and unable to trigger guessed interactions.

## Transport stays playwright-cli

```text
AI uses our business commands
  → shared contract runtime
    → compiled page/component operations
      → playwright-cli run-code
        → existing attached browser
```

The installed executable reports `0.1.19`; `--version` and `--help` were checked.
The later read-only setup audit also inspected CLI session/channel inventory.
No session was attached or browser page inspected.
Official documentation supports passing a function file to `run-code`; the
adapter must supply that compiled function rather than runtime imports.
See [Playwright CLI running-code documentation](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/references/running-code.md).

Use Playwright's locator actionability checks inside POM operations, plus our
business identity and destination checks. A visible, enabled button does not
prove that the correct card's data finished loading.
See [Playwright auto-waiting](https://playwright.dev/docs/actionability).

Never silently switch to another browser driver or API. An incompatible CLI or
extension is a diagnostic result with the exact prerequisite, not an invitation
for the operator to invent an alternative. Session reuse and stable tab binding
still need the transport verification recorded in the migration plan.

## What the operating AI should do

Use one common command pattern. The examples below are proposed commands, not
commands available in the current production skill:

```bash
node <skill-root>/scripts/site-runtime.mjs run card.find --json '{"query":"Forest"}'
node <skill-root>/scripts/site-runtime.mjs run nav.open --json '{"targetRef":"returned-reference"}'
node <skill-root>/scripts/site-runtime.mjs run sellers.read
```

The first command accepts all its explicitly supported starting states and
performs the required entry/search transitions internally. The result supplies
printing/artwork candidates with identity, image evidence and bound opening
commands. The operator selects from the task's intent. After opening, the result
supplies seller-reading and version commands; it does not require another status
or help call. `sellers.read` applies and reports its explicit/default filters.
Reading the active page without changing those filters has its own pure read.

Ambiguity is not solved by more navigation: report the distinguishing candidates
and request only a choice that cannot be inferred from the user's instruction.
Missing input is returned inline as field name, description, type, constraints
and default; common commands should not require separately reading `describe`.

Result action summaries use these alternatives:

```ts
type Invocation = {
  executable: 'node';
  args: readonly string[]; // Includes absolute runtime path and bound inputs.
  shellCommand: string;   // Generated with platform-specific safe quoting.
};
type NextAction =
  | { state: 'ready'; id: string; purpose: string; command: Invocation }
  | { state: 'needs_input'; id: string; purpose: string; fields: InputField[] };
```

This is a shape illustration; `InputField` comes from the production schema
registry. Raw website labels are never used as executable text. Fields already
known from the result are bound automatically. The operator does not compose
URLs, selectors, indexes, session flags or bundles.

Failure gives one primary recovery disposition and, where safe, its exact next
command. If state observation itself failed, say so; do not publish the last
known action list as current. Repair-required errors additionally identify the
specific source file, semantic locator ID and failing guard for the builder.

## Navigation cases added in this review

All rows are implementation acceptance cases, not executed live tests.

| Difficulty | Required handling |
|---|---|
| URL changes before SPA content, or old card remains visible | Require destination identity and relevant region completion, not URL alone |
| Page changes while multiple regions are being read | Check identity/revision before and after; one bounded re-observation, otherwise unstable state |
| Sellers loading while card header is ready | Track region readiness separately; allow header reads, withhold seller reads; no page-wide stop for unrelated widgets |
| Button appears enabled but is covered, detached or disabled during interaction | Use actionability plus guarded target re-resolution; no forced click or ordinal fallback |
| DOM rerenders or rows reorder | Re-resolve the same business identity; keep it if context is unchanged, never substitute another row |
| Autocomplete, debounced search or dependent dropdown | Component owns exact selection and waits for verified selected value/dependent options before submit |
| Empty result versus loading, failed fetch or hidden rows | Explicit evidence for empty; loading/error/unknown never becomes count zero |
| Infinite scroll or virtualized table | Declare a bounded load-more workflow; distinguish mounted/loaded/total; pure read never scrolls implicitly |
| Current tab closes, changes or another matching tab exists | Report binding mismatch and observed candidates; never choose by tab index or first match |
| Unexpected popup, download, new tab or permission dialog | Report unexpected effect and stop; do not follow, grant permission, close or save by guess |
| Intentional iframe, popup or download in a future site skill | Require a registered surface/effect adapter and tests; unsupported until added; no generic raw escape |
| Back/reload restores stale data, changes filters or resubmits a form | No generic back/reload recovery; registered destination route with dirty/effect guards |
| Login redirects back to a different card or account | Re-observe after the human finishes; resume a read only through its declared route; invalidate incompatible plans |
| Rate limit, maintenance, offline or persistent spinner | Distinct cause and bounded recovery; no repeated navigation; cooldown applies across CLI invocations |
| Locale, currency, game section or responsive layout differs | Observe context; support only evidenced variants; never change preferences/viewport implicitly |
| Focus/menu/hover state changes | Component owns required noncommitting steps; ephemeral presentation data is not a new global node unless legal operations change |
| Caller interrupted or chat context lost | `status` reports in-flight operation and safe cursor/plan references; new agent does not infer completion or restart work |
| Runtime lock held by a running operation | Return BUSY plus read-only local progress metadata; never wait for lock merely to report status |
| User changes the task mid-workflow | Stop at the next declared safe boundary; do not start further chunks; cancellation cannot undo an in-flight write |
| Partial read needs continuation | Bind cursor to account/context and progress; next command supplied; changed context returns stale cursor |
| Same easy operation causes repeated status/describe calls | Return compact state, data and bound next commands together; no required discovery ritual |
| Optional region drifts but another operation is safe | Block only actions depending on that region; core page/identity ambiguity still blocks all domain actions |

Global blockers and local unavailable regions are different. A consent overlay
can block interaction across the page; a seller-table loading state need not
prevent a read of a stable product header. Region failures retain their cause.
Probe only dependencies of the current page's candidate actions; never perform
a deep DOM extraction for every action in the registry just to compute status.

If the session is busy, status returns `state:null`, no current browser actions,
and sanitized local operation/progress metadata with freshness timestamps.
It must not touch the browser without the lock. Stale last-known state may be
included only as explicitly historical context. There is no claim of reliable
automatic cancellation until the transport's worker lifecycle has been verified.

## What the extending AI should edit

Use the same three site concepts everywhere: **state schema, POM/component,
action declaration**. The engine handles all shared lifecycle machinery.

| Change | Expected site edits | Shared runtime edits |
|---|---|---|
| Add a seller filter | Component schema/mapping, read-back and fixture | None |
| Add a transition on an existing page | POM method, small action declaration, behavior fixture | None |
| Add a dialog | Parent's node schema/recognizer, component, transitions and fixture | None |
| Add a page | Page state/recognizer/POM, action declarations and fixture | None |
| Add a workflow | Registered composition of existing steps, branch/budget fixture | None |
| Add a new transport primitive/effect kind | Explicit runtime extension and cross-site tests | Deliberate reviewed change |

Each page declaration links its schemas, components and actions. Generate a
developer index listing node → recognizer → POM/component → action → test file.
Runtime help can point directly to those source paths when a repair is needed.
Do not require manually synchronized indexes or documentation tables.

The builder supplies one minimal example per action kind. Fixed policy defaults
are filled by factory functions; source/destination, target identity and effect
semantics are explicit. Keep a flat public authoring API; an ordinary page
extension must not need to understand plan storage, subprocess framing, generic
type internals, hashing or lock recovery. No custom DSL or generic route solver.

`npm run verify` is the single documented builder verification command. It
generates metadata and checks contracts, affected behavior and runtime parity.
It must explain failures using the actual page/action/field and source location,
not only a build stack trace. New site facts still need UI evidence.

## Simplicity has measurable acceptance gates

- A supported search from any declared starting state takes one workflow call.
- Opening a returned candidate takes one supplied command with no help lookup.
- An exact selected card's filtered sellers take one command.
- Every failure provides a safe next instruction or names the human/builder
  prerequisite; the operator never reconstructs browser mechanics.
- A harmless rerender does not force reselection; a changed identity does.
- An ordinary action/field extension leaves shared runtime code unchanged and
  requires no handwritten updates to help, manifest or transition tables.
- Run operator scenarios using only generated SKILL.md/CLI, and builder scenarios
  using only builder instructions/site sources. Observe command count, redundant
  calls, wrong recoveries and files touched. These evaluations remain open;
  existing unit tests alone do not prove small-model usability.
