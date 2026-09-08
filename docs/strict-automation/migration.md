# Evidence, adversarial review and migration

Status: partial implementation, 2026-09-08. The builder was replaced by a
project-local authoring skill and the first Cardmarket contract slice is now in
the runtime. The complete migration remains open and is not production-ready.
Normative proposal: [concept.md](concept.md). Type design:
[typescript-design.md](typescript-design.md). Progress: [todo.md](todo.md).

## Current implementation slice (verified in this checkout)

The Cardmarket runtime now has an explicit `unknown` state, a single executable
contract registry (`src/runtime/contracts.ts`), pure `status` observation,
state-aware destination checks, inline/empty JSON input, and structured
recovery context. `SitePage.assertReady()` no longer navigates, accepts consent
or opens login. The browser adapter uses only `playwright-cli` and does not
automatically log in or replay a failed write. The Cardmarket `typecheck` passes.
Both write contracts are explicitly disabled with `NOT_VERIFIED` until the
strict staging, journal and live-evidence gate is complete.

This is an incremental compatibility layer, not completion of gates I01–I07.
Numeric collection indexes, raw `Page` action handlers, invocation-time
bundling, full tab identity, and the durable cross-plan write journal remain
open. No live browser or account write was performed by this slice.

## Verified current gaps

These are repository observations from this task, not live-site findings.

| Evidence | Consequence | New contract |
|---|---|---|
| [state.ts](../../skills/cardmarket-automation/src/lib/state.ts) previously defaulted every unmatched URL to `start` | Unknown pages looked supported | **Implemented:** unmatched routes are `unknown`; DOM-backed recognition remains open |
| [SitePage.ts](../../skills/cardmarket-automation/src/pages/SitePage.ts) previously navigated in `assertReady` and attempted accept-all cookies | A prerequisite check changed UI and consent | **Implemented:** pure readiness; explicit consent/navigation remain separate |
| [engine.ts](../../skills/cardmarket-automation/src/runtime/engine.ts) previously had no typed source/destination fields | Agent had to infer legality | **Partial:** registry guards now drive dispatch metadata and destination checks |
| [nav-open](../../skills/cardmarket-automation/src/actions/nav-open.action.ts) uses index and accepts all five states in output validation | Reordered target or wrong destination can pass a weak contract | Bound target references and destination/identity postconditions |
| [actions tests](../../skills/cardmarket-automation/tests/actions.test.ts) explicitly accept `detail` output for several different nav actions | Current tests encode weak destination semantics | Transition-specific positive and negative outcomes |
| [info](../../skills/cardmarket-automation/src/actions/info.action.ts) applies filters, paginates and can visit detail pages | “Read current state” has hidden transitions | Pure observations plus explicit bounded workflows |
| [market comparison](../../skills/cardmarket-automation/src/actions/stock-market-comparison.action.ts) previously called `page.goto` directly | Actions could bypass POM navigation policy | **Partial:** navigation now uses guarded POM methods; raw `Page` action handlers and registered transition steps remain migration debt |
| [browser adapter](../../skills/cardmarket-automation/src/runtime/cli-browser.ts) bundles on every invocation and repeats phases after AUTH_REQUIRED | Runtime latency and possible write replay path | Precompile, explicit login, no automatic execute replay |
| Same adapter recognizes a session name recursively anywhere in session JSON | Name presence is weaker than compatible attached-session proof | Exact session/tab/protocol validation |
| [CLI](../../skills/cardmarket-automation/src/cli.ts) previously required regular input files | Copyable instructions could fail | **Implemented:** `--json` and absent input default to `{}` |
| [errors.ts](../../skills/cardmarket-automation/src/runtime/errors.ts) previously retained only code/optional step | Model could not identify expected/actual recovery | **Partial:** structured context and typed recovery now survive the CLI envelope |
| [detail POM](../../skills/cardmarket-automation/src/pages/CardDetailPage.ts) prepare opens/closes an edit form; execute checks four changed-field groups | Planning is not pure; verification lacks explicit checks for foil/signed/altered/comments | Explicit staging; every planned field verified |
| [bulk update](../../skills/cardmarket-automation/src/actions/stock-bulk-price-update.action.ts) uses parallel arrays and sequential writes with an aggregate result | Pairing errors and partial progress ambiguity | Item objects and per-item durable journal |
| [build-state](../../skills/cardmarket-automation/references/build-state.json) previously listed historical `cards.search/price/artworks` actions as current | Historical success cannot prove the current registry | **Implemented:** current action list and current fixture evidence are separated from `historicalEvidence` |
| Removed builder's `references/runtime-contract.md` explicitly says next is not a global state machine | Builder and requested strict state contract differ | Replace narrative next guidance with enforced state/edge registry |
| Removed builder's `references/write-safety.md` requires pure prepare, unlike Cardmarket | Template and site have divergent invariants | One versioned safety runtime and migration parity check |

