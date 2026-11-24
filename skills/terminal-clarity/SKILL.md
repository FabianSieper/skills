---
name: terminal-clarity
description: >-
  Communicate with maximum comprehension per second of reading in terminal-based AI
  conversations, especially GitHub Copilot CLI on macOS, and other coding agents.
  Use proactively for explanations, comparisons, investigations, code reviews,
  recommendations, plans, status reports, and other answers where visual structure
  can convey meaning faster than prose. Identify the important relationships,
  likely comprehension barriers, prerequisites, and misconceptions independently.
  Encode information using aligned columns, grouped tables, Unicode diagrams,
  timelines, small charts, semantic emphasis, and compact terminal dashboard
  layouts. Keep simple answers simple. Deliver readable native terminal chat
  responses without browsers, image generation, or required external renderers.
---

# Terminal Clarity

## Objective

Minimize **time to accurate understanding**, not word count in isolation. Turn
answers into a coherent, scan-friendly information surface, not an article with
occasional diagrams. Make the core answer immediately visible; keep the meaning,
necessary nuance, causal links, and actionable details intact.

Use the user's language and vocabulary. Apply to any subject, not just code.
Respect requested output formats, safety requirements, and factual accuracy.
Do not force visual treatment onto a simple fact, code-only request, or artifact
whose required format would be broken by it.

## 1. Analyze before composing

Silently identify:

- The question or decision the user actually needs to resolve.
- The smallest useful mental model: relevant entities, states, relationships,
  mechanisms, units, and constraints.
- The one or two non-obvious aspects that make the concept difficult, including
  missing prerequisites, similar concepts that can be confused, counterintuitive
  effects, hidden dependencies, and important exceptions.
- The evidence and assumptions needed to distinguish facts from hypotheses.
- The most informative example or contrast, if it can make the mechanism tangible.

Resolve these without routinely asking what the user does not understand. Ask
only when essential input is missing and a meaningful answer cannot otherwise be
provided. Do not narrate this analysis or announce the use of this skill.

## 2. Design the answer as a visual hierarchy

Choose a small number of meaningful content groups. Put the conclusion or
mental model first, then the explanation of how/why, then consequences,
conditions, or next actions only when useful. Adapt the order to the question.

- Make the key answer findable in a glance, ideally in the first few lines.
- Give the hardest or most consequential concept the most visual space.
- Use short descriptive section labels, restrained separators, and purposeful
  whitespace. Separate different ideas more strongly than related items.
- Place comparable information side by side on a shared axis when width allows.
  Use aligned columns, consistent labels, and matching units, order, and scale.
- Group rows within large tables by meaning; prefer smaller targeted tables
  over wide, dense grids. Put the most relevant columns first.
- Use indentation for ownership, containment, and hierarchy; use arrows only
  for actual flow, dependency, transition, or causality. Label ambiguous arrows.
- Use a panel or tab-like section heading only when it creates useful grouping.
  Do not imply interactivity or actual tabs unless the client really supports it.
- Reveal details progressively: overview first, one concrete example next,
  essential exceptions or implementation details last. Avoid a long preamble.
- End when understanding is sufficient. Do not add boilerplate summaries,
  restate the diagram in prose, or manufacture a recommendation.

## 3. Select the strongest visual encoding

Choose by the structure of the information, not by the topic. Combine formats
only if each communicates a different necessary aspect. Prefer the least
complicated representation that preserves the meaning.

| Information structure | Preferred representation |
|---|---|
| One fact or direct answer | One short sentence or key-value line |
| Attributes or configuration | Aligned key-value pairs |
| Alternatives and trade-offs | Grouped matrix, shared columns |
| Quantities, differences, ranking | Sorted proportional bars + exact values |
| Trends over time | Sparkline or labelled timeline + values |
| Time, duration, concurrency | Aligned time grid, intervals, lanes |
| Workflow or branching | Flowchart or decision tree |
| Communication between actors | Sequence diagram with labelled messages |
| Containment or hierarchy | Indented tree |
| Architecture or dependencies | Labelled components and connections |
| Cause and effect | Causal chain, contrast, or feedback loop |
| State changes | Before/after states or state transition diagram |
| Debugging | Evidence, cause/hypothesis, fix, verification |
| Code changes or review | Grouped findings, compact diffs, file:line anchors |
| Plan or instructions | Ordered steps, milestones, dependencies |
| Status or progress | Compact dashboard, labelled status indicators |
| Abstract/confusable concepts | Concrete scenario, aligned comparison, mental model |

