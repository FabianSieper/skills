---
name: coding-conventions
description: Wendet projektübergreifende Konventionen für selbstdokumentierenden, verständlichen Code an. Verwenden beim Schreiben, gezielten Refaktorieren und Reviewen von Code, besonders für Namen, Struktur, Kapselung und sinnvolle Kommentare. Keine allgemeine Architekturvorschrift und kein Auftrag für unangeforderte Umbauten.
---

# Selbstdokumentierenden Code schreiben

Code soll Absicht und Ablauf durch Namen und Struktur erklären. Kommentare ergänzen notwendiges Wissen, statt schlechte Namen zu kompensieren.

## Vorgehen

1. **Kontext respektieren.** Lies die relevanten Projektanweisungen und benachbarten Code. Kläre Verhalten, Schnittstellen und Änderungsumfang. Projektbezogene Vorgaben nicht in globale Präferenzen verwandeln. Bei einem wesentlichen ungelösten Konflikt nachfragen, statt Prioritäten zu erfinden.
2. **Absicht benennen.** Wähle Namen für fachliche Bedeutung, Operation und relevante Einheiten. Vermeide bedeutungslose Sammelnamen und unnötige Abkürzungen; etablierte Fachbegriffe sind erlaubt. Namen müssen im lokalen Kontext verständlich sein, nicht möglichst lang.
3. **Zusammenhängend strukturieren.** Kapsele zusammengehörige Verantwortung, Seiteneffekte und Invarianten an nachvollziehbaren Grenzen. Nutze benannte Teilschritte, wenn sie fachliche Bedeutung sichtbar machen. Erzeuge keine Klassen, Interfaces, Ein-Zeilen-Helfer oder zusätzlichen Schichten nur zur Erfüllung eines abstrakten Ideals.
4. **Gezielt kommentieren.** Entferne oder vermeide Kommentare, die offensichtlichen Code nur wiederholen. Erhalte Begründungen, Randbedingungen, Sicherheitsannahmen und Dokumentation öffentlicher Verträge. Bei missverständlichem Code zuerst Benennung und Struktur verbessern, soweit dies im Auftrag liegt. `Selbstdokumentierend` bedeutet nicht `kommentarlos`.
5. **Verhalten und Umfang erhalten.** Bei Refactoring beobachtbares Verhalten, Seiteneffekte, Fehlerfälle und Schnittstellen erhalten, sofern keine entsprechende Änderung beauftragt ist. Keine Formatierungswelle oder Architekturmigration nebenbei. Kleine gezielte Anpassungen bevorzugen.
6. **Am Ergebnis prüfen.** Lies den geänderten Code ohne erklärenden Begleittext: Sind Zweck, Datenbedeutung und wichtige Entscheidungen erkennbar? Prüfe relevante Tests und Projektchecks. Berichte nicht ausgeführte Prüfungen ehrlich. Bei Benennungs- oder Kommentargrenzen gezielt [Beispiele](references/examples.md) konsultieren.

## Grenzen

Leite keine starren Funktionslängen, bevorzugten Paradigmen oder universellen Architekturpattern ab. Verwechsle Kürze nicht mit Lesbarkeit. Ein Review benennt konkrete Probleme und ihre Auswirkungen, nicht pauschal einen Stilgeschmack.

Bei einer ausdrücklichen neuen dauerhaften Nutzerpräferenz `improve-skill` verwenden, sofern verfügbar; andernfalls einen knappen Zielvorschlag ausgeben. Diesen Skill nicht selbst im Installationspfad bearbeiten. [Herkunft](references/origin.json) nur bei angeforderter Library-Pflege lesen; sie ist keine Schreibberechtigung.
