# Skills

Personal collection of reusable agent skills.

The website automation builder generates portable skills: agents only need to read
`SKILL.md` and start the local `node scripts/site-runtime.mjs` process. Generated
skills use precompiled TypeScript/POM actions through `playwright-cli` in an
already-open browser. They require no harness-specific tools or plugins.

Run `task test` for scaffold checks and a freshly generated demo's typecheck,
build, unit tests and subprocess integration tests. Live-browser evidence is
documented separately in the builder's references.

Run the `/setup` skill to audit and install the repository prerequisites,
including Node/npm, Task, the pinned Playwright CLI, and maintained local
package dependencies. The read-only audit is also available directly:

```bash
node .agents/skills/setup/scripts/check.mjs
```

## Installation

Install all skills globally for OpenCode:

```bash
task install:opencode
```

Alternatively, use the CLI directly:

```bash
npx skills add FabianSieper/skills --skill '*' --agent opencode --global --yes
```

Install a single skill:

```bash
npx skills add FabianSieper/skills --skill website-automation-builder
```

## Available skills

- `website-automation-builder` – Builds deterministic website automations with TypeScript, Playwright POMs, and an already open browser.
- `cardmarket-automation` – Read-only Cardmarket (MTG) automations: `cards.search` (result tiles), `cards.price` (detail top block + seller offers), `cards.artworks` (print variants + seller-quantity check). Live-verified; attaches to an already-open browser via `playwright-cli`, never launches/replaces/closes one.
