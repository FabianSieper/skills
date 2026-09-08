# TypeScript UI representation — the central design decision

Status: proposed, 2026-09-08. Read [concept.md](concept.md) for the full contract.
The small [ui-model.ts](ui-model.ts) is an executable illustration of the types
and predicates, not a replacement runtime. It has no browser side effects.

## Choose a discriminated union, a registry and composed POMs

Represent the UI as plain immutable data. Use one discriminated union for its
recognition status, and one for recognized semantic nodes. Keep selectors and
interaction in composed POMs. A typed transition registry connects them.

This separates three questions clearly:

| Question | Owner | Representation |
|---|---|---|
| What can actually be seen now? | Observer/POM | `Ui` union with evidence |
| What is legal from that state? | Contract registry | Pure availability predicates |
| How does the site perform it? | POM/component | Narrow guarded operations |

Avoid a single class with dozens of `isX` booleans: it permits contradictory
states. Avoid one class/state for every filter or card: it explodes the graph.
Avoid a generic JSON UI tree: it exposes DOM complexity and does not express
business invariants. Avoid runtime agents driving an entire state-machine
framework: explicit tables plus small typed handlers meet this task's needs.
No extra framework is selected until these requirements prove it necessary.
Use ordinary Playwright locators inside these POMs through playwright-cli; the
typed state model does not introduce another browser driver.

## What becomes a node, and what remains data?

A node changes when the available operation set or interaction boundary changes.
`detail.offer-edit` deserves a node because an editor blocks normal detail-page
navigation and introduces plan/commit controls. A different card ID, filter
selection or page number remains node data. Empty results are `results` with an
empty collection, not another node unless the website presents a different
surface with different legal controls.

An edit dialog belongs to `CardDetailPage` and `OfferEditDialog`, not a new
top-level page class. The `nodes` map makes this ownership visible. Recognition
must prefer neither by ordering: the parent excludes the known modal, so
exactly one candidate matches. Unknown dialogs block, instead of masquerading
as the underlying ready page. Shared blockers such as consent and challenge are
outside normal ready nodes and cannot be passed to their action handlers.

Authentication is a tagged fact, not a node per page/account combination. Public
data can remain readable while account identity is unknown; private actions
require an observed stable account reference. Filter/readiness facts can
similarly be tagged `known`/`unknown` when absence of evidence matters.

## Keep TypeScript and runtime truth aligned

`Node<K>` is a mapped discriminated union, rather than `{node: K; data:
NodeData[K]}` with unrelated unions. Narrowing `node` narrows its data. A handler
for `detail.offer-edit` cannot accidentally read search-result properties.
Use normal named domain types and exhaustive switches; do not add brands or
deep generic machinery to every string.

Production node-data types should be inferred from the same closed schemas used
to validate browser output. The illustrative NodeData interface keeps the sample
dependency-free; manually maintaining both interfaces and schemas is explicitly
not the production design. Runtime-issued references can be opaque string types
at that boundary, but a TypeScript brand never proves provenance; storage and
freshness checks do.

`Ui` distinguishes ready, blocked, unsupported and unavailable. Unknown state is
a supported observation result. It is never `home`, an exception that hides all
context, or a ready object with `valid:false` that callers can ignore.

Keep data portable: plain JSON, typed unknown/null values, stable IDs, no POM
instances, functions, locators, cookies, HTML or hidden application stores.
The human and AI see the same semantic state and reasons from the same object.
Presentation labels are data and cannot turn into instructions.

## Transitions are small typed declarations

The illustration defines `from`, outcome-to-destination mapping, auth, one pure
availability predicate, and a target-preservation postcondition. The production
declaration adds the schemas, effects, guarded steps, budget and evidence fields
from the full concept. Do not put unrelated lifecycle logic in each declaration.

Use **the same availability function** for status and execution. Every source
state is a tuple of valid node IDs. Output outcomes determine valid destination
IDs. A handler cannot claim a new node; the engine observes again and evaluates
destination plus business identity. “The click succeeded” is not a transition.

The sample `nav.versions` checks the stable parent-card identity in both state
schemas. This is a required semantic identity, not a claim that live Cardmarket
exposes an attribute with that name. Discovery must establish a stable mapping
before production release. The editor-close example rejects dirty forms, wrong
states, unknown accounts and changed product identity.

Finite workflows reuse action steps and specify their branches in a graph. Do
not recursively invoke the public CLI, release/reacquire locks between steps,
or let an action navigate to a URL outside a registered transition. The engine
owns sequencing; POMs own browser mechanics.

## Extending the model

For a new page: add its closed state schema, ownership entry and recognizer with
unique anchors. Add a POM only if it is a distinct page surface; otherwise add a
component/node. Then add registered actions with source/destination predicates,
schemas and evidence. Generate help/graph/manifest and run contract checks.
No central `if (url.includes(...))` chain or duplicated action lists to edit.

For a new filter: extend the owning component's schema and canonicalization,
read-back and mismatch tests. Do not add a node. For a new dialog: add one node
under its parent, ensure recognition is exclusive, then declare open/close and
dirty-form handling. For a new site: keep the same engine; replace only schemas,
recognizers, POMs, action declarations and evidence.

Do not construct a general DOM-to-POM generator. The abstraction is small and
business-specific on purpose: a reviewer should find a page, inspect its state
schema and transitions, and understand its legal operations without following
inheritance chains or generated selectors.

The fully resolved contract may have many enforced fields, but the authoring API
must be small. Shared factories provide policy defaults; site declarations keep
the real states, identities, effects and schemas explicit. A generated developer
index links each node to its recognizer, component, actions and tests. See
[navigation-design.md](navigation-design.md) for the extension checklist and
measurable operator/builder simplicity gates.
