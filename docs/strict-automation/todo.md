# Strict website automation concept — task tracker

Updated: 2026-09-08. Status: concept revision 2 complete; project-local builder
replacement and repository routing implemented; Cardmarket contract migration is
partially implemented and still not production-ready.

## Request and scope

Develop a very strict, practical architecture for website automation skills, using
Cardmarket as the concrete case. Cover POM ownership, transitions, discoverable
capabilities for smaller models, robust scripts, actionable errors, and minimal
command effort. Specify how to replace and relocate the builder to
`.agents/skills/website-automation-builder`, then migrate Cardmarket.

Source request: `TODOs.md`, item 2. Preserve the unrelated root `todo.md` and
Cardmarket's existing task list. This file is the progress and decisions record.
Scope assumption: concept first, migration afterward. The asynchronous scope
question was not answered; this assumption was announced in the conversation.
The user's later steering explicitly prioritized the hardest thinking/planning
first and a clean, understandable, extensible TypeScript representation of UI.
The user subsequently explicitly requested removing the old builder and creating
the project-local replacement. That replacement, root AGENTS.md routing and
affected repository callers are now implemented. The current Cardmarket slice
adds contract/state/CLI guards but has no live-site or account-write verification.

## Work queue

- [x] Read user request, repository task lists, and skill-creator instructions.
- [x] Verify starting git state: clean; no applicable AGENTS.md found in ancestors.
- [x] Inspect Cardmarket entrypoint, existing concepts, CLI, engine, and errors.
- [x] Inspect POMs, transitions, browser adapter, builder contracts and tests.
- [x] Record concrete gaps with source evidence; distinguish current from proposed.
- [x] Iteration 1: write the architecture and exact runtime contract.
- [x] Iteration 2: challenge it against failure scenarios and revise weak points.
- [x] Prioritize concrete TypeScript UI representation after user steering.
- [x] Validate the model with behavior and compile-time rejection examples.
- [x] Iteration 3: map every existing Cardmarket action to the proposed contract.
- [x] Define builder cleanup/relocation and ordered migration acceptance gates.
- [x] Validate document links, coverage, examples and contract consistency.
- [x] Record final status, validation evidence, unresolved items and next commands.
- [x] Iteration 4: audit navigation/authoring ease and missing failure classes.
- [x] Make playwright-cli the explicit fixed transport; verify installed help/version.
- [x] Replace the old builder with `.agents/skills/website-automation-builder`.
- [x] Add root AGENTS.md mandatory routing, update setup/Task/CI/install docs.
- [x] Remove 62 legacy builder files; recoverable from baseline git commit.
- [x] Validate the replacement skill, wiring, checks and final diff.

## Open implementation queue — demanding work first

All items below remain open. Detailed acceptance gates are in
[migration.md](migration.md), section “Ordered implementation, hardest first”.

- [~] I01: Implement schema-derived UI union, recognition, typed transition
  registry and shared availability/dispatch enforcement in the canonical runtime.
  **Partial:** explicit `unknown`, contract registry, shared availability and
  destination checks exist; DOM union/recognizer and capability facade remain.
- [ ] I02: Implement explicit staging, pure plans, per-item commit journal,
  cross-plan quarantine and trustworthy reconciliation/worker lifecycle.
- [~] I03: Establish reliable session/tab binding, shared ownership, transport
  compatibility, precompiled atomic builds and complete error envelopes.
  **Partial:** playwright-cli-only adapter, pure readiness, inline/empty input
  and structured recovery envelopes exist; tab identity and precompiled build remain.
- [ ] I04: Port Cardmarket POMs/components and establish live identity, filter,
  pagination and modal evidence; replace obsolete action verification records.
- [ ] I05: Port all 15 actions and bounded workflows; verify every changed field
  and partial-write path. Keep actions disabled when evidence is insufficient.
- [ ] I06: Build a new canonical template/scaffold from the verified runtime.
  Skill replacement, relocation and scoped repository routing are DONE.
  Verify fresh-session implicit discovery separately; AGENTS.md is explicit routing.
- [~] I07: Generate operator help/examples, replace incompatible legacy commands
  with migration errors, run fresh-scaffold and operator acceptance scenarios.
  **Partial:** Cardmarket SKILL.md now documents the strict contract and honest
  legacy boundary; generated help and full operator scenarios remain.

## Decisions

- D01: Interpret “scripts are error-prone” as preventing errors and handling
  failures reliably; the surrounding requirements make that intent clear.
- D02: Strictness must be enforced by runtime contracts and verification gates,
  with explicit limits on what instructions alone can guarantee.
