# Verification

`npm run verify` must pass. It checks types, unit tests, registry closure, examples, browser-safe bundles, required files, forbidden selector patterns, documentation, build state, and the package lock.

Add action tests for:

- success, invalid input, explicit empty/missing result, output shape, and postcondition;
- every locator matching exactly once in its real state;
- authentication, human-intervention, wrong-tab, and UI-drift states;
- writes: non-mutating preview, changed account/version, approval, replay prevention, and uncertain commit.

Then verify the configured adapter:

1. `list` and `describe` work without browser access and expose complete contracts.
2. `connect` and `doctor` attach the existing named session; `doctor` proves `run-code` and the current origin.
3. A missing browser returns `BROWSER_REQUIRED`; an incompatible or managed same-name session returns `ATTACH_FAILED`.
4. Read actions pass twice from a known start state. Writes run only in staging/test or with explicit approval.
5. The browser remains open and unrelated tabs are unchanged.

Record per action in `references/actions.md`: environment and CLI version, fixture/live result, postcondition evidence without secrets, and remaining risk. Mirror its status in `references/build-state.json`; live `not-run` requires a concrete risk.
