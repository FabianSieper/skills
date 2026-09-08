# Skills

Personal collection of reusable agent skills.

Website automation uses **playwright-cli** in the user's already-open browser.
For website-automation development, [AGENTS.md](AGENTS.md) requires the
[project-local builder skill](.agents/skills/website-automation-builder/SKILL.md)
and the [strict concept](docs/strict-automation/concept.md). The builder is an
authoring guide, not an installable site runtime or a scaffold generator.

Run `task test` for concept links/routing and the illustrative UI-model tests.
Run `task test:cardmarket` for the current Cardmarket typecheck and unit tests
after installing its locked dependencies. CI runs both groups and typechecks
the model. These checks do not establish live-browser verification.

The former builder/scaffold has been removed. The concept's precompiled runtime
and Cardmarket migration are still planned; see the
[progress tracker](docs/strict-automation/todo.md). Use the current Cardmarket
skill's documented commands until its migration is implemented.

Run the `/setup` skill to audit and install the repository prerequisites,
including Node/npm, Task, the pinned Playwright CLI, and maintained local
package dependencies. The read-only audit is also available directly:

```bash
node .agents/skills/setup/scripts/check.mjs
```

## Installation

Install the Cardmarket runtime skill globally for OpenCode:

```bash
task install:opencode
```

Alternatively, use the CLI directly:

```bash
npx skills add FabianSieper/skills --skill cardmarket-automation --agent opencode --global --yes
```

The builder stays in this checkout under `.agents/skills`; its concept links are
repository-relative. Do not install that authoring skill globally in isolation.

## Available skills

- `website-automation-builder` (project-local) – Required authoring workflow for website skills; follows the strict state/POM/navigation concept using playwright-cli.
- `cardmarket-automation` – Existing MTG search, detail, sellers, artworks, stock comparison and planned offer updates. Uses playwright-cli; current limitations and historical verification are recorded in its references. Strict-concept migration remains open.
