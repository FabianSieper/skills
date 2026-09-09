# Strict website automation contract

Status: normative architecture, revision 2, 2026-09-08. **Partially implemented
in the Cardmarket compatibility runtime; remaining gates are explicit below.**
Task and decisions: [todo.md](todo.md). Current-code evidence, Cardmarket mapping,
rollout and acceptance cases: [migration.md](migration.md).
The central TypeScript design is in [typescript-design.md](typescript-design.md),
with a small tested [ui-model.ts](ui-model.ts) illustration.
Operator ergonomics and the expanded navigation review are specified in
[navigation-design.md](navigation-design.md).

## 1. Objective and boundary

A small-model operator should need to understand the user's intent, select a
named business operation, supply its arguments, and follow a structured result.
It must not need to remember page sequences, invent selectors, interpret stack
traces, repair scripts, or infer whether a failed write can be repeated.

The runtime is a finite, versioned API. Every supported operation has registered
inputs, effects, source states, destination states, identity checks, output
schema, time bounds and recovery. Anything outside that contract fails closed.
Strictness belongs in executable checks, not just emphatic prose in SKILL.md.

**Fixed transport: playwright-cli.** The implementation path is agent → our
small CLI → registered compiled POM/workflow → playwright-cli `run-code` →
the existing browser. The wrapper reduces operator work and enforces contracts;
it does not replace playwright-cli with another driver, MCP or an API crawler.
Builder exploration also uses playwright-cli, within the build/repair task.

Three boundaries are explicit:

1. **Operator:** calls the compiled CLI and reads its output. Cannot extend the
   supported operation set through parameters. Webpage text is untrusted data,
   including text that looks like commands, errors or instructions.
2. **Builder:** changes maintained sources and tests under an explicit build or
   repair task, then rebuilds. A runtime failure never grants builder authority.
3. **Host/user:** controls filesystem permissions, tools and actual approval.
   A skill cannot prevent an agent with arbitrary shell access from bypassing
   it, prove that a human approved a hash, or make remote UI writes atomic.
   These are limits of the guarantee, not things stronger wording can solve.

Within the CLI, checks are mandatory and there is no `--force`, raw selector,
arbitrary URL, eval, script, shell command or builder-mode escape parameter.
For deployments that need enforcement against a noncompliant operator, the host
must expose only this CLI and keep deployed code/config read-only. That is an
optional deployment requirement; portable skills cannot install that boundary.

## 2. One executable source of truth

Maintain a typed contract registry at `src/contracts/`. It defines states,
actions, workflows, registered recovery operations and error codes. Generate the
manifest, help, action reference and transition table from it. Human explanation
may add reasoning, but may not redefine defaults or command behavior.

Each action declaration must contain:

| Field | Required meaning |
|---|---|
| `id`, `contractVersion` | Stable lowercase dotted/hyphenated ID and protocol version |
| `kind` | `observe`, `read`, `transition`, `workflow`, or `write` |
| `inputSchema`, `outputSchema`, `example` | Closed typed schemas; example must validate |
| `from`, `requires`, `availabilityProbe` | Enumerated states, auth/identity requirements, pure capability check |
| `effects` | Allowed UI changes, durable changes, targets and persistence boundary |
| `outcomes` | Finite success/domain-result variants with exact destination predicates |
| `steps` | Registered transition/POM operation IDs; workflows have a bounded graph |
| `identity` | Business keys, freshness dependencies and guards |
| `budget` | Overall deadline, bounded waits, collection/iteration limits |
| `recoveryPolicy` | Registered dispositions and allowed bounded retry, if any |
| `verification` | Fixture/live evidence references bound to the implementation fingerprint |

Free-text descriptions are not preconditions. A string such as “authenticated
inventory is reachable” cannot substitute for an executable predicate.

Use one schema representation with generated TypeScript types and runtime
validators. Objects reject unknown properties at every level. Inputs are never
coerced. Cross-field constraints run before browser access. Integer means a
finite safe integral number: parsed JSON `5.0` equals `5`; lexical spelling is
not a meaningful distinction. Business IDs are nonempty strings. Money uses
integer minor units and an explicit currency; reject excess precision instead
of silently rounding. User-facing locale conversion belongs before submission.

