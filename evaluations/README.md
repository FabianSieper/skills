# Verhaltensevaluation: vorbereitet, nicht ausgeführt

`cases/regressions.json` enthält 30 spezifizierte Verhaltens-/Integrationsfälle; `cases/routing.json` acht Auswahlfälle. Das sind **Testdefinitionen**, kein Nachweis ihrer erfolgreichen Ausführung.

## Testaufbau

1. Profil mit tatsächlicher Modell-ID, Agenten-CLI, Version, Parametern und gegebenenfalls Quantisierung konfigurieren. Budget und verpflichtende Profile festlegen. Kein Profil als unterstützt ausweisen, solange es nicht geprüft ist.
2. Baseline und Kandidat in getrennten isolierten Testumgebungen bereitstellen. Bei neuen Skills auch Ohne-Skill-Baseline. Den Ausführungsagenten nur `input`, notwendige Fixture-Dateien und ausgewählte Skills geben; nicht die `expected`-Kriterien.
3. Routing-Fälle ohne ausdrückliche Skill-Nennung im Systemprompt ausführen; tatsächliches Laden beobachten. `null` bedeutet: Keinen der drei Foundation-Skills für diese Aufgabe neu auswählen. Bei bereits geladenem Fach-Skill dessen einmalige Anwendung von unerwünschter Library-Pflege unterscheiden.
4. Verhalten anhand Ausgaben, Diffs und Toolaktionen beurteilen. Integrationsfälle brauchen reale Dateisystem-/Git-Fixtures und die noch zu implementierenden Adapter. Ein Modellversprechen, Symlinks geprüft zu haben, besteht den Integrationstest nicht.
5. Drei gepaarte Wiederholungen pro stochastischem Fall als Start; kritische Verstöße einzeln ausweisen. Mehrdeutige Kriterien beziehungsweise Resultate als `inconclusive` behandeln und manuell prüfen.
6. Ergebnisse getrennt von Testdefinitionen mit `case_id`, Profil, Revisionen, Status, Belegpfaden und Messwerten speichern. `initial_status` in den Definitionen nicht als Laufresultat umschreiben.

## Was noch gebaut werden muss

Kein Cloud-/lokaler Modellrunner, keine CLI-Session-Fixtures und keine unabhängige Freigabeinstanz sind Bestandteil dieser Lieferung. Der Umsetzungsagent implementiert sie anhand des bestehenden Gesamtauftrags. Bereits enthaltene Node-Tests prüfen Paket-/Referenzintegrität, nicht Modellverhalten.

Bestehende Fälle sind nachvollziehbare Regressionen, keine geheimen Holdouts. Der Prüfmechanismus muss sie vor Abschwächung durch den normalen Updateweg schützen. Für unabhängige Evaluation ist vertrauenswürdiger Runnercode erforderlich, nicht nur ein Agentenbericht.
