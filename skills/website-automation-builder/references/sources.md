# Technical sources

Check the current official documentation before making version- or CLI-related changes:
- Playwright CLI skill and commands: https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md
- Attach to an existing browser: https://playwright.dev/agent-cli/commands/attach
- Sessions: https://playwright.dev/agent-cli/sessions
- `run-code` and `--filename`: https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/references/running-code.md
- Playwright POMs: https://playwright.dev/docs/pom
- Locators: https://playwright.dev/docs/locators
- Actionability and auto-waiting: https://playwright.dev/docs/actionability

Important scaffold assumptions: `run-code --filename` receives a single function expression; import, export, and require are not supported directly in that file. Preserve the bundle adapter and regression-test it when upgrading the CLI.
