---
name: demo-automation
description: Use registered website actions and compact browser observation on 127.0.0.1:4173 in the user's already-open browser. Search inventory by SKU and plan an item title update in the local demo fixture.
---

# demo-automation

Use the local CLI from this skill directory (Node >=22.16 and playwright-cli on PATH). The distributed runtime is precompiled; no npm install is needed for normal use.

```bash
node scripts/site-runtime.mjs list
node scripts/site-runtime.mjs describe <action>
node scripts/site-runtime.mjs run <read-action> --json '{}'
node scripts/site-runtime.mjs status
node scripts/site-runtime.mjs inspect
node scripts/site-runtime.mjs inspect-region <known-region>
node scripts/site-runtime.mjs screenshot
node scripts/site-runtime.mjs doctor
node scripts/site-runtime.mjs plan <write-action> --json '{}'
node scripts/site-runtime.mjs execute --plan <plan-id> --approve <approval-hash>
```

Choose registered actions first. Use list/describe only when the action or its parameters are unknown. Work from structured data and next; an empty next ends that flow. Observe only when needed. Observation remains available in every state.

The user's browser is already open. The CLI attaches to its fixed named session; it never starts, replaces or closes a browser. The user handles login/MFA/challenges. BROWSER_REQUIRED or ATTACH_FAILED requires fixing that prerequisite.

Normal Runtime never uses raw clicks, selectors, eval, run-code or improvised navigation. On UI_DRIFT/UNSUPPORTED_UI_STATE, observe; use an applicable known recovery action or report that repair is needed. `inspect --mode diagnostic` adds bounded details without mutation. Only an explicit build/repair/extension task enters Builder mode; never create automation during an ordinary action request.

For writes, show the exact plan/account/target/change and obtain explicit user approval before execute. The approval hash binds the plan; it is not approval by itself. Never retry UNKNOWN_COMMIT or PLAN_USED: reread state first.

For sensitive/long input use `--input file.json` instead of --json. Keep .local private; screenshots and plans must not be distributed. Development and verification evidence is in references/.
