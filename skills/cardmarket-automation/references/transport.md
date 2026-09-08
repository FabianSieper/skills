# Browser transport — builder notes

This is builder-level documentation, **not** operator guidance. The operator only
runs the closed CLI (`npm run cli -- ...`). The CLI wraps the shared
`playwright-cli` session `chrome` and issues **atomic** `run-code` calls
(`.local/run-code/<uuid>.js`, invoked with `--raw run-code --filename=<path>`),
so the raw-browser failure modes below never surface to the operator.

These notes explain *why* the transport is atomic and why an agent must never
drive `playwright-cli` by hand. They apply only if you are repairing the
transport or the POM.

## Raw `playwright-cli` failure modes (avoid by staying on the closed CLI)

1. **`press Enter` on Cardmarket forms navigates to `about:blank`.** Cardmarket
   uses JS-based navigation; a form Enter submit is broken and lands on
   `about:blank`, breaking the session. Reproducible: a separate `fill` followed
   by a separate `press Enter` → URL `about:blank`.
2. **Refs are snapshot-local.** A ref (e.g. `f9e207`) is valid only for the
   `snapshot` it came from. After any navigation (including `about:blank`) all
   refs are dead; a later `click <ref>` fails with "Ref not found". A new
   `snapshot` is required after every navigation.
3. **Each CLI call is an independent process with its own WebSocket relay.**
   `fill` + `click` split across two `playwright-cli` invocations is not
   atomic and can interleave with navigation. Compound actions must run in a
   single `run-code` invocation: `run-code 'async (page) => { ... }'`.
4. **`attach` is one-shot.** Every `attach` opens a new Playwright Welcome tab
   and a new relay port. While a session exists, re-attaching spawns another
   Welcome tab and a second client that cannot reuse the same tabs ("already
   connected to another client"). Always `playwright-cli list` first and reuse
   the `chrome` session; never `attach`/`detach`/`close`/`close-all`/`kill-all`
   while a session exists.
5. **Inline `run-code` must be an Arrow Function.** `run-code 'console.log(...)'`
   fails with a `SyntaxError`; the code must be `async (page) => { ... }` with
   no plain top-level statements. The CLI's `--filename` path avoids this.

## Why the closed CLI avoids all of these

- It writes one JS file per action and runs it with a single
  `--raw run-code --filename=<path>` call, so every action is atomic (fixes 1,
  3 and 5).
- POM code targets stable CSS locators, not snapshot refs, so navigation never
  orphans a ref (fixes 2).
- The engine reuses the bound `chrome` session and never re-attaches while a
  session exists (fixes 4).

If you change the transport, re-verify with `npm run typecheck`, `npm test` and
a live `status` + `nav.search` run, and keep these guarantees intact.