The table defines the complete **resolved** contract, not boilerplate to copy
into every action. A small transition/read/write factory supplies fixed budgets,
standard errors and inherited invariants. Site authors explicitly supply source,
destination, schemas, identities and real UI effects. `describe` shows resolved
defaults and their source; the validator prevents defaults that invent site facts.

The build fails on unknown state/step/recovery IDs, duplicate IDs, invalid
examples, missing guards, unconstrained workflow cycles, unsupported effects,
or an output variant without a destination assertion. Execution never depends
on a handwritten `next` list.

## 3. Page and component ownership

One POM owns one independently recognizable page surface. Different URL query
values, filters, pagination or cards do not create different POM classes.
Reusable sections are components; a modal is a component plus explicit state.

Proposed Cardmarket layout:

```text
src/
  contracts/                  states, actions, workflows, errors
  pages/
    SiteContext.ts            origin/session/auth/blockers; pure observation
    HomePage.ts               game entry identity and page-level data
    SearchResultsPage.ts      result identity and collection
    CardDetailPage.ts         exact product/printing/artwork identity
    CardVersionsPage.ts       version collection identity
    OwnOffersPage.ts          own-stock identity and collection
  components/
    SearchForm.ts
    SellerFilters.ts
    SellerTable.ts
    OwnOfferFilters.ts
    OwnOfferTable.ts
    OfferEditDialog.ts
    Pagination.ts             policy supplied by owning page
  actions/                    typed orchestration; no Playwright Page/Locator
  workflows/                  registered bounded sequences of action steps
  runtime/                    state enforcement, discovery, plans, errors
  transport/                  fixed browser attachment and dispatch only
```

Selectors and DOM extraction exist only in POMs/components. Components cannot
escape their root or navigate independently. POM methods return typed business
data and evidence, never a raw `Page`, `Locator`, selector or DOM node.
Action handlers receive a narrow capability facade, not a Playwright `Page`.

Only transition-capable POM methods can interact. Observation uses a separate
read-only facade. Commit-capable methods require an internal execution context
issued after plan validation. These boundaries have both import/AST checks and
instrumented tests; TypeScript typing alone is not a security sandbox.

Locators use observed stable attributes or exact accessible roles/names scoped
to an identified container. Every interaction checks exactly one visible,
enabled target. Never resolve ambiguity by `first`, `last`, `nth`, coordinates,
force-click, alternate undocumented selectors, or DOM `.click()`.
Read-only iteration over a collection is allowed; ordinal positions are never
business identities. Fixed read-only DOM extraction must also be scoped and
schema-checked. Supported UI variants are separately evidenced, mutually
exclusive locator variants, not catch-and-try fallbacks.

Readiness is pure: no navigation, login attempt, dialog dismissal, consent
choice, filter fill, pagination or automatic recovery. A readiness failure must
not alter the page it is supposed to describe.

## 4. State and identity

State is freshly observed evidence, not the last successful command:

```text
session: configured session + bound tab identity
origin: exact allowlisted origin | outside-site | unavailable
page: home | results | detail | versions | own-offers | unknown
auth: guest | account(accountRef) | unknown
overlay: none | offer-edit(targetRef) | unknown
blockers: login-required / consent / challenge / native-dialog / loading / drift
context: product identity, filters, pagination and collection revision
```

The canonical ready-state discriminant is `node`, e.g. `detail` or
`detail.offer-edit`. Page ownership and known overlay are derived from that node's
registry entry, not independently writable flags. The fields above explain its
semantic dimensions; do not store redundant combinations that can contradict.
The outer union distinguishes `ready`, `blocked`, `unsupported`, `unavailable`.

URL matching only proposes a page candidate. Accept a known page only when its
unique positive DOM anchors and required identity match. Zero matches means
unknown; multiple matches mean ambiguous state. Never map an unfamiliar route
to home. Observe unknown/off-site states without navigating away.

Each command binds the exact configured session and tab, checks origin, and
rechecks relevant state at each interaction. If the transport cannot reliably
identify the tab, report `SESSION_MISMATCH`; do not use whichever tab is active.
Challenge, consent, native dialog, unknown overlay and auth uncertainty suppress
affected actions. Do not report `loggedIn:false` when detection itself failed.

