# Intake and discovery

## Minimum initial clarification
Ask only for missing information:
"Which website and which concrete actions should the resulting skill support? For each action, provide an example and explain how you recognize a successful result. May the skill modify data, and is a test account available?"

Do not ask again about the browser assumption: Chrome is open by default and must be reused through playwright-cli. Ask only if extension/CDP attachment is technically unavailable or the user explicitly requests another browser.

## Action contract
Document each action:
```yaml
id: inventory.find
kind: read
purpose: Find an item by SKU
input: { sku: { type: string, required: true } }
output: { itemId: string, title: string, available: boolean }
start: authenticated existing browser; inventory accessible
identity: exact SKU
steps: [open inventory, fill search, submit, verify result]
success: exact SKU or explicit empty state
next: [inventory.open]
permissions: read only
status: unclarified
```

## Discovery strategy
During DISCOVER, the builder may use playwright-cli directly. The goal is not to repeat these commands later, but to derive stable POM methods and actions from them.

1. Use the already open browser and session.
2. Determine the known page and visible state.
3. Observe the next business-appropriate path.
4. Confirm the target through state anchors, URL, or DOM.
5. Document robust locators and the postcondition.
6. Implement the flow as a POM plus action.

After two unsuccessful hypotheses or five minutes without progress on an action, ask the user specifically about their flow. Ask sooner when multiple business-distinct paths are plausible or exploration would require a risky step.

Example:
"I am in 'Orders' and can see 'Open' and 'Archive', but no invoices section. Do you first open an individual order, or is there a separate area for invoices? Please describe your click sequence; alternatively, a screenshot is enough."

The user's answer explains the business path but does not prove a locator. Inspect the current DOM again afterward.

## Build state
```json
{
  "phase": "DISCOVER",
  "site": "https://example.org",
  "decisions": {
    "locale": "en-US",
    "browser": "existing-open-chrome",
    "attach": "playwright-cli-extension",
    "session": "example-automation"
  },
  "actions": {"inventory.find": {"status": "blocked", "reason": "Navigation path is missing"}},
  "next": "Ask the user how to reach the inventory"
}
```

Do not store cookies, passwords, browser profiles, original DOM dumps, or personal test data.
