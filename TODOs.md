# TODOs
This file contains todo-prompts which are to be executed in the future

3. The website-automation-builder should describe the target architecture and progress. The cardmarket automation was built without the target architecture of website-automation-builder in mind. The website-automation-builder and the architecture of the cardmarket automation should match.

**Divergence analysis (completed):**

Cardmarket uses a lean runtime: raw Node + `--experimental-strip-types`, no build step, no `manifest.ts`, no `observation.ts`, no esbuild bundle, no `runtime/manifest.json`, no prebuilt artifacts, no observe actions. The builder template (`assets/site-template/`) has all of these plus extra error codes (`UNSUPPORTED_UI_STATE`, `UNKNOWN_REGION`, `BUILD_REQUIRED`). Cardmarket also uses `AutomationError` while the builder template uses a different error class. The builder's `validate-build.ts` and `scripts/site-runtime.mjs` (esbuild) have no cardmarket counterpart.

**Recommendation:** The cardmarket runtime is intentionally simpler (no build step needed since it runs directly under Node). The builder template is the "full" target architecture for new sites. Rather than adding the builder's build step to cardmarket, the builder docs should document both the minimal runtime (cardmarket-style) and the full runtime (template-style), and note which features each supports. The error code divergence should be reconciled: either cardmarket adopts the builder's error codes or the builder documents the cardmarket subset. No code changes are strictly required for correctness.

4. ~~Bulk update of card prices should be possible, where each card is set its independent new price~~ — **Done.** `stock.bulk-price-update` action implemented with parallel `articleIds` + `prices` arrays, plan/execute write flow, per-card form verification, and output verification.