An observation has an opaque ID, timestamp, build ID and scoped context digest.
It is evidence, not authorization and not a guarantee against later changes.
Before acting, re-read relevant identity and revision. Ignore unrelated animated
content when calculating revision so that harmless UI changes do not stale it.

Collections return opaque `targetRef`s bound to session/tab, originating
observation, page, query/filter context and business identity. References expire
after 5 minutes or any relevant change. Re-resolve and verify identity before
clicking; an index is never accepted by the new public API. A reference contains
no agent-supplied locator or navigation destination. Mere DOM rerendering or
incidental row reordering does not invalidate an unchanged uniquely resolved
business target within the same query/filter/sort context. Missing, changed or
ambiguous identity yields `STALE_CONTEXT`, never “open whatever is now row 3.”
A persisted article ID is still an ID; it does not imply a currently valid
target reference. Commit checks always freshly compare planned business values.

## 5. Transitions and workflows

Every transition follows the same enforced sequence:

1. Validate syntax, schema and cross-field input before transport.
2. Acquire session ownership; check build/artifact and unresolved-write state.
3. Observe state; evaluate action availability and target freshness.
4. Execute exactly the registered POM steps, each with source and identity guards.
5. Wait for the registered observable completion condition within one deadline.
6. Observe the destination and validate business postconditions and output.
7. Return the result, actual state and newly computed available actions.

Source states are finite enumerations; `any` is not a guard. An entry operation
may enumerate all supported unblocked pages. Going from another origin requires
the explicit registered `site.enter` operation on the bound tab. It accepts no
URL and navigates only to the configured entry. Never hide it in `assertReady`.

The transport of POM steps is fixed: forward steps are real UI interactions
(clicks, form submissions), return steps are browser history that undoes the
immediately preceding forward step, and raw navigation is limited to the
configured home entry used to re-anchor. No POM step may raw-navigate to a
constructed page URL.

A transition may have several declared outcomes, for example search can produce
results or a verified empty-results page. An empty result is `ok:true` with
`outcome:"empty"`; wrong state, missing control and unverified destination are
`ok:false` failures. No success envelope containing `status:"wrong_state"`.

A workflow is a registered finite graph of these same steps. Its branch
conditions use validated results, not arbitrary agent decisions. Maximum pages,
items, attempts and deadline are mandatory. It stops at the first unsatisfied
guard and reports completed steps, current state and partial data. It never
silently restores a page after failure. Successful restoration, if promised,
is itself an explicit guarded final step.

Common workflows must reduce calls: `card.find` can search and return exact
printing choices; `sellers.read` can explicitly apply requested/default filters
and read back sellers in one call. Such operations are `workflow`, not pure
observation. An ambiguous card/artwork choice stops with candidates for the user
or agent to resolve from the task; the workflow does not pick the first.

For every supported entry state, the workflow declares a deterministic guarded
route. The operator supplies the intent's business inputs, not a sequence of
page transitions. A current exact target may permit the zero-navigation route.
Do not introduce an unrestricted shortest-path planner: the shortest UI path
may discard edits, reset filters or cross an unauthorized effect boundary.

## 6. Discovery and minimal command effort

Ship a precompiled entrypoint: `node <skill-root>/scripts/site-runtime.mjs`.
The path works from any working directory. No runtime install, TypeScript
loader, compilation, input-file ceremony for `{}`, or chained setup commands.

| Command suffix | Meaning |
|---|---|
| `status` | Pure state + applicable action summaries + blockers |
| `list` | All declared actions; offline; does not claim current availability |
| `describe <id>` | Exact schema, defaults, effects, example, destinations, errors; offline |
| `run <id> [--json '{...}' \| --input <file>]` | Observe/read/transition/workflow; absent input means `{}` |
| `plan <write-id> [--json '{...}' \| --input <file>]` | Create a bound preview; no business write |
| `execute --plan <id> --approve <hash>` | Attempt the exact stored write |
| `reconcile --plan <id>` | Registered observation/recovery route for this attempt |
| `doctor` | Diagnose fixed transport configuration; no domain UI actions |

