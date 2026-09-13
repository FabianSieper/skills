# Project setup requirements

## Required

| Requirement | Expected | Why | Install when missing | Verification |
|---|---|---|---|---|
| Git | available on `PATH` | Checkout and normal repository workflow | Use the platform's trusted package manager or installer | `git --version` |
| Node.js | `>=22.16.0` | Repository scripts use modern Node APIs and type stripping | Use an existing version manager or a supported Node installer | `node --version` |
| npm | available on `PATH` | Installs locked development dependencies and global CLIs | Installed with Node.js | `npm --version` |
| Task | v3 CLI available as `task` | `Taskfile.yml` is the documented project entry point | `npm install -g @go-task/cli` | `task --version` |
| Playwright CLI | exactly `0.1.19` | Default website-automation authoring and the retained concept use this protocol/version | `npm install -g @playwright/cli@0.1.19` | `playwright-cli --version` |

The project-local builder, Cardmarket skill validation, and `task test` need no
local npm dependencies. The previous Cardmarket CLI/POM package was removed.

## Conditional requirements

The Chrome browser and Playwright CLI extension are required only for live
verification of default authored runtimes. Cardmarket instead requires the
host-provided munim-computer-use MCP (`munim-computer-use_*`). A repository shell
audit cannot prove that session capability; the Cardmarket skill checks it at
use time, stops when absent, and offers installation/configuration.

## Evidence in this checkout

- `skills/cardmarket-automation/SKILL.md` declares the hard munim-computer-use
  MCP gate and contains no local runtime dependency.
- `.agents/skills/website-automation-builder/SKILL.md` defines project-local
  authoring and links to the proposed architecture under `docs/strict-automation`.
- `Taskfile.yml` defines the supported `test` and skill-install workflows.
- `.github/workflows/test.yml` documents the browser-free CI path.

Official references:

- Node downloads: <https://nodejs.org/en/download>
- Task installation: <https://taskfile.dev/docs/installation>
- Playwright CLI: <https://github.com/microsoft/playwright-cli>
