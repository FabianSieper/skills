---
name: website-automation-builder
description: Build or repair a deterministic website skill backed by registered TypeScript/Playwright actions. Use when repeatable website work must run through a CLI against the user's existing browser. The result never improvises UI steps, launches a browser, or performs an unapproved write.
---

# Website Automation Builder

Create one `<site>-automation` skill. Normal use is fixed:
`intent -> registered action -> validated input -> attached browser -> verified JSON`.
Discovery may use raw `playwright-cli`; the finished skill may not.

## Workflow

Follow `PRECHECK -> INPUT -> DISCOVER -> BUILD -> VERIFY -> HANDOFF`. Update `references/build-state.json` after each phase; block only the affected action.

### PRECHECK

Run `node "<BUILDER_ROOT>/scripts/preflight.mjs"`. The browser must already be open and attachable through the configured extension or CDP endpoint. Never launch, replace, restart, or close it.

### INPUT and DISCOVER

Read [references/intake-and-discovery.md](references/intake-and-discovery.md). Define each action before exploring. Ask for the user's route or a screenshot when business paths differ, prerequisites are unknown, a risky step is near, or two targeted attempts fail.

Record only observed locators, identity anchors, starting state, and postconditions. Never bypass bot protection.

### BUILD

Read [references/implementation-contract.md](references/implementation-contract.md), then scaffold:

```bash
node "<BUILDER_ROOT>/scripts/scaffold.mjs" --name <site>-automation --url https://example.org --out "<TARGET_ROOT>/<site>-automation"
cd "<TARGET_ROOT>/<site>-automation" && npm install
```

Implement `SitePage`, POMs, one module per action, the registry, tests, `SKILL.md`, and `references/actions.md`. Use the read and write examples in `assets/examples/` as shapes, never as observed selectors.

### VERIFY and HANDOFF

Read [references/verification.md](references/verification.md). Run `npm run verify`; it is the handoff gate. Live-test safe reads and only explicitly approved test writes. Login, MFA, and CAPTCHA remain with the user.

Handoff only when validation reports `status: ready`. Unknown actions or UI drift return to this builder; they never trigger improvised navigation.

Do not distribute `.local`, `node_modules`, profiles, cookies, traces, credentials, DOM dumps, or personal test data.

## Resources

- [Implementation contract](references/implementation-contract.md): action/runtime rules.
- [Verification](references/verification.md): required evidence.
- [Technical sources](references/sources.md): version-sensitive upstream documentation.
