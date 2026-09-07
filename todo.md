# TODO

1. **Bulk price update by card name** — add a name-based bulk price update
   action for own offers (`stock.bulk-price-by-name`) that is fast and can
   resolve/confirm offers by name; registers the action, adds output types,
   updates docs/examples, keeps `plan` → approve → `execute` contract.
2. **Own offer price deviation check** — document the process (flows/SKILL) to
   detect own offers significantly over- or underpriced versus the market
   (via `stock.market-comparison`) and adjust them with the command from #1.
3. **Fix always-failing GitHub check** — (a) format
   `skills/website-automation-builder/assets/site-template/src/runtime/observation.ts`
   with Prettier, (b) add `npm --prefix "$target" run build` before `test` in
   `.github/workflows/test.yml`; verify locally by replaying the workflow.
4. **Own offers search via Singles filter UI** — add guidance in SKILL.md and
   flows.md that card searches within own offers must use the Singles filter
   UI (`nav.own-offers.filter`), not ad-hoc navigation.
