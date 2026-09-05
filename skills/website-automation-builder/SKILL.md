---
name: website-automation-builder
description: Create or extend a reusable website skill whose agent selects only registered website actions while TypeScript/Playwright POMs perform the concrete navigation. Completed actions run through playwright-cli in the user's already open browser, using the Chrome extension with a named session by default; never launch a separate browser. Use when a website must be automated and the result stored as a dedicated, deterministic skill. Clarify actions and success criteria, ask targeted questions about difficult flows, implement robust unique locators, and test the completed action contracts.
---

# Website Automation Builder

## Target architecture
Create a standalone `<site>-automation` skill for each website, using TypeScript POMs and registered actions. Keep **builder/exploration** strictly separate from **normal use**.

During subsequent use, the LLM must not reinterpret the website or improvise click sequences. It follows only:
`User intent -> documented action ID -> validated parameters -> runtime -> playwright-cli -> prebuilt POM/action function -> verified JSON`.

The runtime uses the **user's already open browser**. An open browser is the default and a hard prerequisite. Never launch a managed/headless browser or open a replacement browser during normal skill execution. Default adapter: `playwright-cli attach --extension=chrome` with a fixed named session; use CDP only when it is explicitly configured and tested in the target skill. The CLI can execute `run-code --filename`; modular TypeScript POMs and actions are therefore bundled deterministically into a single function expression.

## Required workflow
Follow `INPUT -> DISCOVER -> BUILD -> VERIFY -> HANDOFF` strictly. Track each action as `unclarified | mapped | implemented | fixture_verified | live_verified | blocked` in `references/build-state.json`.

### 1. INPUT
Read `references/intake-and-discovery.md`. Clarify the website, concrete actions, inputs, outputs, read/write status, success criteria, and permitted mutations. Do not ask again about the browser assumption: Chrome is open by default and must be reused.

When a task is not straightforward to automate unambiguously from a business or navigation perspective, ask the user about their flow: how they reach the relevant area, which click sequence they use, or request a screenshot. Ask immediately when several plausible business flows exist, prerequisites are unclear, or exploration would require a risky step; ask no later than after two targeted failed attempts or five minutes without progress for an action. Block only the affected action.

### 2. DISCOVER
Explore agreed actions deliberately. Direct playwright-cli commands and snapshots are allowed during this phase to understand the flow and identify robust locators. Prefer the already open browser; do not bypass bot protection or build evasion techniques.

For every interaction, document the POM method, locator, scope, expected match count, business identity, state anchor, and verifiable postcondition.

Locator priority:
1. a stable, observed test-ID contract,
2. an exact semantic locator (`getByRole`, `getByLabel`),
3. a business identifier inside a unique container,
4. a short stable attribute with documented justification.

A test ID is not automatically unique: every individual target must produce exactly one match in the relevant state. Do not repair ambiguity with `.first()/.nth()`, generated CSS classes, XPath chains, coordinate clicks, `force:true`, sleep loops, or silent locator fallback chains.

### 3. BUILD
Read `references/implementation-contract.md`. Scaffold:

```bash
node "<BUILDER_ROOT>/scripts/scaffold.mjs" --name <site>-automation \
  --url https://example.org --out "<TARGET_ROOT>/<site>-automation"
cd "<TARGET_ROOT>/<site>-automation"
npm install
```

Do not require a browser download at runtime. The target project contains `site.config.ts` with a fixed browser session and attach method. Normal runtime code must never invoke `chromium.launch`, `playwright-cli open`, `close`, `close-all`, or `kill-all`.

Architecture:
`CLI -> Action Registry -> Browser Executor -> playwright-cli named attached session -> bundled Action/POM code -> existing Page`.

Implement POMs in `src/pages/` and `src/components/`, with one module per action in `src/actions/`. Action metadata must include `id`, `kind`, schema, `modulePath`, an output validator, and `next`. `next` describes permitted and useful subsequent actions for smaller models.

`run-code` does not accept normal imports in the provided file. Therefore, `src/runtime/cli-browser.ts` bundles the TypeScript module and SitePage with esbuild and writes a single function expression temporarily to `.local/run-code/`. Inputs are schema-validated first and embedded as data literals; the agent never writes free-form run-code text.

Write actions remain `prepare -> user approval -> execute`, with preview, account, and version comparisons plus a permanent attempt marker. Never retry automatically after a possible commit.

### 4. VERIFY
Read `references/verification.md`. Run type checking and tests. For each action, test success, invalid input, empty or missing results, selector uniqueness, postconditions, authentication/human states, and permitted next actions.

Also test all of the following:
- `list` and `describe` work without browser access.
- With the browser already open and the correct extension/CDP connection, `connect` and `doctor` attach without launching a browser.
- With the browser closed or not attachable, return `BROWSER_REQUIRED` or `ATTACH_FAILED` without falling back to `open`, managed, or headless modes.
- `run`, `plan`, and `execute` use only the named session.
- The temporary run-code bundle is a single function expression and contains the bundled POMs.
- Normal action execution requires neither snapshot-reference sequences nor LLM-generated Playwright commands.
- `allowedNextActions` matches the registry and documentation.

Run live tests only for safe reads or explicitly approved test mutations. The user handles login, MFA, and CAPTCHA in the existing browser.

### 5. HANDOFF
Complete the website skill with concrete action IDs, examples, preconditions, outputs, postconditions, error responses, and `allowedNextActions`.

The finished skill must state explicitly: **The browser is already open; the skill attaches to it; the skill never launches or closes a browser.** An unknown action or UI drift returns control to the builder rather than triggering free-form browser navigation.

Never distribute `.local`, browser profiles, cookies, traces, `node_modules`, or personal data with the package.

## Resources
- `references/intake-and-discovery.md`: intake, clarification, and discovery budget.
- `references/implementation-contract.md`: required runtime, POM, and CLI architecture.
- `references/verification.md`: acceptance and regression tests.
- `references/sources.md`: technical sources.
- `assets/site-template/`: target skill scaffold.
- `assets/examples/`: POM and action examples; patterns only.
