---
name: {{SLUG}}
description: Führe ausschließlich die dokumentierten Aktionen auf {{HOST}} über vordefinierte TypeScript-/Playwright-POM-Funktionen aus, die mit playwright-cli in einen bereits geöffneten Browser eingebunden werden. Verwenden für die konkret dokumentierten Website-Aktionen dieses Skills. Nicht für freie Browsernavigation oder andere Websites verwenden.
---

# {{SLUG}}

## Ausführungsmodell
Verwende ausschließlich registrierte Aktionen. Der Agent entscheidet **welche** Aktion benötigt wird und liefert validierte Parameter; die mitgelieferte TypeScript-Implementierung entscheidet **wie** navigiert, lokalisiert, geklickt, gelesen und verifiziert wird.

Fester Pfad:
`Nutzerabsicht -> list/describe -> registrierte Aktion -> Eingabevalidierung -> angehängte playwright-cli-Session -> gebündelte POM-/Action-Funktion -> Postcondition -> kompaktes JSON`.

Während normaler Nutzung **keine** freien `snapshot/click/fill/goto/run-code`-Sequenzen erfinden. Raw CLI-Navigation ist nur für Builder/Debugging erlaubt. Bei `UNKNOWN_ACTION`, `UI_DRIFT` oder `AMBIGUOUS_SELECTOR` stoppen und den Builder zur gezielten Erweiterung/Reparatur verwenden.

## Browser-Invariante
Der Browser ist bei Nutzung dieses Skills standardmäßig **bereits geöffnet**. Dies ist eine Voraussetzung, keine Optimierung.

- Nie selbst einen Browser starten, neu starten, schließen oder durch einen managed/headless Browser ersetzen.
- Standard: an den bereits geöffneten Chrome über `playwright-cli attach --extension=chrome` und eine feste benannte Session anbinden.
- `site.config.ts` darf stattdessen explizit `cdp` konfigurieren; kein automatischer Wechsel zwischen Extension/CDP.
- Vor der ersten Aktion `npm run --silent cli -- connect` oder direkt die Aktion verwenden; die Runtime hängt die benannte Session an, falls sie noch nicht existiert.
- Wenn der Browser nicht geöffnet/attachbar ist: `BROWSER_REQUIRED`/`ATTACH_FAILED`; Nutzer soll den konfigurierten Browser öffnen bzw. die bestehende Extension/CDP-Verbindung herstellen.
- Login, MFA oder CAPTCHA erledigt der Nutzer im bereits geöffneten Browser. Danach dieselbe Aktion erneut ausführen. Keine Sessiondatei oder Passwortautomatisierung anlegen.
- Niemals `playwright-cli close`, `close-all`, `kill-all` oder `open` aus diesem Skill aufrufen.

Die Runtime verwendet `playwright-cli run-code --filename=...` nur intern. Weil `run-code` keine `import/export/require`-Syntax im Eingabefile akzeptiert, werden modulare TypeScript-POMs und Actions vor dem Aufruf mit esbuild in eine einzelne Funktions-Expression gebündelt. Der Agent erzeugt diese Funktion nicht selbst.

## Voraussetzungen
**BUILD_REQUIRED:** Erst entfernen, wenn SitePage, POMs, Actions, Beispiele und Verifikation vollständig sind.

Benötigt: Node.js >= 22.16, `playwright-cli` im PATH, bereits geöffneten konfigurierten Browser sowie eine funktionierende Extension- oder CDP-Anbindung. Einrichtung: `npm ci`. Kein `npx playwright install chromium` für die normale Skill-Ausführung nötig.

Befehle immer aus `<ABSOLUTER_SKILL_ORDNER>` ausführen.

```bash
npm run --silent cli -- list
npm run --silent cli -- describe <action-id>
npm run --silent cli -- connect
npm run --silent cli -- doctor
npm run --silent cli -- run <read-action> --input <file.json>
npm run --silent cli -- plan <write-action> --input <file.json>
npm run --silent cli -- execute --plan <plan-id> --approve <approval-hash>
```

`list` und `describe` greifen nicht auf den Browser zu. `connect` hängt ausschließlich an den bereits geöffneten Browser an und startet keinen neuen.

## Unterstützte Aktionen
Nur tatsächlich implementierte IDs aufführen.

| Nutzerabsicht | Action-ID | Read/Write | Eingabe-Beispiel | Prüfstatus |
|---|---|---|---|---|

Vollständige Verträge: `references/actions.md`.

Jede erfolgreiche Aktion liefert zusätzlich `allowedNextActions`. Nutze diese Liste als bevorzugten nächsten Navigationsraum; erfinde keine nicht registrierte Folgeaktion.

## Fehler: feste Reaktion
| Code | Reaktion |
|---|---|
| INVALID_INPUT / UNKNOWN_ACTION | Vertrag lesen bzw. fehlende Aktion mit Builder ergänzen; nichts raten |
| BROWSER_REQUIRED / ATTACH_FAILED | Nutzer muss den konfigurierten bereits geöffneten Browser/Attach bereitstellen; keinen Ersatzbrowser starten |
| AUTH_REQUIRED / HUMAN_REQUIRED | Nutzer im bestehenden Browser Login/MFA/CAPTCHA erledigen lassen |
| UI_DRIFT / AMBIGUOUS_SELECTOR / POSTCONDITION_FAILED | Stoppen; betroffenen POM/Flow mit Builder reparieren |
| CLI_PROTOCOL | Stoppen; CLI/Runtime-Version prüfen, keine freie CLI-Navigation als Fallback |
| PLAN_CHANGED / PLAN_EXPIRED | Vorschau neu erstellen und erneut prüfen |
| APPROVAL_REQUIRED | Konkrete Vorschau und Nutzerfreigabe prüfen |
| PLAN_USED / UNKNOWN_COMMIT | Nicht wiederholen; fachlichen Zustand mit registrierter Read-Aktion prüfen |
| BUSY | Laufenden Prozess prüfen; Sperre nicht blind löschen |
| TIMEOUT / INTERNAL | Stoppen; sichere Diagnose, keine automatische Write-Wiederholung |
| NOT_CONFIGURED | Builder muss Implementierung abschließen |

Exitcodes: 0 Erfolg, 2 Eingabe/Vertrag, 3 Browser/Auth/Nutzer/Freigabe, 4 UI/Runtime, 5 unklarer oder schon versuchter Commit.

## Datenschutz und Grenzen
`.local` enthält Pläne, Attempt-Marker und temporäre `run-code`-Bundles; nie committen oder hochladen. Browserprofil, Cookies und Login bleiben im bereits geöffneten Nutzerbrowser und werden nicht vom Skill exportiert. Keine Botblockaden umgehen, keine Tarntechniken einbauen und keine Erfolgsgarantie nach Website-Änderungen geben.
