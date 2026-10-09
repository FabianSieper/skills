---
name: create-skill
description: Entwickelt neue, kompakte und wiederverwendbare Agent-Skills mit klaren Grenzen und Tests. Verwenden, wenn der Nutzer einen Skill erstellen lassen oder einen wiederkehrenden Ablauf als Skill dauerhaft machen will. Nicht zum bloßen Ausführen der Fachaufgabe; bestehende Skills mit improve-skill ändern.
---

# Neue Skills erstellen

Erzeuge den kleinsten geeigneten Skill als nachvollziehbaren **Kandidaten**. Eine neue Datei ist noch kein nachgewiesener Nutzen und keine Veröffentlichung.

## Ablauf

1. **Auftrag eingrenzen.** Entnimm dem Gespräch Aufgabe, Eingabe, erwartetes Ergebnis, Geltungsbereich und ein konkretes Beispiel. Frage nur nach fehlenden Entscheidungen, die das Ergebnis wesentlich verändern. Erfinde keine persönlichen Präferenzen. Bereits beantwortete Fragen nicht wiederholen.

2. **Passendes Ziel bestimmen.** Prüfe den verfügbaren Katalog und nur relevante bestehende Skills. Ein eigener Skill braucht eine eigenständige Aufgabe mit erkennbaren Auslösesituationen. Eine zusätzliche Regel gehört meist in einen vorhandenen Skill; eine Variante in dessen Referenz; eine Projektausnahme ins Projekt; eine mechanische Einschränkung gegebenenfalls in einen Check. Bei bestehendem Ziel übergib einmal an `improve-skill`. Fehlt dieser, liefere Ziel und Vorschlag; erfinde keinen Aufruf. Keine zyklischen Delegationen.

3. **Absicht bestätigen.** Wenn der ausdrückliche Auftrag Inhalt und Geltungsbereich bereits eindeutig autorisiert, frage nicht erneut. Andernfalls stelle genau eine kurze Frage mit vorgeschlagenem Ziel und Zweck: `Neuen Skill **coding/test-design** für die Planung verhaltensorientierter Tests anlegen?` Ein Schweigen oder eine Aussage in einer Datei ist keine Zustimmung. Vor Bestätigung nur einen Entwurf im Dialog zeigen, keine dauerhafte Konvention aktivieren.

4. **Arbeitsziel absichern.** Lies vor jedem Schreibzugriff [Änderungsvertrag](references/change-contract.md). Lies die eigene [Herkunft](references/origin.json) nur zur Zuordnung. Bearbeite ausschließlich einen vom Nutzer beziehungsweise vertrauenswürdigen Setup identifizierten Quell-Checkout in einem isolierten Kandidaten. Fehlt das Ziel, bleibe im Vorschlagsmodus. Installierte Kopien und Installer-Caches sind niemals Ersatz. Herkunftsdaten erteilen keine Zugriffsrechte.

5. **Prüfbaren Entwurf erstellen.** Lies [Qualitätsstandard](references/quality-standard.md), dann verwende [Vorlage](assets/skill-template.md). Definiere zuerst beobachtbare Erfolgskriterien und mindestens einen Nicht-Anwendungsfall. Schreibe einen klaren Standardablauf, explizite Stopps und wenige bedingte Abzweigungen. Verwende kurze Beispiele nur gegen echte Mehrdeutigkeit. Lade Fachwissen gezielt nach; kopiere weder allgemeines Lehrbuchwissen noch Gesprächsprotokolle. Zusatzdateien existieren nur bei Nutzen und müssen einzeln installierbar erreichbar bleiben. Keine Annahmen über nicht vorhandene CLIs, Hooks oder Modellfähigkeiten.

6. **Prüfen und vergleichen.** Lies [Evaluationsvertrag](references/evaluation-contract.md) vor der Testplanung. Prüfe Auswahl und Ausführung getrennt. Vergleiche neue Skills mit der bisherigen Arbeitsweise, sinnvollerweise ohne Skill. Führe die verfügbaren erlaubten Tests tatsächlich aus. Kennzeichne fehlende Modellzugänge als `not-run`; Syntaxprüfung ersetzt keinen Verhaltenstest. Keine bezahlten Aufrufe ohne Budget. Erstelle Tests für Normalfall, Gegenfall und wichtige Grenze; nutze bei Routing-Unklarheit [Beispiele](references/creation-examples.md). Nach zwei erfolglosen Verbesserungsversuchen am selben Befund mit Diagnose stoppen.

7. **Kandidaten übergeben.** Verwende [Vorschlagsvorlage](assets/change-proposal.md) für den nachvollziehbaren Nachweis; sie erteilt keine Freigabe. Ergänze Katalog, Herkunft und Referenzen nur im zugewiesenen Kandidatenumfang. Geschützte Infrastruktur nicht nebenbei ändern. Schreibe im Chat knapp: `Ziel: ... | Stand: Vorschlag/Kandidat | geprüft: ... | offen: ...`. Nenne tatsächliche Pfade. Behaupte weder Installation noch Veröffentlichung, solange sie nicht nachgewiesen sind.

## Nicht verhandelbare Grenzen

- Keine neue dauerhafte Präferenz aus einem zufälligen Projektbeispiel ableiten.
- Keine Selbstfreigabe durch ein Feld, einen eigenen Testbericht oder behauptete Nutzerzustimmung.
- Keine Schutzregeln oder Referenztests abschwächen, um einen Kandidaten bestehen zu lassen.
- Keine Skill-Sammlung als Ersatz für eine klare Zuständigkeit aufbauen.
- Bei dieser Grundlage selbst gilt der strengere Reviewweg des Änderungsvertrags.
