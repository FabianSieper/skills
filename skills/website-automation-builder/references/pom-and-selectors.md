# POM and selector contract

Keep maintainable TypeScript in src/pages, src/components and src/actions. Page objects own selectors, identity, state assertions and interactions. Components encapsulate reusable sections; actions own business flows and postconditions. Control-plane CLI and prompts contain no site selectors.

Each action exports `action: Action` from src/runtime/engine.ts. Keep id, kind, description, parameters, example, preconditions, postcondition, outputDescription, validateOutput and next. Reads implement run; writes implement prepare/execute. Register with `registerAction(action,new URL("./action.ts",import.meta.url))` in src/actions/index.ts. Module paths remain build-only metadata. Action IDs support camelCase segments, e.g. catalog.openProduct.

Browser bundles must have no Node imports, import.meta, require, browser launch or direct driver connections. Import Playwright types with `import type`. validateOutput executes inside the bundle after the POM verifies the business postcondition. Do not import Node hashing helpers into browser code.

The CLI runs the wrapper in a restricted JavaScript VM: URL, TextEncoder, Buffer and process are absent in the verified version. Use the supplied origin/output guards there. DOM/Web APIs are available inside fixed page.evaluate callbacks, which execute in the actual page. Test bundles in the restricted VM and a live CLI session.

## Locator priority

1. Observed stable, unique test ID.
2. Exact getByRole/name or getByLabel.
3. Business ID inside a uniquely identified container.
4. Stable short attribute with a recorded reason.

Test IDs are not automatically unique. Check every interaction target and its required container with uniqueVisible/clickUnique/fillUnique; count must be exactly one. A missing target is UI_DRIFT; multiple matches are AMBIGUOUS_SELECTOR. Race-time Playwright strictness still applies. Never select an ordinal when business identity is ambiguous.

No first/last/nth, long XPath, generated classes, force:true, coordinate clicks, arbitrary sleeps or silent locator fallbacks. Use observable state/attribute changes for waiting. navigate() checks configured origins before and after navigation. Add account and target guards immediately before the potentially committing interaction.

SitePage.assertReady validates known state, origin, auth/challenge markers and stable accountKey. Public workflows may use public; never fabricate an authenticated identity. Unknown states produce UNSUPPORTED_UI_STATE. detectState/regions/visibleData are pure observations and remain usable after failed domain assertions.

Discovery refs are temporary. Record real locator evidence, identity anchors and expected counts in references/selectors.md. Existing InventoryPage and demo assets are fixture selectors, never evidence about a real site.