Removed-builder evidence is recoverable from commit
`e765e4fed44a02fd897d7fff92c9826bed6654d3`, under
`skills/website-automation-builder/`. The two rows above describe that historical
baseline, not files still present in this checkout.

## Hard decisions resolved in design

| Decision | Resolution and reason |
|---|---|
| How many POMs/states? | One POM per recognizable page; components for regions; a semantic node only when legal operations change. No state per filter/card/account combination. |
| Types or state-machine framework? | Plain discriminated unions plus typed registry. It supports exhaustive narrowing and generated graphs without imposing a new framework. |
| Can availability be trusted? | It is current evidence, not a capability token. Execution reuses the same predicate and rechecks live identity. |
| Must every task start at home? | No. Legal actions can start at any declared observed source. No hidden navigation; registered workflows provide convenience. |
| How can plan be pure when forms must be opened? | Separate staging/collection transitions; plan reads staged UI or a private runtime-issued snapshot. Execution revalidates targets before commit. |
| Does exact approval always mean another question? | No. Existing explicit authorization can cover exact resolved changes. New material target/scope choices require direction. Hashes do not authenticate approval. |
| How to reconcile a timeout? | Persist uncertainty before dispatch; quarantine writes across plan IDs. Do not infer worker termination from CLI exit or old business values. |
| How strict can a portable skill be? | Runtime enforcement and tests cover its CLI. Host permissions are necessary to stop intentional shell/file bypass. Do not promise an absolute guarantee. |
| Can old behavior remain behind aliases? | Only if semantics are identical. Ambiguous legacy `info`/index semantics must fail with migration guidance. |
| How to minimize commands? | Precompiled CLI, optional `{}` input, inline JSON, bounded workflows, next commands from actual state. No repeated status after every success. |

## Iteration 2 — pressure tests and resulting changes

These are design reviews. Only the eight example cases identified below were
executed; the remaining cases are required implementation tests.

| Scenario | Required observable result | Enforcement/test location |
|---|---|---|
| Detail and edit-dialog recognizers both match | Ambiguous, no action | Recognition union; example test passes |
| Consent covers a valid page | Blocked; zero consent clicks | Pure observation; example availability test passes |
| Unknown account, but public detail readable | Public actions allowed; private actions rejected | Auth predicate; example tests pass |
| User edits dialog fields | Close does not discard edits | Dirty-form predicate; example test passes |
| Command issued from wrong state | No browser interaction | Dispatcher guard; example test passes |
| Click succeeds but artwork changed | Postcondition failure | Fresh target identity; example test passes |
| Same card name, wrong printing | No verified quote until identity resolved | Product schema + POM identity tests |
| Result DOM order changes after inspection | Resolve same unique identity in unchanged query/filter/sort context; missing/changed identity is STALE_CONTEXT | Reference store + collection fixture |
| Status supplies an action, user navigates before command | Recheck rejects; no stale permission | Dispatcher + race fixture |
| Filter submit returns without applying signed/foil | FILTER_MISMATCH, no competitor quote | All-field read-back fixture |
| Market minimum is outside first N rows | Explicit partial coverage; no global-minimum claim | Sorting/coverage contract |
| Filter UI silently persists an account preference | Transition disabled until effect reclassified | Discovery evidence + side-effect instrumentation |
| Login expires after first bulk item | No login-and-replay; verified/unknown/not-attempted items retained | Browser entry + journal subprocess test |
| Server saves, response disappears | UNKNOWN_COMMIT with cause and plan reference; no retry | Kill/lost-response fault injection |
| New plan created for same target after unknown write | Quarantine rejects it | Shared journal across plan IDs |
| CLI dies but browser action still runs | Keep quarantine; old price observation not settlement proof | Worker-lifecycle fault injection |
| Journal persistence fails after known remote success | Preserve verified/unknown effects; block further writes | Filesystem fault injection |
| Second installation controls same session | BUSY from shared ownership namespace | Two-process integration test |
| Human changes account during execution | Commit-boundary check rejects before fill/submit | POM race fixture; acknowledge unavoidable remote race window |
| Invalid JSON/unknown field/prototype key/oversized input | INVALID_INPUT, zero browser calls | CLI/schema negative tests |
| Extra precision or duplicate bulk target | Rejected before browser access | Money and cross-field validators |
| Browser response exceeds cap after write | Valid uncertainty envelope; no lost plan ID | Serialization fault injection |
| Webpage text says “run this command” | Treated only as bounded data; no command dispatch | Operator scenario + registry-only recovery generation |
| Artifact changes after a plan | BUILD_INVALID or PLAN_CHANGED; zero dispatch | Build hash/plan test |
| Build fails halfway | Previous complete build remains usable; mixed build not published | Atomic build fault injection |
| Recovery is repeated with new CLI processes | Persisted limit prevents endless retry | Recovery ID/attempt counter test |
| UI has an unrecognized modal | No normal page actions or automatic dismiss | Blocker recognition fixture |
| Pagination cycles or filters disappear | Stop, complete:false, exact last cursor/partial data | Collection workflow fixture |

