# Executed fixture verification

Verified 2026-09-06T13:42:44+02:00 with Node 26.7.0 and playwright-cli 0.1.19. Typecheck, precompiled build, 46 unit/process integration tests and build validation passed. The fixture server served its HTML over localhost. The portable Runtime was also executed from a copy without src or node_modules.

The executable CLI double ran the real compiled POM wrappers and covered missing browser, failed attach, named-session reuse, CDP configuration, input validation, drift, compact observation, artifact integrity and write failure/replay states.

Live Chrome: extension attach and named session reuse passed. `doctor`, `status`, `inspect`, diagnostic inspect, `inspect-region search-filters`, screenshot, `inventory.find` with a hit and empty result, and the non-mutating `inventory.update-title` plan passed on the localhost fixture. Execute was intentionally not called, so no real browser write occurred. This local fixture is not evidence for an external production website.
