---
name: {{SLUG}}
description: Run the documented actions on {{HOST}} through predefined TypeScript/Playwright functions in the user's existing browser. Never use for free-form navigation or another website. BUILD_REQUIRED: add supported user intents.
---

# {{SLUG}}

Use only registered actions: `intent -> list/describe -> validated input -> action -> verified JSON`. Never invent `snapshot`, `click`, `fill`, `goto`, or `run-code` sequences. `UNKNOWN_ACTION`, UI drift, or ambiguity returns to the builder.

## Browser

The configured browser is already open. Attach to its fixed named session; never launch, replace, restart, or close a browser. The user handles login, MFA, and CAPTCHA. A missing connection is a user prerequisite, not permission to create another browser.

Requires Node.js >=22.16, `playwright-cli` on PATH, and `npm ci`. Run from the absolute skill directory:

```bash
npm run --silent cli -- list
npm run --silent cli -- describe <action-id>
npm run --silent cli -- connect
npm run --silent cli -- doctor
npm run --silent cli -- run <read-action> --input <file.json>
npm run --silent cli -- plan <write-action> --input <file.json>
npm run --silent cli -- execute --plan <plan-id> --approve <approval-hash>
npm run --silent cli -- cleanup
```

`list`, `describe`, and `cleanup` are browser-free. Every result names `allowedNextActions`; choose only from that list. An empty list means stop.

For writes, `plan` does not authorize execution. Show the exact preview and stop. Run `execute` only after the user explicitly approves that plan. Never retry `PLAN_USED` or `UNKNOWN_COMMIT`; inspect state through a registered read action.

Follow the returned `error.recovery`:

- `fix-input`: use `describe`; do not guess.
- `user-action`: ask for the stated browser, authentication, human, or approval step.
- `replan`: create and show a new preview.
- `repair`: return to the builder.
- `inspect-state`: diagnose safely; never retry a write automatically.

## Actions

BUILD_REQUIRED: list every registered action ID and its user intent. Full machine-readable contracts come from `describe`; verification evidence is in `references/actions.md`.

`.local` is private and must never be uploaded. Do not expose profiles, cookies, credentials, plans, traces, DOM dumps, or personal data.
