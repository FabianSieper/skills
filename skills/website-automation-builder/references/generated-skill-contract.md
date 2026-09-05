# Generated skill and distribution

Required layout:

```text
SKILL.md
scripts/site-runtime.mjs          # compiled Node entry point
runtime/manifest.json
runtime/actions/*.js              # domain + observation bundles
src/pages/ src/components/ src/actions/
src/runtime/ src/build.ts src/validate-build.ts
site.config.ts package.json package-lock.json tsconfig.json
references/actions.md flows.md selectors.md verification.md build-state.json
tests/
```

SKILL.md is a short control plane: use known actions, list/describe progressively, observe when needed, follow next, require the already-open browser, never launch/close it, no raw runtime navigation, observe/diagnose/repair on drift, exact plan approval for writes. Do not enumerate the whole registry or teach Playwright/bundling/selectors there.

References contain development details and evidence. No agents/openai.yaml, custom tool definitions, MCP configs, harness SDKs or harness permissions are necessary in the generated skill. Copy the directory to any skill location understood by an agent; local process execution is sufficient.

During build use npm install/ci, npm run build, npm run verify. Shipping the compiled scripts/runtime allows browser-free list/describe and normal actions without node_modules or src. Keep src in the full handoff for repair. Runtime manifest and bundles are generated artifacts; edit TypeScript and rebuild, never hand-edit the deployed bundle.

The scaffold intentionally starts unconfigured. --demo overlays a deterministic local inventory fixture with two example actions and a static localhost server. It is a test skill, not verified automation for a public website. Run the demo verification before marking evidence pass.