Prefer a comparison on shared axes over two separately drawn descriptions. For
mechanisms, show the change or the cause; do not just draw a list of definitions
in boxes. For decisions, expose the deciding criterion before the trade-offs.

Consult [reference examples](references/examples.md) for the intended visual
style and [layout patterns](references/layout-patterns.md) when the answer needs
more complex layout or chart design. Treat them as examples, not fixed templates.

## 4. Terminal layout contract

- Deliver the primary answer directly in the agent conversation. Do not require
  a browser, HTML report, image, separate viewer, or an interactive full-screen
  terminal application.
- Use native Markdown headings, short prose, emphasis, lists, and tables when
  the client renders them well. Put whitespace-sensitive diagrams and manually
  aligned panels inside fenced `text` blocks to preserve monospaced spacing.
  Do not fence the entire answer merely to achieve a dashboard look.
- Prefer Unicode box-drawing, arrows, block characters, and simple status
  symbols where supported; use plain ASCII equivalents if compatibility is
  unknown or the client cannot display Unicode reliably.
- Use spaces, not literal tabs, for alignment. Avoid emoji, ambiguous-width
  symbols, and combinations that make columns unstable. Check display-cell
  widths, not just string length, if a renderer is involved.
- Fit the actual available chat width if known. Otherwise target 72–80 display
  columns for compact diagrams; leave room for client indentation. Reduce
  labels or stack panels vertically when a side-by-side view would wrap. Do not
  assume the physical terminal width equals the chat content width.
- Use one consistent visual grammar: single/light separators for grouping,
  restrained headings for hierarchy, equal spacing for equal relationships.
  Avoid heavy borders on every section, banners, excessive boxes, and ornament.
- Use meaningful status marks and concise labels (e.g., `✓ OK`, `! Risk`,
  `× Failed`, `? Unknown`). Never make a distinction depend on color alone.
- Keep values aligned, preferably right-aligned for numeric columns. Preserve
  units, decimals, scales, reference points, and legends when needed. Use a
  common scale for quantitative comparisons. Do not present invented numbers
  or a subjective score as a measurement. Mark illustrative values clearly.
- Maintain readability with both light and dark terminal themes and without
  color. Use native emphasis first. If ANSI styling is confirmed to render in
  the chosen output channel, use it sparingly and semantically: green for
  confirmed success/benefit, yellow for caution, red for failure/risk, cyan or
  blue for structural emphasis, dim for secondary metadata. Reset styles.
  Honor NO_COLOR and non-color output. Never emit literal ANSI escape sequences
  into a chat message or rely on shell output preserving its colors.
- Use clickable links or file:line references where supported, otherwise plain
  references. Retain citations and essential context outside diagrams if needed.

## 5. Optional renderer policy

The dependency-free native output is the default and must remain sufficient.
Use existing terminal renderers only when they materially improve readability
or geometry. No installation, network requests, file generation, or shell
execution solely for decorative styling. Do not assume permissions or tools.

For complex diagrams, an already available terminal Mermaid renderer such as
Beautiful Mermaid or Termaid may help. For aligned tables, charts, or panels,
consider an existing Rich or similar renderer. Use only supported syntax and
verify output and width. Prefer actual rendered Unicode/ASCII over unrendered
Mermaid source when the chat does not render Mermaid. If a tool fails or the
client hides/truncates its output, produce a native diagram instead. Return raw
source only when requested or necessary for the task.

Never assume the skill can change Copilot CLI's UI, add tabs, or force ANSI
rendering. Tools are optional aids, not a prerequisite for receiving an answer.

## 6. Quality gate before sending

Silently verify the following, then revise any failure:

- **Glance:** Can the user identify the main answer without reading the whole
  response? Is the key distinction visually prominent?
- **Comprehension:** Are the mechanism, necessary prerequisites, likely
  confusion points, and relevant exceptions understandable without guessing?
- **Semantics:** Does every meaningful arrow, position, symbol, and size
  represent a correct relationship? Are scales and examples honest?
- **Layout:** Are related elements grouped, comparable elements aligned, and
  labels legible? Will wrapping or color loss destroy the meaning?
- **Compression:** Can a sentence, repeated heading, border, or visual be removed
  without losing understanding? If yes, remove it. Do not omit necessary nuance.
- **Action:** For task-oriented answers, is the next action or verification clear?
  For factual answers, distinguish known facts from uncertainty.

Aim for a clear first glance and deeper understanding on demand. Never trade
accuracy or essential information for visual symmetry or brevity.
