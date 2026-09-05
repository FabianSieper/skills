# Builder validation

## Current status
The builder now uses the architecture `registered action -> esbuild bundle -> playwright-cli run-code -> existing attached browser`.

Verified static invariants:
- The target template contains no runtime invocation of `chromium.launch` or `playwright-cli open`.
- Browser configuration requires an existing Chrome session and a fixed attach method.
- `list` and `describe` are browser-free; `connect` is attach-only.
- The action contract includes `modulePath` and `next`/`allowedNextActions`.
- Temporary run-code files are stored under `.local` and deleted after invocation.
- The `run-code` wrapper is a single function expression; modular POMs are bundled.

Live acceptance against a real website and the locally installed `playwright-cli` is intentionally the responsibility of every generated website skill. The builder environment has no already open user browser and cannot verify that integration on the target skill's behalf.