`--json` and `--input` are mutually exclusive. Input is capped at 64 KiB.
No stdin alias, environment configuration override or runtime dependency install.
Known safe inline strings can be shell-quoted. For arbitrary user text, use a
file; output also supplies argument arrays for callers supporting direct process
execution. A shell string is never constructed by raw interpolation.

After a normal result, another `status` is unnecessary: that result already
contains the observed state and available actions. Runtime rechecks before the
next operation, so skipping a redundant status does not remove a guard.

`availableActions` is computed from registered state predicates, blockers,
account, required affordances, verification status and attempt quarantine.
Each entry contains ID, kind, effect summary and missing-input names. Target
rows include their `targetRef` and concrete bound command when it fits the output
budget. `describe` supplies the full schema. “Available” means state prerequisites
hold at observation time, not that every possible input will succeed or that a
write is approved. Write entries offer `plan`, never unconditional `execute`.

Every returned action distinguishes `ready` (all inputs bound) from
`needs_input` (schema fields still needed). A ready action contains process
arguments and a safely quoted copyable command. A needs-input action contains
its missing-field schema; never publish a placeholder as an executable command.
Prefer a small set of relevant workflows and target-specific continuations;
the full action catalog remains available through `list`/`describe`.

For a specifically requested unavailable action, return the failed predicate,
expected/actual values and a typed recovery disposition. Status need not flood
the model with every unavailable action. Large catalogs are cursor-paginated;
truncation is explicit and never silently removes safety information.

Operator loop: read SKILL.md once → status (or a known entry workflow) → select
an applicable registered action → run its supplied command → inspect `ok`,
`outcome`, `effects`, `error.recovery` → continue only within the user's task.
An available action is not a recommendation to take every possible next step.

## 7. Effects, writes and approval

The contract separates pure observation, presentation changes and durable
business mutations. “Read” never means permission to accept cookies or persist
settings. If a filter's persistence is unverified, classify that effect as
unknown and block the transition until discovery establishes it.

Consent choices require user direction; default handling is a blocker. Login,
MFA and CAPTCHA require human handling. An explicit `auth.open` transition may
open the observed login entry, but never reads credentials or retries a paused
write. No hidden two-minute login loop in every operation.

For offer editing, use explicit staging: `offer.edit.open` is a verified
noncommitting transition; plan reads the staged form without changing it.
`offer.edit.close` is allowed only if no uncommitted edits would be discarded.
An already dirty form is a blocker, never something to reset automatically.

Bulk discovery uses a separate registered collection workflow that visits each
target, reads its edit state, and returns a private immutable snapshot reference.
`plan` may consume this runtime-issued snapshot after checking freshness,
provenance, identities and complete coverage. It cannot accept caller-invented
before-values as evidence. Execution freshly verifies every target before its
commit. A pure plan means no browser UI change; private local plan writes are
allowed. The separation makes the staging work visible and testable.

Plan data binds protocol/build/config/contract hashes, session/tab, account,
target IDs, observed before-values/version, desired changes, collection evidence,
expiry and exact effect scope. Default expiry is 10 minutes; source snapshots
used to create it must be at most 5 minutes old. Expiry is rechecked before each
commit. Canonicalization is versioned and never includes volatile display data.

The agent presents the concrete preview and checks whether existing explicit
user authorization covers these exact targets and changes. If it does, do not
ask again merely for ceremony. If resolution introduces a material new choice,
obtain that choice before execution. A hash binds a plan; it does not prove
human authorization. The host remains the authority for approval enforcement.

Before commit, recheck account, exact target, current business values, permitted
changes and expiry inside the same browser invocation. Fill only planned fields.
Any autosave means the first fill is already a commit boundary. An unknown
commit boundary blocks the action from release. Never use a submit button as
the assumed boundary without evidence.

Persist and flush an exclusive attempt marker before dispatching write-capable
execution. After dispatch, loss of response, process crash, invalid output,
timeout or failed verification is conservatively `UNKNOWN_COMMIT`. No automatic
write retry and no login-and-rerun wrapper. Explicitly acknowledged precommit
rejection may report `commit:none`, but the attempted plan remains consumed.

