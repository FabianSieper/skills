# Action evidence

BUILD_REQUIRED: Add one compact section per registered action:

```text
## action.id
flow: observed business path and starting anchor
selectors: POM.method | locator | scope | count=1 | identity | date
fixture: pass/fail | covered cases
live: pass/fail/not-run | URL, role, locale, browser and playwright-cli version
postcondition: non-secret evidence
remaining-risk: required when live is not-run
```

Runtime contracts come from `describe`; do not duplicate their schemas here.
