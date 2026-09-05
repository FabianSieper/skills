# Skills

Persönliche Sammlung wiederverwendbarer Agent Skills.

## Installation

Alle Skills global für OpenCode installieren:

```bash
task install:opencode
```

Alternativ direkt über die CLI:

```bash
npx skills add FabianSieper/skills --skill '*' --agent opencode --global --yes
```

Einen einzelnen Skill installieren:

```bash
npx skills add FabianSieper/skills --skill website-automation-builder
```

## Verfügbare Skills

- `website-automation-builder` – Erstellt deterministische Website-Automationen mit TypeScript, Playwright-POMs und einem bereits geöffneten Browser.
