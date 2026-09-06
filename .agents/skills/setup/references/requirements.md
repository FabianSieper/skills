# Project setup requirements

## Required

| Requirement | Expected | Why | Install when missing | Verification |
|---|---|---|---|---|
| Git | available on `PATH` | Checkout and normal repository workflow | Use the platform's trusted package manager or installer | `git --version` |
| Node.js | `>=22.16.0` | Declared by generated skills and `cardmarket-automation`; scripts use modern Node APIs and type stripping | Use an existing version manager or a supported Node installer | `node --version` |
| npm | available on `PATH` | Installs locked development dependencies and global CLIs | Installed with Node.js | `npm --version` |
| Task | v3 CLI available as `task` | `Taskfile.yml` is the documented project entry point | `npm install -g @go-task/cli` | `task --version` |
| Playwright CLI | exactly `0.1.19` | Generated runtimes pin and validate this CLI protocol/version | `npm install -g @playwright/cli@0.1.19` | `playwright-cli --version` |
| OpenWiki | global npm package and executable | Repository documentation/knowledge workflow requested by the project owner | `npm install -g openwiki@latest` | global npm inventory plus executable on `PATH` |
| Cardmarket dependencies | lockfile satisfied | Typecheck, build, and unit tests import pinned npm dependencies | `npm ci --prefix skills/cardmarket-automation` | `npm --prefix skills/cardmarket-automation ls --depth=0` |

`npm ci` is intentionally limited to the maintained source package. The builder
regression suite creates a fresh demo in a temporary directory and installs that
demo's dependencies there. Template packages and `artifacts/demo-automation` do
not need persistent `node_modules` for repository setup.

## Conditional requirements

The Chrome browser and Playwright CLI extension are required only for live
browser verification and Cardmarket runtime use. The audit reports whether the
Chrome channel has the extension installed, but its absence does not fail the
core setup. Installation is a manual user/browser action; setup must not open or
modify the browser automatically.

OpenWiki provider credentials are required only when generating or updating a
wiki. They are personal secrets and are not part of repository setup.

## Evidence in this checkout

- `skills/cardmarket-automation/package.json` declares Node `>=22.16.0` and the
  package dependencies used by its build and tests.
- `skills/website-automation-builder/assets/site-template/package.json` declares
  Node `>=22.16.0` for generated skills.
- `skills/website-automation-builder/assets/site-template/site.config.ts` pins
  Playwright CLI `0.1.19`.
- `Taskfile.yml` defines the supported `test` and skill-install workflows.
- `.github/workflows/test.yml` documents the browser-free CI path.

Official references:

- Node downloads: <https://nodejs.org/en/download>
- Task installation: <https://taskfile.dev/docs/installation>
- Playwright CLI: <https://github.com/microsoft/playwright-cli>
- OpenWiki npm package: <https://www.npmjs.com/package/openwiki>