Verify persisted business data for **every changed field**, including foil,
signed, altered and comments. A closed dialog or successful click is not proof.
No-op plans return `outcome:"no_change"` and never dispatch a write.

Bulk updates use `items:[{articleId,priceMinor,currency}]`, never index-aligned
parallel arrays. Freeze the exact set; no later “all matching cards” resolution.
Check all targets before starting and each again immediately before its commit.
Maintain per-item attempt/outcome records; stop after the first uncertain or
failed item. Results distinguish verified, rejected-before-commit, unknown and
not-attempted items. No automatic rollback, whole-batch replay or hidden resume.

An unresolved attempt quarantines new account writes across new plan IDs until
reconciliation resolves it. If account identity is unknown, quarantine the
session. `reconcile` first checks that no worker is still in flight, then uses
the registered noncommitting route to read affected fields. Record
observed-desired, observed-before, divergent or unreadable; observed-before
alone cannot prove no write will arrive later. Without reliable termination or
settlement evidence, quarantine remains and recovery requires human/builder
help. Desired state is not a claim that this attempt caused it. Remaining work
requires a fresh plan with newly checked authorization.

## 8. Errors that tell the operator what to do

All commands emit exactly one versioned JSON envelope on stdout. Child output
is captured, never mixed into the protocol. stderr is for bounded sanitized
developer diagnostics. Success exits 0; syntax/input 2; prerequisites/approval
3; state/drift/build/runtime failure 4; uncertain/replayed write 5.

Required common fields: `protocolVersion`, `ok`, `runId`, `action` (null for
global/parse failures), `phase`, `durationMs`, `state` (null if unobserved),
`effects`, `availableActions`. Success adds `outcome`, `data`, `coverage`.
Failure adds `error`, and `partial` when work already produced useful results.

`effects` always states `ui: none|changed|unknown` and
`commit: none|verified|unknown|partial`. A local storage failure cannot erase
known committed effects. Do not claim unchanged UI when an operation timed out.

Required error fields:

| Field | Meaning |
|---|---|
| `code`, `message` | Stable code and one concrete human-readable explanation |
| `step`, `page`, `component`, `operation` | Registered failure location; null when not applicable |
| `expected`, `actual` | Bounded typed evidence; distinguish missing from unobserved |
| `cause` | Sanitized underlying code/class; preserve useful transport/locator failure |
| `recovery` | Disposition, owner, safe command or null, prerequisite, attempt limit |
| `diagnosticId` | Private sanitized record reference; null if persistence failed |

Recovery disposition is exactly one of `fix_input`, `observe`, `retry_safe`,
`user_action`, `repair`, `replan`, `reconcile`, `stop`. Owner is
`operator|user|builder`. Recovery commands are generated from the registry and
validated as rigorously as normal requests. A missing parameter never produces
a fake ready-to-run command. `replan` is forbidden while commit status is
unknown. Optional diagnostics must not replace the original error if they fail.

| Error family | Required recovery |
|---|---|
| INVALID_INPUT / UNKNOWN_ACTION | Field path and constraint; describe the exact action or list |
| WRONG_STATE / STALE_CONTEXT | Expected/actual context; pure status or refresh the collection |
| UNKNOWN_STATE / AMBIGUOUS_STATE / SESSION_MISMATCH | Observation if possible; no domain action |
| AUTH_REQUIRED / CONSENT_REQUIRED / HUMAN_REQUIRED | Human prerequisite; no automated loop |
| UI_DRIFT / AMBIGUOUS_SELECTOR | Semantic target and count; observe once, then builder repair |
| FILTER_MISMATCH / POSTCONDITION_FAILED | Exact differing fields; do not report unverified prices |
| PLAN_CHANGED / PLAN_EXPIRED | Fresh read and plan; zero write dispatch if detected beforehand |
| APPROVAL_REQUIRED | Concrete preview/authorization prerequisite; no fabricated approval |
| PLAN_USED / UNKNOWN_COMMIT | Reconcile exact plan; never retry execute |
| BUSY / SESSION_QUARANTINED | Owner/in-flight summary; stop or reconciliation, not lock deletion |
| TIMEOUT / CLI_PROTOCOL / INTERNAL | Phase, commit uncertainty, sanitized cause; no guessed retry |
| BUILD_INVALID / NOT_VERIFIED / NOT_CONFIGURED | Builder/setup responsibility; no runtime rebuild |
| BROWSER_REQUIRED / ATTACH_FAILED | Exact attachment prerequisite; no launch fallback |
| OUTPUT_LIMIT | Explicit partial coverage if available; smaller page/read or reconcile if a write |

