# Navigation ergonomics with munim-computer-use

Status: normative supplement, revision 3, 2026-09-13. This resolves navigation,
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

## Bounding the observation payload

A full `get_app_state` observation returns the whole accessibility tree of the
observed windows (default budget 800 elements; on real pages this is about 20–37 KB
per call). Repeated at every interaction step, it dominates the agent's context and
thinking time. Bound the payload without weakening the fresh-state rule:

- **Scope to the bound window.** Once the bound tab/window is identified, observe
  with `window:<index>` (0-based window index, or `"agent"` for the agent's own
  window). The unscoped call walks every app window and is used only for the
  initial tab inventory and binding.
- **Prefer query-filtered observations per step.** Before resolving a target and
  after verifying a navigation, use
  `get_app_state { app, window, query }` — a case-insensitive substring match over
  roles, labels and values. Matched elements keep valid fresh IDs, and a zero-match
  query is a minimal payload that still proves the tree is current.
- **Bound bounded data reads.** When a read actually needs the page region (for
  example, reading up to 50 rows), pass `max_elements` (typically 100–200) and raise
  it only when the required region is provably truncated.
- **Verify navigation with a small observation.** After navigation, confirm the
  origin/title with a small `query` observation before resolving the next control;
  browser chrome (the address bar) follows the WebArea content, so a small
  root-anchored tree can be missing it.
- **Full trees only when justified.** A full unscoped observation is justified only
  for initial binding, when a query returns zero matches and page identity itself is
  unknown, or when the required region is provably absent from a bounded read.

A `window`-, `query`- or `max_elements`-scoped observation is still a fresh
observation with valid element IDs. It does not relax the requirement to re-observe
after every interaction.

## What the operating agent should do

The operator loop is:

1. Read `SKILL.md` once.
2. Run the mandatory MCP gate.
3. Bind exactly one site tab.
4. Observe fresh state and recognize page/blockers.
5. Select the navigation row matching the requested goal.
6. Resolve exactly one visible control.
7. Interact once.
8. Observe fresh state and verify destination/identity.
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
