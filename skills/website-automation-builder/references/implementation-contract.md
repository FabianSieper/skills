# Implementation contract

## Target architecture
`Agent -> Website CLI -> Action Registry -> Browser Executor -> playwright-cli attached session -> bundled Action/POM -> existing Page`.

During normal use, the agent may select only an action ID and its parameters. It does not write click sequences or free-form `run-code` snippets. POMs own locators and UI operations; actions combine POM methods into business flows and verify postconditions.

## Browser contract: existing-browser-only
The browser is already open during normal skill use. This is a hard default.

- Default adapter: `attach --extension=chrome` with a fixed named session.
- Optional: `attach --cdp=chrome` or an explicit CDP endpoint, but only when deliberately configured and tested in the target skill.
- Never switch automatically between extension and CDP.
- Never use `playwright-cli open`, `close`, `close-all`, `kill-all`, or `chromium.launch` during normal runtime execution.
- If the browser is missing or cannot be attached, return `BROWSER_REQUIRED` or `ATTACH_FAILED`.
- If authentication is missing, return `AUTH_REQUIRED`; the user signs in through the already open browser. For MFA/CAPTCHA, return `HUMAN_REQUIRED`.
- Do not use a dedicated storage-state file by default. The browser profile, cookies, extensions, and login remain owned by the running browser.

`connect` may only establish a playwright-cli connection to the open browser. It never launches a browser. `list` and `describe` do not access the browser at all.

## Why bundling is required
`playwright-cli run-code --filename=...` expects a single function expression and does not accept normal `import/export/require` syntax in that file. The source structure therefore remains modular TypeScript, while `src/runtime/cli-browser.ts` creates a temporary, self-contained bundle for each invocation:

1. Bundle the action module, POMs, and `SitePage` with esbuild.
2. Embed validated input as a JSON data literal.
3. Write a single `async page => { ... }` expression to `.local/run-code/<uuid>.js`.
4. Execute it in the existing browser with `playwright-cli -s=<session> --raw run-code --filename=<file>`.
5. Parse the JSON result and delete the temporary file.

The agent does not generate this bundle. Never pass user input to shell code, `eval`, or module paths.

## Target structure
```text
<site>-automation/
  SKILL.md
  agents/openai.yaml
  package.json
  package-lock.json
  tsconfig.json
  site.config.ts
  src/cli.ts
  src/runtime/{errors,input,guards,cli-browser,engine,fingerprint}.ts
  src/pages/SitePage.ts
  src/pages/*.ts
  src/components/*.ts
  src/actions/*.ts
  src/actions/index.ts
  tests/*.test.ts
  examples/*.json
  references/{actions,flows,selectors,verification}.md
  references/build-state.json
  .local/                      # private; plans, attempt markers, temporary run-code
```

## Action module
Every action exports exactly one `action` object containing:
- `id`, `kind`, `description`, `parameters`, `outputDescription`
- `modulePath`: `fileURLToPath(import.meta.url)`
- `next`: registered permitted and useful subsequent actions
- `validateOutput`
- for reads: `run(page,input)`
- for writes: `prepare(page,input)` and `execute(page,input,preview)`

Example:
```ts
import { fileURLToPath } from 'node:url';
import type { Action } from '../runtime/engine.ts';
import { SearchPage } from '../pages/SearchPage.ts';

export const action: Action = {
  id: 'catalog.search',
  kind: 'read',
  modulePath: fileURLToPath(import.meta.url),
  next: ['catalog.open-result'],
  description: 'Search catalog by exact query.',
  parameters: { query: {type:'string',description:'Query',required:true,min:1,max:100} },
  outputDescription: 'Bounded search results.',
  run: (page,input) => new SearchPage(page).search(input.query as string),
  validateOutput: value => validateSearchResult(value)
};
```

`next` is part of the agent contract. The result includes `allowedNextActions`; smaller models should choose the next step from this list instead of exploring the website again. An empty list means the flow is complete or a new user request is required.

## CLI contract
```bash
npm run --silent cli -- list
npm run --silent cli -- describe catalog.search
npm run --silent cli -- connect
npm run --silent cli -- doctor
npm run --silent cli -- run catalog.search --input examples/search.json
npm run --silent cli -- plan item.update --input /private/update.json
npm run --silent cli -- execute --plan <plan-id> --approve <approval-hash>
```

`run` is for reads only. `plan` is for write/prepare only. `execute` requires a stored preview and approval hash. After a possible commit, set a permanent attempt marker; never repeat an uncertain commit.

## POM and locator contract
POMs encapsulate locators, state anchors, and elementary website operations. Actions contain the business sequence and postconditions. POMs contain no CLI or agent logic.

Locator priority:
1. a stable, observed `data-testid` or test-ID contract,
2. an exact role/name or label,
3. a unique business container plus semantic target,
4. a short stable attribute with documented justification.

Every individual target must produce exactly one match. A test ID is not proof of uniqueness. Use `uniqueVisible`, `clickUnique`, and `fillUnique`. Do not repair ambiguity with `.first/.last/.nth`, generated CSS classes, XPath chains, coordinates, `force:true`, `waitForTimeout`, or silent fallback chains.

Snapshot references such as `e14` are discovery aids only and must not be stored as permanent POM selectors.

## State, tabs, and navigation
`SitePage.assertReady()` verifies the domain, relevant page state, login/account, and known blocked states. Login alone is insufficient to establish account identity.

Only the concrete action may create new tabs or popups, and it must identify them deliberately; never close unrelated tabs. Check the current tab and origin before executing an action. The runtime adapter must not clean up the open browser or manage its other tabs.

## Write contract
`prepare` must not trigger a business mutation or autosave. The preview includes at least the target identity/state version and the proposed changes. Immediately before committing, `execute` verifies the account and preview again. After the commit boundary, every ambiguous error becomes `UNKNOWN_COMMIT`.

## Errors and fallbacks
Never fall back automatically to free-form browser control. In particular:
- `UNKNOWN_ACTION`: extend the builder.
- `UI_DRIFT`/`AMBIGUOUS_SELECTOR`: repair the POM.
- `BROWSER_REQUIRED`/`ATTACH_FAILED`: provide the open browser, extension, or CDP connection.
- `CLI_PROTOCOL`: repair CLI/runtime compatibility.
- `AUTH_REQUIRED`/`HUMAN_REQUIRED`: let the user take over in the existing browser.

Never retry an entire write action. Retry reads only when their safety has been documented.
