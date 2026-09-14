# Navigation ergonomics with munim-computer-use

Status: normative supplement, revision 4, 2026-09-14. This resolves navigation,
observation, recovery and authoring ergonomics for the default focused MCP
skill. It does not claim every website failure is knowable in advance.
Unrecognized situations remain observable, bounded and unable to trigger guessed
interactions.

## Transport is munim-computer-use

```text
agent
  → skill decision table
    → munim-computer-use_* tools
      → visible browser UI and accessibility state
        → bounded result
```

The agent uses the generic computer-use tools against the bound browser:
`activate_app`, `list_apps`, `get_app_state`, `click`, `type_text`,
`set_value`, `press_key`, `scroll`, and optional `screenshot`.

Safari is preferred. Chrome is allowed only as a browser fallback using the same
generic tools. `munim-computer-use_browser_*` is not the canonical transport.
No other driver, CLI, shell automation, Web search or direct HTTP path is
allowed.

## Navigation policy

Every movement inside the site follows one fixed rule:

- **Forward:** only through real visible UI interaction — links, buttons, tabs,
  pagination controls, form submission.
- **Return:** only through browser history, which undoes the immediately
  preceding verified forward step.
- **Direct navigation:** only to the configured site home entry, used to
  re-anchor the bound tab or open one initial tab when no usable site tab
  exists.

Do not construct object, list, detail, account or stock URLs. Do not use raw
navigation as a shortcut around a missing or ambiguous control.

## Enter-key policy

The Return/Enter key is never used to submit a site page form. Set the visible
search or filter field, then click the unique visible submit/Search control.

The browser address bar is the only allowed Enter target. Use it only for
deliberate home-entry re-anchoring:

```text
set_value { element_id: <address bar>, value: "https://example.com" }
press_key { key: "Enter" }
```

If no bound tab exists, open one home-entry tab instead of guessing among tabs.

## Planned navigation (deterministic step plans)

The operator never searches the page for its next control. Each flow step is a
plan entry that names the expected control exactly:

- `control`: the expected accessible role and name.
- `disambiguation`: how to tell it apart from lookalikes in the same context.
- `resolve`: the plan observation (scoped `query`, or bounded region read with an
  explicit element budget) that locates the control.
- `action`: the single interaction.
- `verify`: the plan observation that proves the expected effect.
- `expected`: the destination or read-back identity.
- `drift stop`: a zero match or duplicate on the documented `resolve` query is UI
  drift — stop and report; never probe, guess or widen into an unscoped dump.

The decision table maps (state, goal) to the plan entry and must be total over
every supported combination, including re-anchoring from any in-site state. A
cell without a named plan is a builder gap, not operator discretion.

## Observation budget (hard)

A full unscoped `get_app_state` returns the whole accessibility tree (default
800 elements; on real pages about 20–37 KB per call). Repeated at every
interaction step it dominates the agent's context and thinking time. The budget
below is hard; it bounds the payload without weakening the fresh-state rule:

- **Full unscoped tree only for initial binding.** It walks every app window and
  is used for the tab inventory and binding. At most one full inventory per task,
  plus one re-inventory after a `windows=0` recovery.
- **Mid-task: plan observations only.** Each step uses its plan entry's `resolve`
  (before the action) and `verify` (after) observations — scoped `query` or
  plan-bounded `max_elements` region read. At most two observations per step plus
  one re-observation after a zero-match verify.
- **Scope to the bound window.** After binding, observe with `window:<index>`
  (0-based window index, or `"agent"`). The unscoped call walks every app window
  and is not a mid-task option.
- **Bound data reads.** When a read needs the page region (for example up to 50
  rows), pass the plan's explicit `max_elements` budget (typically 100–200) and
  raise it only when the required region is provably truncated.
- **No app re-activation after binding.** `activate_app` is used for initial
  binding and the `windows=0` recovery only, not between steps.

A `window`-, `query`- or `max_elements`-scoped observation is still a fresh
observation with valid element IDs. It does not relax the requirement to re-observe
after every interaction. A zero match on a documented plan query is UI drift
(stop and report), never an invitation to dump the full tree.

## What the operating agent should do

The operator loop is:

1. Read `SKILL.md` once.
2. Run the mandatory MCP gate.
3. Bind exactly one site tab.
4. Observe fresh state and recognize page/blockers.
5. Select the navigation row and its plan entry for the requested goal.
6. Resolve the plan's documented control with its `resolve` observation.
7. Interact once.
8. Observe fresh state with the plan's `verify` observation and verify
   destination/identity.
