# TODO

1. **Bulk price update by card name** — add a name-based bulk price update
   action for own offers (`stock.bulk-price-by-name`) that is fast and can
   resolve/confirm offers by name; registers the action, adds output types,
   updates docs/examples, keeps `plan` → approve → `execute` contract.
2. **Own offer price deviation check** — document the process (flows/SKILL) to
   detect own offers significantly over- or underpriced versus the market
   (via `stock.market-comparison`) and adjust them with the command from #1.
3. **Old builder CI issue superseded (2026-09-08)** — the legacy scaffold was
   removed. CI now checks concept wiring, the illustrative UI model and the
   maintained Cardmarket package. New canonical scaffold verification is tracked
   in `docs/strict-automation/todo.md`; no remote CI pass is claimed here.
4. **Own offers search via Singles filter UI** — add guidance in SKILL.md and
   flows.md that card searches within own offers must use the Singles filter
   UI (`nav.own-offers.filter`), not ad-hoc navigation.
