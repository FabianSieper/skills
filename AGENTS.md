# Repository instructions

## Website-automation changes

Before creating, changing, extending, refactoring, repairing or reviewing any
website-automation skill in this repository, **read and use**
[website-automation-builder](.agents/skills/website-automation-builder/SKILL.md).
This includes its state evidence, flows, transport, tests, generated artifacts
and operating instructions. It also applies when changing the builder or the
website-automation concept itself.

Follow the skill's reading routes to the canonical concept in
`docs/strict-automation/`. The default website-automation skill uses the
munim-computer-use MCP (`munim-computer-use_*`) against a visible browser and
mirrors the focused shape of `skills/cardmarket-automation`: `SKILL.md`,
`references/transport.md`, `references/flows.md`, `references/selectors.md`,
`agents/openai.yaml` and `.gitignore`. It must retain the hard prerequisite
gate, single bound tab, fresh accessibility-state checks, scenario navigation
rules, and disabled durable writes. Do not reintroduce a CLI, package, compiled
runtime, scaffold, alternate browser path or another computer-use MCP. A Safari/Chrome
choice is a browser fallback, not a transport fallback: both browsers must use
the same generic `munim-computer-use_*` tools, and
`munim-computer-use_browser_*` is not the canonical path.

This requirement applies whether the host implicitly discovers the skill or
not. If the file cannot be read, report that specific missing prerequisite;
do not silently use another builder. User instructions retain precedence.

Merely running an existing website skill, or working on unrelated skills, does
not invoke the builder. Preserve unrelated work and keep migrations scoped to
the user's request. Instructions guide compliant agents; they do not sandbox
arbitrary shell access or prove runtime safety.