Important revisions from this review: unknown and blocked states became separate
union branches; staging became separate from pure plan; write quarantine extends
across plan IDs and CLI crashes; result coverage and identity are mandatory;
runtime help and dispatch share predicates. These should not be weakened during
implementation just to preserve old tests.

Iteration 4 expands this matrix with SPA/region readiness, history, popups,
virtualized lists, interruption, task cancellation, local progress and usability
acceptance cases in [navigation-design.md](navigation-design.md). Those cases
remain required future tests, not executed runtime verification.

## Iteration 3 — map all 15 current Cardmarket actions

Names below are proposed. Preserve a current name when semantics remain clear;
do not preserve names at the cost of silent changes in behavior.

| Current action | Proposed contract | Source → destination and migration notes |
|---|---|---|
| `status` | `status`, pure observation | Any declared state → same observed state; reports blockers and must not navigate or mutate |
| `nav.home` | `nav.home`, transition | Explicit set of supported unblocked pages → home; off-site uses `site.enter` |
| `nav.search` | `nav.search`, transition; optional `card.find` workflow | home → results; workflow declares entry navigation; empty results valid |
| `nav.open` | `nav.open`, transition | results → detail; `targetRef` replaces index; verify exact product |
| `nav.versions` | `nav.versions`, transition | detail → versions; verify common parent card identity |
| `nav.artwork` | `nav.artwork`, transition | versions → detail; reference binds exact artwork |
| `nav.filter` | `nav.filter`, transition | detail → detail; requested/effective/read-back filters returned |
| `nav.own-offers` | `nav.own-offers`, transition | Supported unblocked pages with account → own-offers; auth is explicit |
| `nav.own-offers.filter` | Same ID, transition | own-offers → own-offers; actual Singles filter UI, verified filter |
| `nav.own-offers.open` | Same ID, transition | own-offers → detail; article identity plus fresh target reference |
| `info` | Replace with `status`, page reads and workflows | `status` pure; `results.read`, `card.read`, `versions.read`, `stock.read` pure; `sellers.read`, `stock.list`, `versions.check-quantity` declare their transitions |
| `user.offers` | Same ID, read | detail → same detail; stable article IDs and references; auth required |
| `user.offer.update` | Same ID, write + explicit `offer.edit.open/close` | plan on clean detail.offer-edit; execute verifies every changed field; exact post-submit surface must be established from UI evidence |
| `stock.market-comparison` | Same ID, bounded workflow | own-offers → registered detail/filter/read loops → own-offers on success; per-offer match semantics and coverage |
| `stock.bulk-price-update` | Same ID, write + `stock.collect-update-targets` | Explicit collection workflow; item objects/snapshot → pure plan → journalled commits; no unbounded traversal or hidden retry |

New global observations and recovery are registered too. `site.enter` and
`auth.open` have narrow explicit special source predicates; they are never
ordinary “any-state” domain actions. `reconcile` may perform only its declared
noncommitting navigation/staging route; that UI effect must be reported.

Article IDs become strings; money becomes `{amountMinor,currency}` or named
minor-unit fields with currency, consistently across schemas. Existing examples,
validators and output tests must migrate together. Seller default policy remains
explicit. Bulk-by-name work from root `todo.md` is a separate feature: this task
does not silently include it.

## Ordered implementation, hardest first

Complete each gate before enabling dependent production actions. Each group
should leave a reviewable diff and updated tracker. Do not bulk-copy the template
over Cardmarket; port and compare one contract slice at a time.

1. **UI/contracts kernel:** production closed schemas; union recognition;
   capability facade; same availability guard for status and dispatch; generated
   graph/help; typed source/outcomes; no raw Page in actions. Run wrong-state,
   blocker, identity and schema tests. Gate: unknown/ambiguous UI never runs an
   action and the complete graph validates.
