# Skills

Personal collection of reusable agent skills.

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
