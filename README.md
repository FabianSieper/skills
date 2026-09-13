# Skills

Personal collection of reusable agent skills.

The Cardmarket runtime skill is the reference implementation of the default
website-automation concept. It uses the **munim-computer-use MCP**
(`munim-computer-use_*`), stops before browser work when those tools are
unavailable, has no CLI or package dependencies, and keeps durable Cardmarket
writes disabled.

For general website-automation development, [AGENTS.md](AGENTS.md) requires the
[project-local builder skill](.agents/skills/website-automation-builder/SKILL.md)
and the [strict concept](docs/strict-automation/concept.md). The builder is an
authoring guide, not an installable site runtime or a scaffold generator.

Run `task test` for concept links/routing and the illustrative UI-model tests.
Run `task test:cardmarket` to validate the focused Cardmarket skill, its MCP gate,
and the absence of legacy runtime instructions. CI runs both groups and
typechecks the illustrative model. These checks do not establish live-browser
verification.

The former Cardmarket CLI/POM runtime was removed when the skill moved to direct,
state-aware munim-computer-use automation. Use only the workflow documented in
the Cardmarket skill.

Run the `/setup` skill to audit repository authoring prerequisites.
munim-computer-use availability is a host-session capability and is checked by
the Cardmarket skill itself. The read-only repository audit is also available:

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

Installing the skill does not install munim-computer-use. At use time the
skill checks whether the `munim-computer-use_*` tools are callable; if not, it
stops without touching the browser and offers installation/configuration for the
current host.

The builder stays in this checkout under `.agents/skills`; its concept links are
repository-relative. Do not install that authoring skill globally in isolation.

## Available skills

- `website-automation-builder` (project-local) – Required authoring workflow for website skills; follows the strict state/flow/navigation concept using munim-computer-use and the focused Cardmarket-style skill shape.
- `cardmarket-automation` – Focused MTG search, detail, seller, artwork and own-stock reads through munim-computer-use. Requires the callable `munim-computer-use_*` tools; no fallback and no durable offer writes.