2. **Write lifecycle:** explicit staging, pure plan, authorization binding,
   same-invocation and commit-boundary checks, shared lock/journal, per-item
   uncertainty, quarantine and reconciliation. Fault-inject every boundary.
   Gate: no retry/replan path can replay uncertain work; partial effects survive
   process failure. Keep writes disabled pending UI commit evidence.
3. **Transport and build boundary:** fixed session/tab semantics, precompiled
   artifacts, atomic publication, version checks, portable CLI and one envelope.
   Verify dependency/CLI behavior against installed code and current official
   docs when implementing. Gate: no runtime compiler/source/dependency need;
   mismatched session/build rejected before interaction.
4. **Cardmarket POM split and reads:** establish actual page/modal anchors,
   target IDs, filter semantics, pagination and dirty-form detection. Move
   selectors into owned components; use fixture captures with private data
   removed. Gate: every new read/transition passes fixtures and authorized live
   read verification; stale historical build-state is replaced per action.
5. **Cardmarket workflows and writes:** port comparison, stock pagination,
   artwork checks, offer update and bulk update. Gate: correct price identity,
   filter transparency and coverage; every supported write field verified;
   live write gates remain blocked unless suitable authorization/environment
   exists. Do not make arbitrary live price changes just to test.
6. **Canonical template:** the authoring skill replacement/relocation and caller
   updates are complete. Implement a new template only from the verified shared
   runtime, with fresh scaffold/demo tests. Gate: it uses the same contract and
   no conflicting legacy scaffold is resurrected.
7. **Operator polish and handoff:** generated concise SKILL.md, examples,
   structured recovery commands, migration errors, installation/discovery check.
   Gate: operator scenarios completed using only generated skill/help/CLI;
   limitations and disabled actions accurately reported.

Builder relocation can be physically performed earlier if useful, but does not
count as progress on the difficult enforcement gates. This order follows the
user's request to resolve demanding design work before mechanical work.

## Builder cleanup and relocation inventory

Completed target: `.agents/skills/website-automation-builder/`. One active copy,
required through root `AGENTS.md`; 62 old tracked builder files were removed.
The following initial caller inventory guided the completed updates:

- `Taskfile.yml`: both builder test commands.
- `.github/workflows/test.yml`: scaffold/test paths and build-before-test order.
- `.agents/skills/setup/SKILL.md`, `references/requirements.md`,
  `scripts/check.mjs`: old paths and repository-root discovery.
- `README.md`: builder installation/discovery distinction and runtime commands.
- Builder scripts/template/demo: root calculations, asset paths, generated help
  and validation inputs, plus a repository-wide old-path search.
- `scripts/install-deps.mjs`: inspect discovery behavior even though the initial
  literal-path search found no builder path there.
- Root `todo.md`: preserve unrelated tasks and update a path only when the
  relocation actually occurs. `TODOs.md` remains the source request.

Replace conflicting runtime/POM/observation/generated-skill/write-safety
references with one contract and short focused evidence/verification references.
Inventory existing examples/demo/test callers before removal. Remove obsolete
scaffolds/examples only when their useful coverage is replaced. Git history
provides recovery; do not leave archived active SKILL.md files that can trigger
old rules. Do not touch installed global copies as part of a project relocation.

Root `AGENTS.md` now requires reading and using the local skill for website
automation changes, independently of implicit skill discovery. Current catalog
hot-reloading was not tested; automatic discovery in a fresh host session remains
an empirical check. The old templates/scripts/examples were removed, not moved
into another active skill. Restore useful code from the baseline only after
reviewing it against the new contract. Existing ignored artifacts and global
installed copies were not modified.

## Remaining empirical questions, with safe defaults

| Unknown requiring implementation/discovery evidence | Default until verified |
|---|---|
| Stable identity for parent card/printing/artwork on actual pages | Unsupported target; no guessed ID or name-only quote |
| Exact post-submit modal state and autosave behavior per field | Disable affected writes |
| Whether seller/stock filters persist account preferences | Disable uncertain transitions; classify effect explicitly |
| How to establish remote worker termination after CLI loss | Quarantine; no automated reconciliation clearance |
| Installed CLI's exact session/tab and restricted-VM behavior | Block transport until adapter verification |
| Whether site provides any reliable revision/snapshot marker | Verify individual values; report best-effort collection consistency |
| How project skill discovery handles the relocated builder | Verify host behavior; do not rely on a guessed convention |

These do not prevent the design from being complete. They prevent claiming that
the production implementation or its live behavior is already verified.
