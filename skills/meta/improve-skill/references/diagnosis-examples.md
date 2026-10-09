# Diagnosebeispiele

## Regel fehlt

Nutzer: "Bei Dauern möchte ich generell die Einheit im Namen sehen."
Prüfung: Noch keine entsprechende Regel im betroffenen Skill.
Vorschlag: "Dauerhaft in **coding/coding-conventions** aufnehmen: „Benenne Zeitdauern mit erkennbarer Einheit.“ Übernehmen?"
Test: `timeout` mit Millisekundenwert wird nachvollziehbar benannt; etablierte typisierte Dauerabstraktion bleibt verständlich, ohne redundante Namenspflicht zu erfinden.

## Regel existiert, wurde aber nicht geladen

Nutzer: "Du hast schon wieder offensichtlichen Code kommentiert."
Beleg: Die Regel steht klar im Skill, der in der Session nicht geladen wurde.
Ergebnis: Routing-/Auswahlfall reproduzieren; gegebenenfalls Beschreibung verbessern. Nicht dieselbe Regel in Großbuchstaben wiederholen oder gleichzeitig in jeden anderen Skill kopieren.

## Unzulässige Verallgemeinerung

Nutzer: "Hier bitte ohne neue Klassen."
Ergebnis: Auf den aktuellen Kontext anwenden. Keine Regel "niemals Klassen" aufnehmen. Nur bei wirklich entscheidender Unklarheit Geltungsbereich erfragen.

## Konflikt mit bisheriger Präferenz

Bisher: Begründungen und API-Verträge dürfen dokumentiert werden.
Nutzer: "Ab jetzt gar keine Kommentare mehr."
Ergebnis: Eine gezielte Frage, ob die bisher erlaubten Begründungs-/Vertragskommentare ebenfalls entfallen sollen. Nicht still einen pauschalen Ersatz mit ungeklärten Ausnahmen anwenden.

## Reine Stilkosmetik ohne Nutzennachweis

Befund: Der Agent bevorzugt eine andere Formulierung, alle vorhandenen Fälle funktionieren.
Ergebnis: Nicht als autonome inhaltliche Verbesserung verkaufen. Ohne konkreten Bedarf keine Änderung; ausdrücklich beauftragte redaktionelle Änderungen separat kennzeichnen.
