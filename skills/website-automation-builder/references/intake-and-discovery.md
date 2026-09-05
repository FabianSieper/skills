# Intake and discovery

Ask only for missing fields: website, action examples, inputs, expected output, success evidence, account/role, read or write, permitted mutations, and test environment.

Define every action before exploration:

```yaml
id: inventory.find
kind: read
description: Find one item by exact SKU
preconditions: [authenticated inventory is reachable]
parameters: { sku: { type: string, required: true, min: 1, max: 64 } }
example: { sku: SKU-42 }
output: exact item or explicit not-found
postcondition: returned SKU equals the query
next: [inventory.update-title]
```

## Exploration

Ask immediately when two business routes are plausible, prerequisites or a control's meaning are unclear, or a risky mutation is near. After two targeted unsuccessful navigation attempts, stop exploring that action and ask for the user's real click sequence or screenshot. Keep implementing independent actions. Do not repeatedly guess routes.

Use one named attached session. Minimal commands:

```bash
playwright-cli attach --extension=chrome --session=<site>-automation
playwright-cli -s=<site>-automation snapshot
playwright-cli -s=<site>-automation find "business text"
playwright-cli -s=<site>-automation click <observed-ref>
```

Snapshot refs are temporary discovery aids. For each interaction record the POM method, locator, scope, expected count `1`, business identity, starting-state anchor, and observable result. Reinspect the DOM after user guidance.

Use this state shape:

```json
{
  "phase": "DISCOVER",
  "actions": {
    "inventory.find": {
      "mapped": true,
      "implemented": false,
      "fixture": "not-run",
      "live": "not-run",
      "remainingRisk": ""
    }
  },
  "next": "Implement inventory.find"
}
```

At handoff every registered action needs `mapped:true`, `implemented:true`, `fixture:"pass"`, and either `live:"pass"` or `live:"not-run"` with a concrete `remainingRisk`.
