# Umsetzungsplan

Stand: 9. Oktober 2026. Ziel: https://github.com/FabianSieper/skills.
Der Nutzer hat den vollständigen Ersatz des bisherigen Repository-Inhalts durch
die Foundation beauftragt. Die Git-Historie bleibt erhalten; kein Force-Push.

| Phase | Abnahme | Status |
| --- | --- | --- |
| 1. Bestand und Foundation | Original sichern, drei Skills übernehmen, Herkunft binden, lokale Checks ausführen | Lokal erledigt; Veröffentlichung separat prüfen |
| 2. Installationsbasis | Gepinnte skills-CLI, verschachtelte Auswahl, vollständige Einzelpakete, isolierte Installation | Lokaler Smoke-Test; GitHub-Installation, Updates und feste Revisionen offen |
| 3. Vollständiger vertikaler Lernvorgang | Striktes TypeScript, YAML-/Schema-Validierung, Registry/Resolver, Vorschlag und isolierter Kandidat; Zustimmung/Tests/Release getrennt; Verweigerung testen | Offen; nächster Implementierungsschritt |
| 4. Agentenanbindungen | Markierte Bootstrap-Abschnitte, Backup, Dry-Run, zweimaliges Setup und Deinstallation für Codex/Copilot/OpenCode | Offen; vorhandene globale Konfiguration nicht geändert |
| 5. Fehlerfälle und Evaluation | Bestehende 38 Fälle ausführen, Profilkonfiguration und Budget, drei gepaarte Wiederholungen; Konflikte, Drift und Manipulation prüfen | Offen; Modellfälle not-run |
| 6. Remote-Freigabe | Rechte-Trennung, Branch-Regeln und vertrauenswürdige Statusprüfungen mit tatsächlicher Agentenidentität nachweisen | Offen; autonome Veröffentlichung gesperrt |
| 7. Betrieb und Rückweg | Zweite isolierte Installation aktualisieren, neue Skills gezielt synchronisieren, Revert und Wiederherstellung ausführen | Offen |

## Nächster Arbeitsschritt

Auf einem eigenen Branch Phase 3 implementieren. Zuerst einen kompletten kleinen
Durchlauf für `coding-conventions` bauen: bereinigte Nutzerkorrektur → Vorschlag
mit ID/Inhalt/Ziel/Basis → zugeordnete Nutzerentscheidung → geprüfter Checkout →
Worktree → vertrauenswürdiger Vergleich → menschlich freizugebender Diff.
Gleichzeitig den abgelehnten Durchlauf testen. Erst danach die weiteren Befehle
und Adapter ausbauen. Eine lokal frei beschreibbare Entscheidung ist keine
authentifizierte Veröffentlichungsfreigabe.

Die ursprünglichen drei SKILL.md-Einstiege bleiben beim Import unverändert.
`INTEGRATION.md` und `docs/IMPLEMENTATION-PROMPT.md` enthalten die vollständigen
Anforderungen. Fehlende Teile werden nicht durch diesen Plan erfüllt.

## Noch erforderliche Entscheidungen

- Reale CLI-/Modellprofile und ein Budget vor bezahlten Modellläufen bestimmen.
- Repository-Sichtbarkeit und wirksame Rechte-Trennung prüfen; beim Import die
  vorhandene Sichtbarkeit unverändert lassen.
- Reale Agentenkonfiguration erst nach isolierter Adapter-Abnahme einrichten.
