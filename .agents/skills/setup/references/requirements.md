# Project setup requirements

## Required

| Requirement | Expected | Why | Install when missing | Verification |
|---|---|---|---|---|
| Git | available on `PATH` | Checkout and normal repository workflow | Use the platform's trusted package manager or installer | `git --version` |
| Node.js | `>=22.16.0` | Repository scripts use modern Node APIs and type stripping | Use an existing version manager or a supported Node installer | `node --version` |
| npm | available on `PATH` | Installs locked development dependencies and global CLIs | Installed with Node.js | `npm --version` |
| Task | v3 CLI available as `task` | `Taskfile.yml` is the documented project entry point | `npm install -g @go-task/cli` | `task --version` |

The project-local builder, Cardmarket skill validation, and `task test` need no
local npm dependencies. The previous Cardmarket CLI/POM package was removed.

## Conditional requirements

Live website-automation verification requires the host-provided
munim-computer-use MCP (`munim-computer-use_*`). A repository shell audit cannot
prove that session capability. The website skill checks it at use time, stops
when absent, and offers installation/configuration for the current host.

Do not install or configure the MCP automatically during `/setup`.

## Evidence in this checkout

- `skills/cardmarket-automation/SKILL.md` is the reference implementation of the
  default focused MCP skill shape and declares the hard munim-computer-use gate.
- `.agents/skills/website-automation-builder/SKILL.md` defines project-local
  authoring and links to the normative concept under `docs/strict-automation`.
- `Taskfile.yml` defines the supported `test` and skill-install workflows.
- `.github/workflows/test.yml` documents the browser-free CI path.

Official references:

- Node downloads: <https://nodejs.org/en/download>
- Task installation: <https://taskfile.dev/docs/installation>
