# Terminal layout patterns

Choose a layout for its informational function. Do not combine these patterns
mechanically; the shortest useful layout wins.

## 1. Mental model and grouped sections

    TOPIC
    One sentence that resolves the core question.

    MECHANISM
    ──────────────────────────────────────────────────────
    Input ──▶ Transformation ──▶ Output

    KEY DISTINCTION
    ──────────────────────────────────────────────────────
    A    ...
    B    ...

A simple answer may need only the first sentence. A complex answer may need
multiple compact groups. Put the important group first rather than adhering to
this exact ordering. Use ordinary Markdown headings outside diagrams when the
client renders them more legibly.

## 2. Side-by-side contrast

    BEFORE                      AFTER
    ────────────────────────    ────────────────────────
    A ──▶ B ──▶ C               A ──▶ C

    Calls     2                 Calls     1

Align related stages, units, and labels. A panel border is optional. If the
available width is too narrow, stack panels with identical labels and ordering.
Do not put long prose into narrow columns.

## 3. Grouped comparison

    CRITERION              OPTION A   OPTION B   OPTION C
    ─────────────────────────────────────────────────────
    CAPABILITIES
    Feature 1              Strong     Limited    None
    Feature 2              Yes        No         Yes

    COST
    License                Free       Paid       Free
    Setup effort           Low        High       Medium

    KEY TRADE-OFF          ...

Select criteria that change the decision. Avoid unexplained numerical ratings;
use grounded labels or measurements. If the table does not fit, use two options
per comparison or key-value groups. A legend is needed only for non-obvious
symbols or scales.

## 4. Quantitative bars

    REQUEST LATENCY (ms)
    ──────────────────────────────────────────────────
    Login       █                       40
    Products    ███                    120
    Search      ████████████████████   800

    Search: 20x slower than Login (illustrative values).

Here one full block represents 40 ms. Use a common zero baseline, consistent
scale, and actual numeric labels. For tiny non-zero values, a fractional block
or clear minimum marker avoids overstating magnitude. Do not use bar length to
represent ordinal or categorical values unless clearly described. Label chart
scales and units when the values alone do not disambiguate them.

## 5. Tree and decision flow

    Need persistent data?
    ├─ No  ──▶ In-memory store
    └─ Yes
       ├─ Relations and transactions ──▶ Relational database
       └─ Document-oriented model    ──▶ Document database

Indent children, not unrelated bullets. Keep branch conditions explicit. Include
only choices relevant to the user; do not present a heuristic as an exhaustive
classification.

## 6. Timing and state transitions

Use a shared time axis for concurrent processes. Equal-duration intervals must
have equal visual lengths. Label units and distinguish a sampling point from
an interval. For before/after states, repeat the same spatial slots so it is
immediately apparent what changed. Do not use a distorted time axis unless
clearly labelled as schematic.

## 7. Evidence and actions

    FINDING         Concise result
    EVIDENCE        file:line or observed measurement
    WHY IT MATTERS  Consequence
    NEXT ACTION     Specific fix or verification

Use this grouping for investigations or reviews. Separate confirmed observations
from hypotheses. A severe finding goes first; do not add severity ratings with
no defensible basis. Preserve uncertainty and relevant source references.

## 8. Color and compatibility

Prefer Markdown emphasis and semantic labels to raw ANSI in conversational
output. When an existing renderer writes to a verified color-capable terminal,
use a restrained palette, reset colors, and honor NO_COLOR. The same output
must remain clear if color is removed. Avoid actual tab characters and avoid
relying on interactive panels or tabs. Never let decorative formatting delay
or replace the answer.
