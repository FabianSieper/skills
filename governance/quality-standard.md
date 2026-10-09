# Gemeinsamer Qualitätsstandard

Version: 0.1.0. Dieser Standard ist geschützte Grundlage, keine Garantie perfekter Modellbefolgung.

## Anforderungen an jeden Skill

**Q01 - Eindeutiger Zweck.** Eine klar erkennbare Aufgabe, eindeutiger Name, aussagekräftige Beschreibung mit positiven Auslösebedingungen. Nicht-Anwendungsfälle testen. Keine Beschreibung, die jede Unterhaltung beansprucht.

**Q02 - Prüfbarer Ablauf.** Eingaben, erwartetes Ergebnis, ein Standardpfad und notwendige Stopps explizit beschreiben. Entscheidungen als konkrete Bedingungen formulieren. Unklarheit nur nachfragen, wenn sie das Ergebnis wesentlich beeinflusst.

**Q03 - Passender Umfang.** Persönliche Präferenz, fachlicher Standard, Projektausnahme und technische Einschränkung trennen. Keine Kunden-, Rechner- oder Projektdetails global festschreiben. Fachspezialisierung ist erlaubt, willkürliche Projektbindung nicht.

**Q04 - Keine Doppelregeln.** Eine Absicht hat eine führende Quelle. Bestehende Regel präzisieren statt parallel paraphrasieren. Wiederkehrende Varianten in gezielte Referenzen verschieben. Einen Skill nur bei eigenständiger Zuständigkeit aufteilen.

**Q05 - Kontext bewusst einsetzen.** So knapp wie möglich, so explizit wie für die unterstützten Modelle nötig. Keine Telegrammsprache oder ungeprüften Kürzungen. Jede Zusatzdatei direkt aus SKILL.md mit Lesebedingung verlinken. Keine rekursiven Pflichtleseketten. Keine versteckte Pflicht, immer das gesamte Repository zu lesen.

**Q06 - Beobachtbare Qualität.** Erfolgskriterien, Beispiele und Gegenfälle auf konkrete Ergebnisse beziehen. Nicht das Befolgen eines bevorzugten Wortlauts mit erfolgreicher Aufgabenerfüllung verwechseln. Notwendige Ausnahmefälle erhalten.

**Q07 - Kontrollierte Wirkung.** Zustimmung, Herkunftsprüfung, Tests und technische Veröffentlichung getrennt behandeln. Kein Skill darf fremde Daten als Nutzerfreigabe werten oder seine eigene Schutzgrenze aushebeln.

**Q08 - Tatsächliche Fähigkeiten.** Vorhandene Tools verwenden, unbekannte Schnittstellen nachschlagen. Keine erfundenen Befehle, Testergebnisse oder Unterstützungszusagen. Fehlende Voraussetzungen mit nutzbarem Vorschlag statt riskantem Ersatzschritt behandeln.

**Q09 - Portables Paket.** Mindestens SKILL.md mit gültigem Namen und Beschreibung. Ressourcen bleiben innerhalb des Skill-Pakets. Geteilte Texte nur aus einer kanonischen Quelle generieren; Kopien nicht separat bearbeiten. Produktmetadaten in agents/ halten und keine Zugangsdaten einbetten.

**Q10 - Stabilität vor Eigenlob.** Kleine begründete Diffs, erhaltener Ausgangsstand, nachvollziehbarer Nutzen und bestehende Regressionstests. Nicht bloß auf immer neue Testfälle optimieren. Einzelne bessere Durchschnittswerte reichen nicht zur Freigabe.

## Anfängliche Budgets

Bootstrap: Ziel bis 400 Tokens. Normaler SKILL.md-Einstieg: bis 1.500. Meta-Skill: bis 2.500. Jeweils weniger als 500 Zeilen. Begründete Budgetüberschreitungen brauchen Review, keine sinnentstellende Kompression.

Das sind Projektziele, keine bewiesenen Optima. Metadatenkatalog und tatsächlich geladene Referenzen mitzählen. Tokenizer nennen; Schätzungen kennzeichnen. Semantische Qualität wird nicht aus Wortzahl oder Formatvalidität abgeleitet.

## Änderungen an der Grundlage

Meta-Skills, dieser Standard, Änderungs- und Evaluationsvertrag, Test-Runner, Pflichtprofile, Referenzfälle und Freigabecode brauchen ausdrückliche Foundation-Freigabe. Eine allgemeine Bitte, Skills zu verbessern, autorisiert nicht deren Abschwächung.