These are proposed registered codes; additions require registry changes, tests
and compatibility review. Unknown exceptions map to INTERNAL; after possible
commit they become UNKNOWN_COMMIT while preserving the sanitized cause.

Recovery is phase-sensitive: TIMEOUT during observation and TIMEOUT after submit
must not yield the same instruction. The top-level disposition includes a
concrete command only when it is currently safe and all arguments are known.

## 9. Bounded execution and reproducible builds

Build once and ship hashed Node/browser bundles plus manifest. Runtime validates
artifact integrity before browser access and never compiles source. Publish a
whole validated build atomically; a failed build cannot leave a mixed release.
Keep a protocol version, contract hash, runtime version and source/build digest.
Hash verification detects accidental/tampered artifacts relative to a trusted
manifest; it does not authenticate a manifest an attacker can also replace.

Use argument arrays and fixed executables. No shell subprocess, user-supplied
executable, runtime package download, arbitrary environment config or hidden
network/API fallback. Browser transport remains a single reviewed adapter.
Pin dependencies in the lockfile; validate actual CLI/VM compatibility during
implementation instead of assuming local historical notes are current.

Bind one browser session/tab and serialize operations across installations using
a private user-local lock namespace derived from transport and session identity.
The lock is not scoped only to the skill directory. Hold it across state check,
action and final observation. Protect reads too: navigation can race a write.
Store ownership tokens and worker metadata; release only owned locks. A dead CLI
PID is not proof a browser operation ended. Doctor reports unresolved ownership;
the agent does not delete locks. No automatic stale lock release with uncertain
worker state. A portable skill cannot lock out the human or unrelated tools.

Proposed initial budgets, tunable only in reviewed config: status 10 seconds,
ordinary action 30 seconds, workflow chunk 120 seconds, max 50 records per
response and 20 pages per chunk. Internal waits consume one deadline instead of
adding independent timeouts. Return page/chunk cursors for more work; no `all`
with unbounded work. Use observed value/revision/URL/loader changes, not arbitrary
sleeps or broad network-idle waits on a busy website.

### Wait strategy: observable conditions, never fixed waits

Every internal wait must target a concrete, observable UI condition — the
appearance or disappearance of a specific element, a status change, a loader
disappearing, or a network request completing. Never use a fixed timeout
(e.g. `setTimeout`, `page.waitForTimeout`, arbitrary `sleep`) to wait for
the UI to reach a state. Fixed waits make scripts slower than necessary
(they always wait the full duration) and fragile (they break when the
site changes speed).

Principles:

1. **Wait for what you can verify.** Before interacting, wait for the
   target element to be visible, enabled, and stable. After an action,
   wait for the expected post-condition (new element, changed text,
   removed spinner) within the action deadline.

2. **Use the shortest sufficient condition.** If a loader disappears
   in 200 ms, do not wait the full 30 s deadline. If a button becomes
   clickable in 50 ms, do not wait 1 s. The deadline is a safety
   ceiling, not a target.

3. **Timeouts are failure signals, not wait targets.** A timeout means
   the expected condition did not appear within the deadline — it is a
   `TIMEOUT` error, not a valid completion. The action should not
   proceed after a timeout.

4. **No arbitrary sleeps anywhere.** `page.waitForTimeout`, `sleep()`,
   `setTimeout` for UI synchronization are forbidden. They are never
   a valid wait strategy, regardless of context.

5. **Network waits must be scoped.** `waitForResponse`/`waitForRequest`
   must target a specific URL pattern or resource type, not
   `networkidle` on a busy page. Broad network waits are unreliable
   and slow.

No retry after a commit boundary. A registered noncommitting wait may poll
within the deadline. A transition may repeat once only when evidence proves
the first attempt had no effect and the target/context is unchanged; this must
be specified and tested, not inferred from the word “read”. Caller-visible
retry instructions are limited by persisted recovery IDs so repeated calls
cannot reset the retry budget indefinitely.

