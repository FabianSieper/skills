# Entscheidungen beim Erstellen

## Bestehende Regel statt neuer Skill

Anfrage: "Mach einen Skill, der sprechende Variablennamen verlangt."
Kontext: `coding-conventions` enthält bereits dieselbe Konvention.
Ergebnis: Darauf hinweisen; keine Dublette. Nur bei tatsächlicher Lücke einen gezielten Updatevorschlag machen. Nicht allein wegen des Wortes "Skill" einen Ordner erzeugen.

## Wiederverwendbarer neuer Ablauf

Anfrage: "Meine Packlisten entstehen immer gleich: Reisedaten, Klima, Aktivitäten, dann Kategorien mit Mengen. Mach daraus einen Skill."
Ergebnis: `life/packing-list` vorschlagen beziehungsweise bei eindeutigem Auftrag entwerfen. Reisedaten werden Eingaben, nicht globale Konstanten. Mindestens Alltagstrip, wechselndes Klima und fehlende Angaben testen. Nicht ein konkretes Urlaubsziel fest einbauen.

## Projektspezifische Einschränkung

Anfrage: "In diesem Kundenprojekt darf kein zusätzliches npm-Paket dazu."
Ergebnis: Lokale Projektanweisung, nicht weltweite Installationsverbotsregel. Nur im autorisierten Projektziel dauerhaft festhalten.

## Fehlendes Zielrepo

Anfrage: "Erstelle einen Skill für meinen monatlichen Bericht."
Kontext: Nur installierte Skills verfügbar; kein verifizierter Checkout.
Ergebnis: Nutzbaren Dialogentwurf beziehungsweise ausdrücklich beauftragtes Exportpaket liefern; nach Ziel fragen. Kein Verzeichnis im Installer-Cache umfunktionieren. Kein GitHub-Repo mit geratenem Namen anlegen.