- D03: Keep design artifacts together under `docs/strict-automation/`.
- D04: Do not change the live browser or perform account writes for this design.
- D05: Existing docs are evidence of intent, not proof that runtime enforces it.
- D06: UI = plain discriminated union; named semantic nodes with composed POMs.
  Filter values, identities and pagination remain data; known dialogs are nodes
  under their parent POM. Unknown/blocking states cannot enter ready handlers.
- D07: One typed registry generates manifests/help/graph. Availability and
  execution share predicates; execution freshly verifies state and identity.
- D08: Separate pure observation/read, declared UI transitions/workflows and
  durable writes. Readiness must not navigate, accept cookies or change filters.
- D09: Use fresh opaque target references instead of public ordinal indexes.
- D10: Plan purity requires explicit staging/collection. Existing explicit user
  authorization can cover exact changes; hashes do not prove human approval.
- D11: Uncertain writes quarantine subsequent writes across plan IDs; a dead
  CLI PID or observing old values does not prove the browser worker stopped.
- D12: Each changed field and bulk item needs verification; use item objects,
  integer minor-unit money, partial outcomes and no automatic rollback/retry.
- D13: Precompiled portable CLI, optional empty input, inline JSON and bounded
  workflows reduce command effort. One sanitized structured result/error format.
- D14: Pinned canonical runtime/template; no independent safety-engine fork.
- D15: Strong host-level prevention of shell/file bypass needs host permissions;
  skill instructions and a CLI alone cannot guarantee it.
- D16: Empirical unknowns block affected release gates, not concept work. See
  migration.md for defaults and evidence needed.
- D17: playwright-cli remains the only browser transport and builder exploration
  tool. The business CLI wraps it; no alternative driver/MCP/API fallback.
- D18: Registered task workflows route from supported start states. Return ready
  bound commands or missing-field schemas; no operator path planning ritual.
- D19: Region readiness is separate from global blockers. Stable target identity
  survives harmless rerenders/reordering; changed context/identity does not.
- D20: Keep extension work at state/POM/action level with inherited fixed policy
  defaults and generated help/indexes. Ordinary site edits do not touch engine code.
- D21: Replace the incompatible builder and scaffold entirely. The new skill is
  a project-local authoring guide referencing the canonical concept, not a claim
  that a compliant scaffold/runtime already exists. Root AGENTS.md requires use.

## Findings so far

- Cardmarket `allowedNextActions` used to come only from static action metadata;
  the current runtime adds state-aware availability when the browser reports state.
- Its legacy engine action type still accepts raw Page/POM handlers; the contract
  registry now supplies executable source/destination metadata around them.
- CLI errors used to expose only code/message/optional step; the current envelope
  preserves structured context and a typed recovery disposition.
- `SKILL.md` used stdin examples while the CLI accepted only regular files; the
  current CLI supports inline JSON and defaults absent input to `{}`.
- The builder and Cardmarket already have different runtime implementations.
- The Cardmarket contract registry now contains all 15 registered actions,
  including pure `status`; status and execution use the same state predicate.
- URL recognition is fail-closed to the documented `/en/Magic` surfaces;
  same-origin lookalike paths, credentials and external origins remain
  `unknown`.
- Seller-filter postconditions now read back every resolved field. Missing
  auth/DOM evidence, unknown offer condition/language mappings and settlement
  timeouts fail closed instead of silently defaulting or reporting a quote.
- Comparison navigation uses `gotoAllowed()` and POM readiness checks; the
  remaining raw `Page` boundary is the legacy action-handler type, not an
  unguarded navigation call.
- `assertReady` no longer performs hidden navigation, consent or login actions;
  login is a user-owned prerequisite and writes are never auto-replayed.
- `npm ci` succeeded for the pinned Cardmarket package; typecheck passed. After
  downloading the pinned Chromium binary and using the required host permission,
  all 58 package tests passed.
- 2026-09-08 live fixes (Cardmarket): the run-code browser vm has no `URL`
  global, so state detection was failing on valid Cardmarket URLs; added a
  require-free browser-safe URL parser (`src/lib/url.ts`) used by `state.ts` and
  `SitePage.ts`. `CardDetailPage.submitSellerFilters()` no longer blocks up to 30s
  on a navigation that never happens on the AJAX path — it races a real
  navigation against an observable seller-list update, so `nav.filter` is ~0.9s.
  `withLock` now reaps a dead/stale `.local/runtime.lock` (age `> lockStaleMs`
  or dead PID) before returning `BUSY`, preserving live locks. The legacy raw
  `playwright-cli` operator guidance (the source of tab churn) was superseded:
  `SKILL.md` now carries an explicit tab/session policy and the raw-transport
  pitfalls moved to `references/transport.md` (builder-level). Live `status`,
   `nav.home`, `nav.search`, `nav.open`, `nav.filter` verified working and fast;
   typecheck + 58-test suite + 45-link concept validator all pass.