Normal output is capped at 32 KiB including the envelope. Preserve all error,
effect, identity, recovery and coverage fields; paginate data first. Never
truncate JSON bytes. If the protocol cannot fit, emit a minimal valid
OUTPUT_LIMIT envelope; after write dispatch it must retain UNKNOWN_COMMIT and
the plan reference unless the durable journal independently proves the result.

## 10. Cardmarket data correctness

Prices bind exact product/printing/artwork identity and their observed image or
other distinguishing evidence. Search/version “from” prices are discovery data,
not verified quotes for a selected artwork. A detail reached from an exact own
article can prove identity directly; no ceremonial versions round trip is
needed when identity is already established. Ambiguous artwork remains a choice.

Seller results include requested filters, normalized effective filters,
read-back values, comparison semantics and timestamp. Verify every requested
filter, not only condition/language/location. State whether condition is a
minimum threshold or exact match. Default seller policy remains
excellent/english/germany unless the task specifies otherwise, and is visible
in results. Pure status/read operations never apply these defaults silently.

Market comparison derives condition, language and relevant variant flags from
each own offer unless explicitly overridden. If matching semantics cannot
express the comparison, mark it unavailable; do not compare incompatible
variants. Separate product-wide price aggregates from cheapest matching seller
prices. Never call a limited subset a global minimum without verified sorting
and coverage. Exclude own offers from competitors using verified seller identity
or mark inability to exclude them. Missing/unknown price is null, never zero.

Own-stock card-name filtering uses the observed Singles filter UI. Pagination
binds account, filters and sort; use stable IDs, deduplicate, detect cursor cycles
and stop on lost filters. `complete:true` requires a verified terminal page.
Stock can change mid-read; call it a best-effort traversal unless a website
snapshot/version mechanism proves consistency. A stale cursor cannot silently
skip or repeat records. No mutation is authorized by having read all offers.

## 11. Builder contract and release gates

The project builder lives at `.agents/skills/website-automation-builder/` and
applies to creating, changing or repairing any website automation in this repo.
A scoped repository instruction routes those tasks to it; ordinary use of a
generated site skill does not load builder instructions. Discovery is a host
feature, so verify actual discovery after relocation rather than claiming a
directory name alone proves it.

Rebuild the builder around this contract: short entrypoint, one normative
contract reference, POM evidence procedure, verification gates, one maintained
template and executable validator. Remove conflicting/redundant old guidance
after caller inventory. Preserve useful transport and safety code/tests if they
pass the new contract; “clean completely” is not a reason to discard proven
behavior and reintroduce defects.

Keep the template runtime as the canonical implementation, with a recorded
runtime version/hash in generated skills and a drift check. Site behavior stays
outside runtime files. A runtime change updates the template, generated demo and
Cardmarket in one verified change. Do not maintain independent safety engines.

Builder sequence: define task/side effects → inspect actual supported UI →
register contracts → implement POMs → test rejection paths and workflows →
build/validate → live-check within task authority → publish readiness per action.
Every deliverable retains sources and precise evidence for later repair.

Verification status is action-specific: `unconfigured`, `fixture-only`,
`live-read-verified`, `live-write-verified`, `blocked`. A fixture-only action is
not enabled on production by default. Write release needs evidence for its
commit boundary and each supported changed field. If an authorized live test is
unavailable, keep it disabled and record the missing gate; do not claim success.
This is a proposed stricter release policy, not an assertion about current code.

Compatibility changes are explicit. Never silently reinterpret an old command
such as `info`. Removed commands return a migration error with replacements;
they must not bypass the new dispatcher. Validate fresh installation without
sources/node_modules at runtime, then with sources present for builder repairs.

## 12. Acceptance standard

The concept is satisfied only when each rule has an identified enforcement
location and a failure test. Review both malicious/invalid input and ordinary
mistakes a small model could make: stale selections, wrong state, wrong field,
partial results, ambiguous artwork, repeated commands and misunderstood errors.
The migration document defines the concrete tests and order of implementation.
No paper-only claim of “never unintended behavior” counts as a release gate.
