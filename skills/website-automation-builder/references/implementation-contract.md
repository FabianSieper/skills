# Implementation contract

The agent selects an action ID and parameters. POMs own selectors and UI operations; actions own business sequences and postconditions. Runtime code attaches only to the configured named session and sends a browser-safe bundled function to `playwright-cli run-code --filename`.

## Action

Each `src/actions/<id>.ts` exports only `action`. Required metadata is returned by `describe`, so keep it concrete:

```ts
export const action:Action={
  id:'catalog.find',kind:'read',next:[],
  description:'Find one item by exact SKU.',
  preconditions:['Authenticated catalog is reachable.'],
  postcondition:'Returned SKU equals the query, or not-found is explicit.',
  parameters:{sku:{type:'string',description:'Exact SKU',required:true,min:1,max:64}},
  example:{sku:'SKU-42'},
  outputDescription:'Exact item or null.',
  run:(page,input)=>new CatalogPage(page).find(input.sku as string),
  validateOutput:value=>validateItem(value)
};
```

Register paths only in `src/actions/index.ts`; never put `import.meta`, Node APIs, or `modulePath` in an action:

```ts
import {registerAction} from '../runtime/engine.ts';
import {action as find} from './catalog.find.ts';
export const actions=[registerAction(find,new URL('./catalog.find.ts',import.meta.url))];
```

`next` may contain only registered actions that are useful from the resulting state. Empty means stop. Keep outputs small and limited to documented fields.

## POMs

Put page/component operations in `src/pages` or `src/components`. Locator order:

1. observed stable test ID;
2. exact role/name or label;
3. business identifier scoped to a unique container;
4. short stable attribute with justification.

Use `uniqueVisible`, `clickUnique`, `fillUnique`, and `navigate`. Never use `.first/.last/.nth`, generated classes, XPath chains, coordinates, `force:true`, sleeps, or silent fallback selectors. Each target must match exactly once.

`SitePage.assertReady()` must verify allowed origin, expected state, account/role, and known login/challenge markers. Return a stable `accountKey`; use `public` only for genuinely public flows. Fail closed on the wrong tab. Actions may open a popup only when the contract requires it; identify it and never close unrelated tabs.

## Writes

A write exports:

```ts
prepare(page,input) => {target:{...},version:'observed-state',changes:{...}}
execute(page,input,preview) => verifiedResult
```

`prepare` must not mutate or autosave. `plan` returns a preview and requires the agent to show it and stop. `execute` is allowed only after explicit user approval of that exact plan. The runtime rechecks account and preview in the same browser invocation immediately before commit, creates a durable local attempt marker, and converts any post-boundary failure to `UNKNOWN_COMMIT`.

The approval hash binds data; it cannot prove who authorized it. User authorization is therefore an orchestration boundary, not a security identity mechanism.

## Failure rules

- Browser/auth/human errors: request the indicated user action.
- Input/plan errors: correct input or create a new plan.
- UI, output, registry, bundle, or protocol errors: return to the builder.
- `PLAN_USED` or `UNKNOWN_COMMIT`: inspect with a registered read; never repeat the write.
- Never fall back to raw browser commands during normal use.

Plans and temporary bundles may contain input data. They stay mode-restricted under `.local`; completed/uncertain plans and temporary bundles are removed. `cleanup` removes expired plans and leftovers without deleting attempt markers.
