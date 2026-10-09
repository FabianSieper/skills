# Kompatibilität

Prüfdatum: 9. Oktober 2026. Die Version eines installierten Programms ist kein
Nachweis, dass es die Skills in einer echten Session verwendet.

| Komponente | Tatsächlich geprüft | Grenze |
| --- | --- | --- |
| Node.js 24.19.0 / npm 11.17.0 | Bei erster Bestandsaufnahme verfügbar; Foundation-Checks und 13 Node-Tests bestanden | Node 24 ist LTS; `.nvmrc` empfiehlt diese Linie |
| Node.js 26.7.0 / npm 11.19.0 | Bei Abschlussprüfung tatsächlich aktiv; Foundation-Checks, 13 Tests und Installer-Smoke bestanden | Systeminstallation nicht von diesem Import geändert; Node 26 ist zum Prüfdatum Current, keine LTS-Empfehlung |
| Git 2.55.0 | Checkout, vollständiges Bundle, isolierter Worktree | Remote-Schutz nicht geprüft |
| skills 1.7.1 (MIT; Node >=22.20.0) | npm-Paket geladen; lokale Erkennung, Standard-/Copy-/Einzelinstallation bestanden; Ressourcen bytegleich | GitHub-Updates und Wiederherstellung noch offen |
| Codex CLI 0.162.0 | Version abgefragt | Bootstrap, Hooks und Session-Erkennung nicht getestet |
| GitHub Copilot CLI 1.0.94 | Version abgefragt | Bootstrap, Hooks und Session-Erkennung nicht getestet |
| OpenCode 2.0.26 | Version außerhalb der Sandbox abgefragt, da CLI ihre Logdatei öffnet | Bootstrap, Plugin-Ereignisse und Session-Erkennung nicht getestet |
| Sol/Luna/Qwen/Ornith | Keine tatsächlichen Modellprofile verifiziert | Alle Modelltests not-run; Bezeichnungen bleiben Nutzerbezeichnungen |

Die vorhandenen Integritätswerkzeuge sind implementiert und lokal getestet.
`skillctl`, sichere Registry, Evaluationsrunner und Adapter sind noch nicht
implementiert. Keine automatische Veröffentlichung wird als unterstützt gemeldet.
Tokenmessungen fehlen; Wortzahlen sind keine Tokenzahlen.

## Primärquellen

- [Agent-Skills-Spezifikation](https://agentskills.io/specification): SKILL.md,
  YAML-Metadaten und portable Ressourcen.
- [Vercel skills](https://github.com/vercel-labs/skills): add, Auswahl, copy und
  gezielte Updates. Für weitere Tests Version 1.7.1 verwenden; dokumentierte
  Optionen nicht mit ausgeführten Integrationsfällen gleichsetzen.
- [Codex Skills](https://learn.chatgpt.com/docs/build-skills) und
  [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- [Copilot-Anpassung](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/overview).
- [OpenCode Skills](https://opencode.ai/docs/skills/),
  [Regeln](https://opencode.ai/docs/rules/) und
  [Plugins](https://opencode.ai/docs/plugins/).
- [Anthropic skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md):
  Referenz für Test-/Vergleichsplanung; kein fremder Code oder Text neu übernommen.
- [GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
- [Node.js-Releases](https://nodejs.org/en/about/previous-releases): Node 24 LTS.

Die Quellen wurden geöffnet. Genaue Adapterpfade, Vorrangregeln und Reloads
müssen bei ihrer Implementierung gezielt geprüft und dann hier ergänzt werden.