9. Continue only within the user’s task and report bounded result.

The agent should not repeatedly read help, invent selectors, quote shell
commands, compose URLs, choose by ordinal position, or treat the last known
action list as current.

A missing input or failure returns the missing prerequisite, observed blocker,
ambiguous candidates or UI drift. It does not publish a guessed next action.

## Navigation failure cases

All rows are skill acceptance cases, not executed live tests.

| difficulty | required handling |
|---|---|
| URL changes before content, or old object remains visible | require destination identity and relevant region evidence, not URL alone |
| page changes while reading multiple regions | check identity before and after; one bounded re-observation, otherwise unstable state |
| table loading while header is ready | allow stable header reads; withhold table reads; no page-wide stop for unrelated widget |
| button covered, detached or disabled during interaction | re-resolve exactly one enabled target; no forced click or coordinate fallback |
| accessibility tree rerenders or rows reorder | re-resolve same business identity; never substitute another row |
| autocomplete, debounced search or dependent dropdown | use the documented visible control and verify selected value before submit |
| empty result versus loading, failure or hidden rows | require explicit empty-state evidence; loading/error/unknown never becomes zero |
| infinite scroll or virtualized table | use a bounded documented load-more flow; pure read never scrolls implicitly |
| current tab closes, changes or another matching tab exists | report binding mismatch and candidates; never choose by tab index |
| unexpected popup, download, new tab or permission dialog | report unexpected effect and stop |
| back/reload restores stale data or resubmits form | no generic back/reload recovery; use only the immediately preceding verified return |
| login redirects to different object or account | re-observe after human finishes; resume only through declared route |
| rate limit, maintenance, offline or persistent spinner | distinct cause and bounded recovery; no repeated navigation |
| locale, currency, section or layout differs | observe context; support only evidenced variants; never change preferences implicitly |
| focus/menu/hover state changes | use required noncommitting visible steps; ephemeral presentation is not a new global state unless legal operations change |
| caller interrupted or context lost | report in-flight uncertainty and safe references; new agent does not infer completion |
| user changes task mid-workflow | stop at next safe boundary; cancellation cannot undo an in-flight write |
| partial read needs continuation | bind cursor to context and progress; changed context returns stale cursor |
| same task causes repeated observation/help calls | return compact state, result and next safe step together |
| operator dumps the full tree mid-task or re-activates the app | stay within the observation budget: full inventory only for binding, plan observations only mid-task |
| operator invents ad-hoc query probes to find a control | resolve only the plan's documented control; a zero match is UI drift, not a search |
| optional region drifts but another operation is safe | block only actions depending on that region; core identity ambiguity blocks all domain actions |

Global blockers and locally unavailable regions are different. A consent or
login overlay can block the page; a loading table need not prevent reading a
stable header. Region failures retain their cause.

## What the extending agent should edit

Use the same three site concepts everywhere: **state evidence, supported flow,
navigation decision**.

| change | expected skill edits |
|---|---|
| add a page | selector evidence, state row, navigation rows, flow, result requirements |
| add a filter | selector/control evidence, read-back, no-filter fallback, flow update |
| add a transition | navigation row, flow step, identity verification |
| add a dialog | selector evidence, blocker or named state, open/close flow |
| add a workflow | bounded composition of existing flow steps, branch/stop conditions |
| add a write path | guarded write flow, confirmation, read-back, restore/test rule |
| add a transport primitive | explicit reviewed concept change, not silent skill edit |

Each page should link its selector evidence, flows and navigation decisions.
Do not require manually synchronized runtime indexes, generated manifests,
bundles or CLI help.

## Simplicity acceptance gates

- A supported task from a declared starting state takes one documented flow.
- Opening a returned candidate uses one supplied visible control and fresh
  verification, with no help lookup.
- Reading a bounded table reports coverage without hidden navigation.
- Every failure provides a safe next instruction or names the human prerequisite.
- A harmless rerender does not force reselection; a changed identity does.
- An ordinary page/flow extension leaves other skills unchanged and adds no
  runtime code.
- Operator scenarios use only the generated `SKILL.md`, references and MCP
  tools. Observe call count, redundant observations, wrong recoveries and files
  touched. Document-only checks alone do not prove live usability.
