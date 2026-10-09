# Arbeiten an dieser Foundation

Dieses Repository enthält die ausgearbeitete Skill-Ausgangsbasis, nicht bereits das komplette selbstverbessernde Tooling. Lies `INTEGRATION.md`, bevor du den bestehenden Gesamtauftrag umsetzt.

Behandle die drei vorhandenen Skills als bewusst entworfenen Startpunkt. Keine pauschale Neufassung und kein stilles Abschwächen ihrer Grenzen. Behebe konkrete Mängel mit kleinem Diff, Test und dokumentierter Begründung. Ob ein Skill tatsächlich besser funktioniert, muss noch mit den Zielmodellen geprüft werden.

Kanonische Quellen liegen in `governance/` und `templates/`. Generierte Ressourcen in `skills/*/*/references/` beziehungsweise `assets/` nicht separat bearbeiten. Nutze `npm run generate:preview`, gegebenenfalls `npm run generate`, dann `npm run check` und `npm test`.

`foundation.json`, Governance, Meta-Skills, Bootstrap, Prüfcode und bestehende Testkriterien gehören zum Foundation-Reviewumfang. Eine Datei unter `protected-paths.json` ist nicht allein dadurch technisch geschützt. Rechte-Trennung und Release-Gates müssen erst implementiert und getestet werden.

Kein Test ohne Ausführung als bestanden melden. Keine Modell-ID aus einer Nutzerbezeichnung erfinden. Keine Zugangsdaten, Rohtranskripte oder Kundeninformationen einchecken. Fehlende Registry, Modellzugänge oder Berechtigungen offen dokumentieren; nicht durch fiktive Ergebnisse ersetzen.
