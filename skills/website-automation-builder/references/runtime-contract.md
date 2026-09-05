# Runtime contract

The public API is `node scripts/site-runtime.mjs <command>` from the skill directory, or using its absolute path from any working directory. It uses no agent SDK.

| Command                          | Behavior                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| list                             | Compact domain IDs and four global Observe IDs; no browser               |
| describe ID                      | Only that action's contract; no browser                                  |
| run ID --json '{}'               | Validated registered read action; Observe IDs also supported             |
| status / inspect                 | Small current state / structured visible summary                         |
| inspect-region ID                | Only a POM-registered region                                             |
| screenshot                       | Optional viewport PNG in private .local; JSON returns its path           |
| doctor                           | Version, attach and real run-code probe                                  |
| plan ID --json '{}'              | Read-only preview for a write                                            |
| execute --plan ID --approve HASH | Exact approved plan with fresh guards                                    |
| cleanup                          | Expired private plans and temporary request files; keeps attempt markers |

`--input file.json` replaces `--json` for sensitive or long input. Both together fail. Unknown flags, extra fields, unsupported commands, selectors and arbitrary code are rejected. `--mode diagnostic` allows only observe/list/describe/doctor/cleanup; `--mode builder` is not a Runtime escape hatch.

## Build and dispatch

`src/build.ts` uses esbuild once per build to compile each domain action with its POMs, SitePage and browser entry into `runtime/actions/<id>.js`. Observe code is a separate compiled artifact. It also bundles the Node control plane into `scripts/site-runtime.mjs`. Runtime dependencies: Node >=22.16 and pinned playwright-cli. No npm installation, TypeScript runtime or esbuild is required after distribution.

`runtime/manifest.json` contains action ID, read/write kind, description, input fields, output description, preconditions, postconditions, example, next, artifact path and SHA-256. Output validators are executable browser-safe action code. The manifest format's input vocabulary is defined by `src/runtime/input.ts`; it is not JSON Schema.

Runtime loads metadata, validates input before browser access, reads and verifies the selected existing artifact, serializes a minimal request wrapper and calls `execFile(playwright-cli, [..., "run-code", "--filename=..."])`. No module resolution, source scan or compiler per action. All browser interactions follow this one path, including observation and screenshots. Fixed internal run-code is not exposed as a user command.

Plans bind the manifest/config/build fingerprint. Artifact hashes reject modified bundles before browser access. Source changes require a build; source is never authoritative during normal runtime. Run build/verify before handoff. A failed/interrupted build is not distributable.

## Session policy

Use `attach --extension=chrome --session=<site>-automation`. Reuse only the exact named session with status=open, attached=true, compatible=true and matching channel. Refuse managed, stale or mismatched sessions. Do not silently rename or take over sessions. Explicit configured `attach.mode="cdp"` supports an endpoint; never fall back between modes.

Browser transport issues only CLI --version, list, attach and run-code. Before a new extension attach, an OS process inventory (ps or tasklist via execFile) must confirm the configured main browser process. Missing-browser evidence yields BROWSER_REQUIRED; unreadable inventory or other attach failures yield ATTACH_FAILED; incompatible CLI protocol/version fails closed. No open/launch/headless/profile/close fallback. Session scoping follows playwright-cli's working directory; Runtime always uses the skill root.

Upstream limitation verified in CLI 0.1.19: extension attach opens its connection URL by invoking the Chrome executable. The presence guard prevents the ordinary closed-browser case, but cannot make the check and upstream invocation atomic if the user closes Chrome at that exact instant. For a transport-level no-launch guarantee even across that race, explicitly configure CDP or reuse an already-attached session. Do not describe the extension transport as an OS-level no-spawn guarantee.

On Windows configure trusted `browser.cliScript` to the installed playwright-cli.js entry point and rebuild. It is then invoked with Node via execFile, avoiding shell .cmd wrappers. No agent-provided executable override.

## Outputs and state

Success: `{ok:true,action,state,data,next}`; errors: `{ok:false,error,step?,recovery,mayHaveCommitted?}`. Input 64 KiB, normal complete browser response 16 KiB by default; actions must paginate within these budgets. No default DOM snapshots or uncontrolled stdout. Exit codes: 0 success, 2 input/action, 3 prerequisites/approval, 4 failure, 5 uncertain/replayed write.

`next` is the action's declared legal/advisable continuation set, not a persisted global UI state machine. Choose from it after a result. An empty list ends that flow. New user intents may start a registered action whose POM preconditions hold. Recovery actions belong in appropriate next lists; observation remains global even after errors. POM assertions enforce actual current state on every call.

The CLI is a restricted public API, not an OS sandbox against an agent that can rewrite skill files or invoke arbitrary processes. Code review and Runtime instructions maintain that outer boundary; no harness-specific permissions are assumed.
