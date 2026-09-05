---
name: {{SLUG}}
description: Run only the documented actions on {{HOST}} through predefined TypeScript/Playwright POM functions that attach to an already open browser through playwright-cli. Use for the specifically documented website actions in this skill. Do not use for free-form browser navigation or other websites.
---

# {{SLUG}}

## Execution model
Use registered actions only. The agent decides **which** action is needed and supplies validated parameters; the included TypeScript implementation decides **how** to navigate, locate, click, read, and verify.

Fixed path:
`User intent -> list/describe -> registered action -> input validation -> attached playwright-cli session -> bundled POM/action function -> postcondition -> compact JSON`.

During normal use, do **not** invent free-form `snapshot/click/fill/goto/run-code` sequences. Raw CLI navigation is allowed only for building and debugging. On `UNKNOWN_ACTION`, `UI_DRIFT`, or `AMBIGUOUS_SELECTOR`, stop and use the builder for a targeted extension or repair.

## Browser invariant
The browser is **already open** by default when this skill is used. This is a prerequisite, not an optimization.

- Never launch, restart, or close a browser, and never replace it with a managed/headless browser.
- Default: attach to the already open Chrome instance through `playwright-cli attach --extension=chrome` using a fixed named session.
- `site.config.ts` may explicitly configure `cdp` instead; never switch automatically between extension and CDP.
- Before the first action, run `npm run --silent cli -- connect` or invoke the action directly; the runtime attaches the named session if it does not yet exist.
- If the browser is not open or attachable, return `BROWSER_REQUIRED` or `ATTACH_FAILED`; the user must open the configured browser or establish the existing extension/CDP connection.
- The user handles login, MFA, or CAPTCHA in the already open browser, then runs the same action again. Do not create a session file or password automation.
- Never call `playwright-cli close`, `close-all`, `kill-all`, or `open` from this skill.

The runtime uses `playwright-cli run-code --filename=...` internally only. Because `run-code` does not accept `import/export/require` syntax in the input file, modular TypeScript POMs and actions are bundled with esbuild into a single function expression before invocation. The agent does not create this function itself.

## Prerequisites
**BUILD_REQUIRED:** Remove only after SitePage, POMs, actions, examples, and verification are complete.

Requires Node.js >= 22.16, `playwright-cli` on PATH, an already open configured browser, and a working extension or CDP connection. Setup: `npm ci`. Normal skill execution does not require `npx playwright install chromium`.

Always run commands from `<ABSOLUTE_SKILL_DIRECTORY>`.

```bash
npm run --silent cli -- list
npm run --silent cli -- describe <action-id>
npm run --silent cli -- connect
npm run --silent cli -- doctor
npm run --silent cli -- run <read-action> --input <file.json>
npm run --silent cli -- plan <write-action> --input <file.json>
npm run --silent cli -- execute --plan <plan-id> --approve <approval-hash>
```

`list` and `describe` do not access the browser. `connect` only attaches to the already open browser and never launches a new one.

## Supported actions
List only IDs that are actually implemented.

| User intent | Action ID | Read/Write | Example input | Verification status |
|---|---|---|---|---|

Complete contracts: `references/actions.md`.

Every successful action also returns `allowedNextActions`. Treat this list as the preferred navigation space for the next step; do not invent an unregistered subsequent action.

## Errors: required response
| Code | Response |
|---|---|
| INVALID_INPUT / UNKNOWN_ACTION | Read the contract or add the missing action with the builder; do not guess |
| BROWSER_REQUIRED / ATTACH_FAILED | The user must provide the configured already open browser/attach connection; do not launch a replacement browser |
| AUTH_REQUIRED / HUMAN_REQUIRED | Let the user complete login/MFA/CAPTCHA in the existing browser |
| UI_DRIFT / AMBIGUOUS_SELECTOR / POSTCONDITION_FAILED | Stop and repair the affected POM/flow with the builder |
| CLI_PROTOCOL | Stop and check CLI/runtime compatibility; do not use free-form CLI navigation as a fallback |
| PLAN_CHANGED / PLAN_EXPIRED | Create a fresh preview and verify it again |
| APPROVAL_REQUIRED | Verify the concrete preview and user approval |
| PLAN_USED / UNKNOWN_COMMIT | Do not repeat; inspect the business state with a registered read action |
| BUSY | Inspect the running process; do not delete the lock blindly |
| TIMEOUT / INTERNAL | Stop and diagnose safely; do not retry writes automatically |
| NOT_CONFIGURED | The builder must complete the implementation |

Exit codes: 0 success, 2 input/contract, 3 browser/authentication/user/approval, 4 UI/runtime, 5 uncertain or already attempted commit.

## Privacy and boundaries
`.local` contains plans, attempt markers, and temporary `run-code` bundles; never commit or upload it. Browser profiles, cookies, and login data stay in the user's already open browser and are not exported by the skill. Do not bypass bot protection, add evasion techniques, or guarantee success after website changes.
