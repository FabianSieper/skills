# Verifikation

## Pflichtprüfungen des erzeugten Website-Skills
1. `npm run typecheck`.
2. `npm test`.
3. `list`/`describe` ohne Browserzugriff.
4. Browser bereits offen: `connect`/`doctor` hängt die konfigurierte benannte Session an und startet keinen Browser.
5. Browser geschlossen/nicht attachbar: `BROWSER_REQUIRED`/`ATTACH_FAILED`; kein `open`, managed/headless oder Adapter-Fallback.
6. Jede Read-Aktion: Erfolg, leeres/nicht vorhandenes Ziel, ungültige Eingabe, Postcondition.
7. Jeder Locator: eindeutiger Treffer im realen Zielzustand und nach erneutem Aufruf.
8. Jede Write-Aktion: `prepare` mutiert nichts; `execute` vergleicht Preview/Account; Attempt-Marker verhindert Replay; unklarer Commit wird nicht wiederholt.
9. `allowedNextActions` nur registrierte IDs und passend zur Dokumentation.
10. Normale Ausführung verwendet ausschließlich Action-CLI -> bundled POM code -> attached browser. Keine Snapshot-Refs oder LLM-generierten Klickfolgen.

## Browser-/CLI-spezifische Regression
- aktuelle `playwright-cli --version` dokumentieren.
- Extension- oder CDP-Attach genau in der konfigurierten Variante testen.
- `run-code --filename` mit dem generierten Single-Function-Bundle testen.
- Browser bleibt nach erfolgreicher Action geöffnet.
- bestehende fremde Tabs werden weder geschlossen noch umsortiert.
- Login/Cookies bleiben im Nutzerbrowser; keine auth-state-Datei wird vom Skill angelegt.

## Live-Verifikation
Sichere Reads mindestens zweimal aus frischem fachlichem Startzustand ausführen. Produktive Write-Aktionen nicht zu Testzwecken wiederholen. Staging/Testkonto verwenden oder fehlende Live-Verifikation explizit markieren.

Dokumentiere in `references/verification.md` des Zielskills:
```text
date: <ISO timestamp>
environment: <URL, Rolle, Sprache, Browser, playwright-cli, Node>
attach: <extension=chrome | cdp=...>
action: <id>
fixture: pass/fail/not-run
live: pass/fail/not-run
postcondition: <Beleg ohne Geheimnisse>
remaining-risk: <falls vorhanden>
```
