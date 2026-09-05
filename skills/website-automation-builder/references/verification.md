# Verification

Run the builder's scaffold tests and full demo runner:

```bash
node scripts/test-scaffold.mjs
node scripts/test-demo.mjs
```

The demo runner creates a new temporary skill through scaffold --demo, installs pinned build/test dependencies, runs typecheck, build, unit tests, process integration tests, records evidence and runs validate. It preserves the output path for inspection. All runnable scripts must be executed, including preflight and the fixture server smoke test.

For every real generated skill run npm run verify. Validation checks configuration, registry closure, observed documentation, per-action build state, source/build fingerprint, precompiled artifact integrity, browser-safe output and prohibited automation patterns. A blank scaffold must not report ready.

Required test matrix:

- Browser: extension attach; exact attached named session reuse; no browser BROWSER_REQUIRED; failed attach ATTACH_FAILED; incompatible/managed session rejected; wrong CLI version; no launch/headless/close fallback.
- Actions: browser-free list/describe; invalid/unknown input before transport; valid read; precompiled artifact actually executed; no compiler or sources/node_modules in portable Runtime; correct next; tampered bundle rejected.
- Observe: bounded status/inspect; region isolation; unknown region; optional screenshot; diagnostic accessibility; page state unchanged by all observe paths.
- Drift: missing and ambiguous locators; unknown state; defined recovery through observation; raw navigation commands rejected.
- Write: pure plan; exact approval; expiry/config/account/target/version changes; postcondition; durable attempt/replay protection; lost or invalid commit response becomes UNKNOWN_COMMIT; reread before new plan.

Mock transport integration must invoke a subprocess with the actual generated wrapper and evaluate its compiled code against a deterministic fixture Page. This verifies protocol and dispatch, not Chrome. Separately record real installed playwright-cli version, extension attach, session reuse and live read evidence. Never start a browser for tests. If attach is blocked by the environment, record the exact failure and do all browser-free checks.

In references/build-state.json, each action needs mapped=true, implemented=true, fixture=pass, and live=pass or live=not-run with a concrete remainingRisk. Mirror evidence in actions/verification references. HANDOFF requires validation ready; ready with live limitations must say so explicitly.

Live writes only in an authorized fixture/staging flow or after explicit approval of the exact plan. Leave the user's browser and unrelated tabs open. Exclude .local, node_modules, profiles, cookies, raw snapshots and secrets from delivery.