- 2026-09-08 navigation clarity (Cardmarket): `availableActionDetails` now exposes
  `description`, `from`, `to` (happy-path destination) and `requiredInput` for every
  currently legal action, so a local operator AI can see where each action leads
  without guessing. `SKILL.md` adds a compact state→action→destination map backed by
  the same data. Live `status` at `detail` verified: `nav.versions`→versions,
  `nav.filter`→detail, `nav.home`→start, `nav.search`→results. typecheck + 58-test
  suite + concept validator all pass.

## Resume instructions

Read this file, `TODOs.md` item 2, and the design files beside this file. Inspect
`git diff` before continuing. Use the work queue and decision IDs; record newly
verified facts and unresolved choices. Do not interpret proposed behavior as
implemented or fixture results as live-browser verification.

## Deliverables and validation

- [concept.md](concept.md): full proposed enforcement contract.
- [typescript-design.md](typescript-design.md): rationale and extension rules.
- [ui-model.ts](ui-model.ts): dependency-free executable illustration.
- [migration.md](migration.md): source evidence, pressure-test matrix, current
  15-action mapping, ordered migration, relocation callers and empirical unknowns.
- [navigation-design.md](navigation-design.md): expanded difficult-case review,
  explicit playwright-cli transport, command ergonomics and extension acceptance.
- [ui-model.test.mjs](ui-model.test.mjs): 8 behavior tests, all PASS.
- [ui-model.type-test.ts](ui-model.type-test.ts): 4 expected compile-time
  rejections plus positive narrowing; strict compilation PASS with installed
  TypeScript 6.0.3. Repository-pinned TypeScript 5.8.3 was not available here.
- Node used: v24.19.0. No dependencies installed. An offline npm compiler lookup
  had no cached package; a compiler already installed with Angular CLI was used.
- Relative link check: current validator checks 45 links, all valid; all 15
  registered action files have migration entries. Whitespace check passed.
- The current slice has been typechecked and the complete 58-test package suite
  passed outside the sandbox. This is fixture/browser-process verification only;
  no Cardmarket live navigation or account write was performed.

Repeat the example tests from repository root:

```bash
node --experimental-strip-types --test docs/strict-automation/ui-model.test.mjs
```

With an available TypeScript compiler, repeat compile-only checks:

```bash
tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions docs/strict-automation/ui-model.ts docs/strict-automation/ui-model.type-test.ts
```

The illustration intentionally omits production schemas, browser adapter,
authorization, locking, journals and full envelopes. Passing these tests proves
only the illustrated state/availability/identity behavior, not runtime safety.

## Builder replacement evidence

- Baseline commit for restoring removed files:
  `e765e4fed44a02fd897d7fff92c9826bed6654d3`.
- New entrypoint: `.agents/skills/website-automation-builder/SKILL.md`.
- Mandatory route: root `AGENTS.md`; implicit host discovery not yet verified.
- Check: `node scripts/verify-website-concept.mjs`; `task test` adds UI-model tests.
- CI now has contract/model and Cardmarket jobs, including pinned-compiler model
  typechecking. No remote CI success is claimed.
- Global install task now selects Cardmarket explicitly so it does not install
  the project-local authoring skill with broken standalone concept links.
- Replacement validation: skill-creator `quick_validate.py` PASS; document/routing
  validator PASS (45 local links, 15 mapped actions); all 8 model tests PASS;
  strict TypeScript 6.0.3 compilation including four rejection assertions PASS.
- Updated Task commands dry-run successfully; Task/CI YAML parse PASS; modified
  JavaScript syntax checks and `git diff --check` PASS. No files remain at the
  old builder path, including empty directories.
- Setup audit resolves the correct repository using the new local skill path.
  It exits 1 because Cardmarket's locked npm dependencies are absent; Node/npm/
  Git/Task/playwright-cli checks pass. Inventory reports the extension installed,
  which is not proof of attachment. No browser session was attached or changed.
- Cardmarket source/package files now contain the partial contract migration.
  `npm ci`, typecheck and the complete suite were run locally; remote CI and live
  Cardmarket verification remain separate open gates.
