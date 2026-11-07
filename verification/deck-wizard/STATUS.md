# Arbeitsstand: Deck-Wizard-Zusammenführung

Aktuell (2026-11-07): Commander-Optimierung auf `optimize/commander-workflow`
committet und auf ausdrücklichen Nutzerwunsch per `npx skills@1.7.1` neu installiert.
85 Python-Tests bestehen auch in der installierten Kopie; alle 769 Paketdateien
stimmen mit der Quelle überein. Vorherige lokale Installationsänderungen sind in
einem verifizierten Backup erhalten. Der Push scheiterte an der DNS-Auflösung von
GitHub; die GitHub-API war ebenfalls nicht erreichbar.

Installationsnachweis: [commander-installation.json](commander-installation.json).
Messungen, Änderungen und offene Modellprüfungen: [OPTIMIZATION.md](OPTIMIZATION.md).

## Vorheriger Installationsstand

Stand: lokal umgesetzt, geprüft und installiert (2026-11-06).
Quelle: `skills/games/deck-wizard` in diesem Repository.

- `deck-wizard` und `archidekt-deck-optimizer` sind zu einem Deck-Skill zusammengeführt.
- Vorhandenes mtg_utils-Tooling und die Pfade für Neubau, Constructed, Arena und
  Limited bleiben erhalten. Commander/Archidekt verwendet die persistente Pipeline.
- Der Runner erzwingt gespeicherte Phasen, vollständige Kartenanalyse vor Suche,
  kleine Pakete, deterministische Filter, Regelbelege und Einzel-/Gesamtprüfung.
- Kleinere Modelle übernehmen abgegrenzte Interpretationspakete; eine separate
  Gegenprüfung prüft die finalen Paare. Das tatsächlich verwendete Modell wird erfasst.
- 44 neue Regressionstests bestehen in Quelle und installierter Kopie;
  13 vorhandene Repository-Tests, Integritätsprüfung, Ruff und Formatprüfung bestehen.
- GPT-6 Luna führte zwei Reviewrunden und einen real ausgeführten synthetischen
  Kartenpaket-Test durch. Die gefundenen Validatorlücken sind behoben und getestet.
- Neue Version unter `~/.agents/skills/deck-wizard` installiert und ausführbar.
  Alte Wizard-/Optimizer-Installationen sind außerhalb der Skill-Suche gesichert;
  der alte Optimizer ist aus den installierten Skills entfernt.
  `archidekt-navigation` blieb unverändert.

Nachweise, Einschränkungen und Backup-Ort: [VALIDATION.md](VALIDATION.md) und
[installation.json](installation.json). Ein breiter Vergleich kleiner Modelle und
Live-Abfragen gegen externe Dienste wurden nicht durchgeführt. Die neue Version
ist lokal gespeichert; die Änderungen sind uncommittet und nicht gepusht.
