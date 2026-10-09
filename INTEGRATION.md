# Übergabe an den Umsetzungsagenten

## Auftrag

Verwende dieses Paket **zusätzlich zum [bestehenden Gesamtprompt](docs/IMPLEMENTATION-PROMPT.md)** für die lernende Skill-Library. Die beiden Meta-Skills, der gemeinsame Standard und der erste Coding-Skill wurden bereits konkret ausgearbeitet. Übernimm sie in das vereinbarte Repository und baue die fehlende technische Infrastruktur darum herum.

## Vorgehen

1. **Ziel und Bestand prüfen.** Arbeitsverzeichnis, vorhandene Anweisungen, Git-Status und Nutzerziel ermitteln. Kein fremdes Projekt überschreiben. Vergleiche bestehende Dateien vor dem Import; kopiere bei Konflikten nicht blind. Ein vorhandener fremder `create-skill` oder `improve-skill` darf nicht still ersetzt werden.

2. **Ausgangsbasis sichern.** Paketstand als nachvollziehbaren Foundation-Ausgangspunkt erfassen, nicht als modellvalidierte Release-Version. `canonical_source: null` kennzeichnet die noch offene Bindung. Weise das vom Nutzer gewählte Repo zu, behalte die Repository-ID für diese Library bei und generiere danach die Herkunftsdateien neu. Ein bewusst unabhängiger Fork bekommt eine eigene ID; eine normale zweite Rechnerinstallation nicht.

3. **Vorhandene Inhalte verwenden.** Lies die drei SKILL.md-Einstiege und nur die benötigten Referenzen. Erstelle keine alternative Qualitätslogik. Bei einem echten Problem: Befund, beabsichtigter Diff, betroffener Test und Reviewumfang dokumentieren. Eine begründete Verbesserung ist erwünscht; bloße stilistische Neuerfindung nicht.

4. **Lokale Prüfungen ausführen.** `npm run check` und `npm test` laufen ohne externe Abhängigkeiten. Ergänze im geplanten TypeScript-Tooling eine aktuelle Standardvalidierung mit geeignetem Parser. Der kleine `.mjs`-Helfer ist nur eine fertige Synchronisationshilfe, kein Grund für eine neue konkurrierende Tooling-Architektur.

5. **Fehlende Verwaltung implementieren.** Quellrepo-Registry, verifizierte Resolver, isolierte Kandidaten, zustandsgebundene Vorschläge, zuordenbare Zustimmung und wirksame Release-Grenzen nach Gesamtprompt entwickeln. Das Paket stellt dafür Verträge bereit, keine erfundene bereits lauffähige API. Im Vertrag die Aussage über fehlendes Tooling erst dann gezielt aktualisieren, wenn die Integration tatsächlich verfügbar und getestet ist.

6. **Bootstrap und CLI-Adapter anbinden.** `bootstrap/AGENTS.fragment.md` ist die gemeinsame minimale Anleitung, noch nicht auf Nutzerrechnern installiert. Verifiziere die aktuellen Codex-/Copilot-/OpenCode-Schnittstellen. Integriere idempotent, ohne fremde Anweisungen zu löschen. Automatische Lernchecks nur über tatsächlich verfügbare Hooks oder explizite Wrapper; ohne passende Schnittstelle ehrlich manuellen Modus ausweisen.

7. **Verhaltens- und Modelltests umsetzen.** Die 38 Fälle sind Inputs und Kriterien, nicht bereits ausgeführte Tests. Erzeuge insbesondere für `integration` reale Dateisystem-/Git-/Session-Fixtures. Der Fall `system-new-skill-profile` mit `target_skill: null` betrifft das Bibliotheks-Tooling, nicht den Erstellungs-Skill. Halte Kriterien vom Ausführungsagenten getrennt. Konfiguriere die tatsächlichen Nutzerprofile aus `evaluations/profiles.example.json` und teste nach Evaluationsvertrag.

8. **Installation und Updates separat verifizieren.** Verschachtelte Erkennung, einzelne Skill-Pakete, Ressourcen, Copy-/Symlink-Verhalten, GitHub-Quelle, neue Skill-Installation und vorhandene Updates testen. Kein Download war in der Erstellungsumgebung möglich; dieser Nachweis steht noch aus. Herkunft ist nicht Vertrauen, eine installierte Kopie nicht das Quellrepo.

9. **Schutz wirklich durchsetzen.** Foundation-Dateien und Referenzprüfungen mit vertrauenswürdigem Runner und passend begrenzten Rechten sichern. Ein Agent mit denselben uneingeschränkten Rechten kann lokale Regeln und Hashes verändern. Deshalb keine autonome Release-Freigabe behaupten, bevor die technische Grenze nachgewiesen ist.

10. **End-to-End nachweisen.** Nutzerkorrektur -> knappe Zustimmung -> verifiziertes Quellziel -> Kandidat -> Alt-/Neu-Prüfung -> getrennte Freigabe -> gezielte Installation. Zusätzlich Verweigerung, Konflikt und Rollback testen. Nicht verfügbare Profile als `not-run` ausweisen; sicheren Vorschlagsmodus liefern, bis die relevanten Nachweise vorliegen.

## Inhaltliche Grenzen, die erhalten bleiben müssen

- Einzelfall und Projektausnahme sind keine globale Konvention.
- Eine bereits vorhandene, aber nicht angewendete Regel wird nicht einfach dupliziert.
- Relevante Ausnahmen gehen beim Kürzen nicht verloren.
- Eigene Protokolle und Testergebnisse erteilen keine unabhängige Freigabe.
- Meta-Skills und Prüfregeln dürfen nicht beiläufig ihren eigenen Schutz abschaffen.
- Fehlende Tests bleiben sichtbar, auch wenn ein stärkeres Modell gut aussieht.

## Abschlussstatus

Berichte getrennt: Inhalte übernommen, lokales Tooling geprüft, CLI-Anbindungen getestet, Modelle validiert, Remote-Schutz aktiv und autonome Veröffentlichung freigegeben. Keiner dieser Zustände folgt automatisch aus dem vorherigen.
