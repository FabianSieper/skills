# Technische Quellen

Vor Versions-/CLI-Anpassungen aktuelle offizielle Dokumentation prüfen:
- Playwright CLI Skill/Commands: https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md
- Attach an bestehenden Browser: https://playwright.dev/agent-cli/commands/attach
- Sessions: https://playwright.dev/agent-cli/sessions
- run-code und `--filename`: https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/references/running-code.md
- Playwright POMs: https://playwright.dev/docs/pom
- Locators: https://playwright.dev/docs/locators
- Actionability/Auto-Waiting: https://playwright.dev/docs/actionability

Wichtige Annahmen des Gerüsts: `run-code --filename` erhält eine einzelne Function Expression; Import/Export/Require werden darin nicht direkt unterstützt. Deshalb Bundle-Adapter beibehalten und bei CLI-Upgrades regressionstesten.
