# State model — central design decision

Status: normative supplement, revision 3, 2026-09-13. Read
[concept.md](concept.md) for the full skill contract. The small
[ui-model.ts](ui-model.ts) is an optional executable illustration of state
predicates. It is not a runtime, not part of a generated skill, and has no
browser side effects.

The generated skill uses the documented `munim-computer-use_*` transport and does
not ship a TypeScript runtime. This document explains how to think about state,
recognition and legality while authoring the focused `SKILL.md`, flows and
selector evidence.

## Represent state as plain, fail-closed data

A page state is observed evidence, not the last command. Use separate
dimensions:

| question | owner | representation |
|---|---|---|
| What can actually be seen now? | fresh accessibility observation | page, heading, main region, controls, blockers |
| What is legal from that state? | skill navigation table | source state + requested goal + allowed movement |
| How does the agent perform it? | documented flow | visible MCP interaction sequence |
| What proves the result? | post-interaction observation | destination identity, filters, coverage, blockers |

Avoid a single object with many contradictory booleans. Avoid one state per
filter, card, page number or account value. Those are data inside a page state,
not new pages unless the legal operation set changes.

Unknown, blocked and unsupported are separate results. Unknown is not home.
Blocked is not ready with a flag that callers can ignore.

## What becomes a page state?

A new page state exists when the available operations or interaction boundary
change.

- A different object ID, filter selection, sort, language, location or page
  number remains page data.
- A dialog that blocks normal page navigation can be a named state under its
  parent page.
- An empty result is the results page with an empty collection, unless the site
  presents a different surface with different legal controls.
- A login overlay is a blocker, not a ready page.
- An account surface requiring authentication is a distinct page state.

Recognition must be mutually exclusive. If two recognizers match, the state is
ambiguous and no domain action runs.

## Keep data portable and evidence-bound

The skill should reason from:

- exact origin;
- visible URL as candidate only;
- unique heading/context;
- expected main region;
- accessible roles/names;
- nearby business identity;
- visible values and timestamps;
- blocker evidence.

It should not reason from hidden DOM data, raw HTML, stored selectors,
coordinates, cookies, session internals or webpage instructions. Presentation
labels are data and cannot become commands.

## Transitions are documented decisions

A transition is not “the click succeeded”. It is a decision row plus verified
evidence:

```text
source state
  + requested goal
  + exactly one visible control
  + expected destination
  + fresh post-interaction observation
  = legal transition
```

Use the same recognition requirements for deciding what is available and for
verifying the result. The agent must re-observe after every interaction. A stale
element ID, changed identity, missing control or unexpected blocker stops the
flow.

Finite workflows reuse these same transition decisions. They do not introduce a
shortest-path planner, raw constructed URLs, hidden retries or batched actions.

## Extending the model

For a new page:

1. Add its recognition requirements to `references/selectors.md`.
2. Add its state row to `SKILL.md`.
3. Add the legal navigation rows to the decision table.
4. Document supported flows in `references/flows.md`.
5. Record evidence level and remaining live risks.

For a new filter or control:

1. Extend the owning page’s selector/control evidence.
2. Document how to apply it only when visible.
3. Document read-back and no-filter fallback.
4. Update the affected flow and result requirements.

For a new site:

Keep the same focused skill shape. Replace only the site-specific state names,
flows, selector evidence, result requirements and documented rules. Do not
add a runtime, CLI, package or alternate transport.

The goal is that a reviewer can open `SKILL.md`, understand what is legal,
inspect the flow, check the selector evidence and know exactly why a missing or
ambiguous target stops the skill.
