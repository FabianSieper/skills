# Evaluationsvertrag

Version: 0.1.0. Gültiges Markdown und ein plausibler Text beweisen keine Skill-Wirkung.

## Prüfebenen

**Struktur:** Format, Namen, Herkunft, Paketvollständigkeit, Referenzen, Budget, Synchronität generierter Dateien. Tatsächlich ausführen; Inhaltserhalt bleibt eine separate Prüfung.

**Auswahl:** Nur Metadaten und realistischen Nutzerauftrag bereitstellen; beobachten, welcher Skill tatsächlich geladen wird. Sowohl passende Aufgaben als auch nahe Gegenfälle prüfen. Ein ausdrücklicher Skill-Aufruf testet nicht seine automatische Auswahl.

**Ausführung:** Beobachtbares Ergebnis, Datei-Diff, Toolaktionen, Zustimmungsfrage und Stopps gegen Kriterien prüfen. Testlösungen nicht dem ausführenden Agenten mitgeben. Kein Zugriff auf private Gedankengänge erforderlich.

**System:** Bestehende Projektkonventionen, mehrere Skills, fehlende Ressourcen, konkurrierende Änderungen und manipulierte Eingaben einbeziehen. Eine API-Antwort ohne reale CLI-Skill-Erkennung ist kein CLI-Integrationstest.

## Vergleich

Vor einer inhaltlichen Änderung Ausgangsstand und beabsichtigten Nutzen festhalten. Neue Skills sinnvoll mit der bisherigen Arbeitsweise ohne Skill vergleichen, Updates mit dem stabilen Skill. Zusätzlich bestehende geschützte Referenzfälle erhalten. Neue Fälle ergänzen, alte nicht zum Bestehen passend machen.

Identische Inputs und Umgebungen, frische Sessions sowie getrennte Alt-/Neu-Ausführungen verwenden. Bei stochastischen Fällen zunächst drei gepaarte Wiederholungen; das ist ein Startbudget, keine statistische Garantie. Kandidatenlabels bei subjektivem Vergleich verbergen. Nicht das Eigenurteil des Ersteller-Modells allein akzeptieren. Nicht eindeutige Fälle menschlich prüfen.

## Modelle und Kosten

Reale Modell-/CLI-Profile verwenden: Modell-ID, Version, Sampling, Kontext und gegebenenfalls lokale Quantisierung erfassen. Nutzerbezeichnungen nicht als API-IDs erfinden. Alle verpflichtenden Profile vor einer entsprechenden Support-/Releaseaussage prüfen; fehlender Zugang bleibt `not-run`. Mindestens starkes und kleineres vorgesehenes Modell bei der anfänglichen Kompatibilitätsabnahme einbeziehen.

Statische Checks bei jeder Änderung; gezielte Regressionen und profilbezogene Smoke-Tests bei Inhaltsänderungen; volle relevante Systemtests bei Foundation-, Adapter- oder Profilwechseln. Keine unbegrenzten Schleifen oder bezahlten Aufrufe ohne Budget. Fehlendes Budget reduziert nicht heimlich die Pflichtprüfung, sondern blockiert die entsprechende Freigabe.

## Entscheidung

Ein gewonnener neuer Fall darf bestehende wesentliche Anforderungen nicht verschlechtern. Kritische Integritäts-/Freigabeverstöße sind in jedem ausgeführten Test ein Blocker. Resultate pro Profil ausweisen; keine Kompensation durch Mittelwerte. Einen vorgeschlagenen Trade-off ausdrücklich freigeben lassen, nicht als reine Verbesserung darstellen.

Status je Fall: `pass`, `fail`, `inconclusive`, `not-run`. `verified` nur für den tatsächlich geprüften Umfang verwenden. Berichte Messwerte mit Konfiguration und Belegen. Kontextkosten und Laufzeit nicht statt Ergebnisqualität optimieren. Nach zwei erfolglosen Nachbesserungen Diagnose und Blockade melden.
