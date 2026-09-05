# Eingaben und Erkundung

## Minimale erste Rückfrage
Nur fehlende Teile fragen:
"Welche Website und welche konkreten Aktionen soll der spätere Skill unterstützen? Nenne pro Aktion bitte ein Beispiel und woran du ein erfolgreiches Ergebnis erkennst. Darf der Skill dabei Daten verändern, und gibt es dafür ein Testkonto?"

Browserannahme nicht erneut erfragen: standardmäßig ist Chrome bereits geöffnet und soll über playwright-cli wiederverwendet werden. Nur nachfragen, wenn Extension/CDP technisch nicht verfügbar ist oder der Nutzer ausdrücklich einen anderen Browser verlangt.

## Aktionsvertrag
Pro Aktion dokumentieren:
```yaml
id: inventory.find
kind: read
purpose: Artikel nach Artikelnummer finden
input: { sku: { type: string, required: true } }
output: { itemId: string, title: string, available: boolean }
start: angemeldeter bestehender Browser; Inventar erreichbar
identity: exakte Artikelnummer
steps: [Inventar öffnen, Suche füllen, auslösen, Ergebnis prüfen]
success: exakte Artikelnummer oder expliziter Leerzustand
next: [inventory.open]
permissions: nur lesen
status: unclarified
```

## Erkundungsstrategie
In DISCOVER darf der Builder playwright-cli direkt verwenden. Ziel ist nicht, diese Befehle später zu wiederholen, sondern daraus stabile POM-Methoden und Actions zu bauen.

1. Bereits offenen Browser/Session verwenden.
2. Bekannte Seite und sichtbaren Zustand bestimmen.
3. Nächsten fachlich passenden Weg beobachten.
4. Ziel durch Zustandsanker/URL/DOM bestätigen.
5. robuste Locators und Postcondition dokumentieren.
6. Flow als POM + Action implementieren.

Nach zwei erfolglosen Hypothesen oder fünf Minuten ohne Fortschritt pro Aktion gezielt nach Nutzerflow fragen. Früher fragen, wenn mehrere fachlich unterschiedliche Wege passen oder ein riskanter Schritt zur Erkundung nötig wäre.

Beispiel:
"Ich bin bei 'Bestellungen' und sehe 'Offen' und 'Archiv', aber keinen Rechnungsbereich. Öffnest du zuerst eine einzelne Bestellung oder gibt es dafür einen eigenen Bereich? Bitte beschreibe deine Klickfolge; alternativ reicht ein Screenshot."

Nutzerantwort erklärt den fachlichen Weg, beweist aber keinen Locator. Anschließend aktuellen DOM erneut prüfen.

## Build-State
```json
{
  "phase": "DISCOVER",
  "site": "https://example.org",
  "decisions": {
    "locale": "de-DE",
    "browser": "existing-open-chrome",
    "attach": "playwright-cli-extension",
    "session": "example-automation"
  },
  "actions": {"inventory.find": {"status": "blocked", "reason": "Navigationsweg fehlt"}},
  "next": "Nutzer nach Weg zum Inventar fragen"
}
```

Keine Cookies, Passwörter, Browserprofile, Original-DOM-Dumps oder persönlichen Testdaten speichern.
