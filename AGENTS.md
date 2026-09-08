# Repository instructions

## Website-automation changes

Before creating, changing, extending, refactoring, repairing or reviewing any
website-automation skill in this repository, **read and use**
[website-automation-builder](.agents/skills/website-automation-builder/SKILL.md).
This includes its POMs, components, actions, workflows, runtime/transport,
tests, generated artifacts and operating instructions. It also applies when
changing the builder or the website-automation concept itself.

Follow the skill's reading routes to the canonical concept in
`docs/strict-automation/`. Use playwright-cli as the browser transport. Keep the
operating agent's interface simple and enforce the state/effect/error contracts
in tooling. Do not invent an alternative architecture or treat legacy Cardmarket
behavior as permission to bypass the concept.

This requirement applies whether the host implicitly discovers the skill or
not. If the file cannot be read, report that specific missing prerequisite;
do not silently use another builder. User instructions retain precedence.

Merely running an existing website skill, or working on unrelated skills, does
not invoke the builder. Preserve unrelated work and keep migrations scoped to
the user's request. Instructions guide compliant agents; they do not sandbox
arbitrary shell access or prove runtime safety.
