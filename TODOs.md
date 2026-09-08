# TODOs
This file contains todo-prompts which are to be executed in the future

1. Some commands take wy longer than they should. like changing filter at a public card details site to see offers
   - **DONE (2026-09-08).** Root cause: `CardDetailPage.submitSellerFilters()` waited up to 30s for a navigation that never happens on the AJAX/no-navigation path. Now it races a real navigation against an observable seller-list update (DOM fingerprint + loader check) and returns as soon as either fires. Live `nav.filter` is ~0.9s; `nav.open`/`nav.search` verified fast.

2. Oft werden viele tabs geöfnet und wieder geschlossen. der agent muss noch mehr geleitet werden in der navigation von tabs und wann sie zu öffnen sind, dass lieber exsitrende debug gruppen verwendet werden sollen als neue zu erstellen
   - **DONE (2026-09-08).** The tab churn came from the legacy raw `playwright-cli` approach (repeat `attach`/Welcome tabs, `tab-new`). That guidance is superseded: `SKILL.md` now has an explicit tab/session policy (only the shared `chrome` session is touched; never launch/attach/close/kill/`tab-new`; reuse the existing debug tab group) and the raw-transport pitfalls moved to `references/transport.md` (builder-level only). The strict CLI reuses the bound session and never creates tabs.
