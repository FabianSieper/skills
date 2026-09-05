# Verification

## Required checks for the generated website skill
1. Run `npm run typecheck`.
2. Run `npm test`.
3. Verify `list` and `describe` without browser access.
4. With the browser already open, verify that `connect` and `doctor` attach the configured named session without launching a browser.
5. With the browser closed or not attachable, verify `BROWSER_REQUIRED` or `ATTACH_FAILED`, with no `open`, managed/headless, or adapter fallback.
6. For every read action, verify success, an empty or missing target, invalid input, and the postcondition.
7. For every locator, verify a unique match in the real target state and after invoking it again.
8. For every write action, verify that `prepare` does not mutate, `execute` compares the preview/account, the attempt marker prevents replay, and an uncertain commit is not repeated.
9. Verify that `allowedNextActions` contains only registered IDs and matches the documentation.
10. Verify that normal execution uses only Action CLI -> bundled POM code -> attached browser, with no snapshot references or LLM-generated click sequences.

## Browser- and CLI-specific regression checks
- Document the current `playwright-cli --version`.
- Test extension or CDP attachment exactly as configured.
- Test `run-code --filename` with the generated single-function bundle.
- Verify that the browser remains open after a successful action.
- Verify that existing unrelated tabs are neither closed nor reordered.
- Keep login and cookies in the user's browser; the skill must not create an authentication-state file.

## Live verification
Run safe reads at least twice from a fresh business starting state. Do not repeat production write actions for testing. Use staging or a test account, or explicitly mark missing live verification.

Document the following in the target skill's `references/verification.md`:
```text
date: <ISO timestamp>
environment: <URL, role, language, browser, playwright-cli, Node>
attach: <extension=chrome | cdp=...>
action: <id>
fixture: pass/fail/not-run
live: pass/fail/not-run
postcondition: <evidence without secrets>
remaining-risk: <if any>
```
