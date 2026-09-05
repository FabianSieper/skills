---
name: website-automation-builder
description: Erstelle oder erweitere einen wiederverwendbaren Website-Skill, dessen Agent nur registrierte Website-Aktionen auswählt, während TypeScript/Playwright-POMs die konkrete Navigation ausführen. Die fertigen Aktionen laufen über playwright-cli in einem bereits geöffneten Nutzerbrowser, standardmäßig via Chrome-Extension mit benannter Session; kein eigener Browserstart. Verwenden, wenn eine Website automatisiert und das Ergebnis als eigener, deterministischer Skill gespeichert werden soll. Kläre Aktionen/Erfolgskriterien, frage bei schwierigen Flows gezielt nach, implementiere robuste eindeutige Locators und teste die fertigen Action-Verträge.
---

# Website Automation Builder

## Zielbild
Erzeuge pro Website einen eigenständigen Skill `<site>-automation` mit TypeScript-POMs und registrierten Aktionen. Trenne strikt **Builder/Exploration** von **normaler Nutzung**.

Die spätere LLM-Nutzung darf nicht erneut die Website verstehen oder Klickfolgen improvisieren. Sie folgt nur:
`Nutzerabsicht -> dokumentierte Action-ID -> validierte Parameter -> Runtime -> playwright-cli -> vorgebaute POM-/Action-Funktion -> verifiziertes JSON`.

Die Runtime nutzt den **bereits geöffneten Browser des Nutzers**. Browser offen ist der Default und eine feste Voraussetzung. Niemals für normale Skill-Ausführung einen managed/headless Browser starten oder einen Ersatzbrowser öffnen. Standard-Adapter: `playwright-cli attach --extension=chrome` mit fester benannter Session; CDP nur wenn im Zielskill ausdrücklich konfiguriert und getestet. Die CLI kann `run-code --filename` ausführen; modulare TypeScript-POMs/Actions werden dafür deterministisch zu einer einzelnen Funktions-Expression gebündelt.

## Fester Ablauf
Arbeite strikt `INPUT -> DISCOVER -> BUILD -> VERIFY -> HANDOFF`. Status pro Aktion: `unclarified | mapped | implemented | fixture_verified | live_verified | blocked` in `references/build-state.json`.

### 1. INPUT
Lies `references/intake-and-discovery.md`. Kläre Website, konkrete Aktionen, Inputs, Outputs, read/write, Erfolgskriterien und erlaubte Mutationen. Browserannahme nicht erneut erfragen: standardmäßig ist Chrome bereits offen und soll wiederverwendet werden.

Wenn eine Aufgabe fachlich oder navigational nicht leicht eindeutig automatisierbar erscheint, frage den Nutzer nach seinem Flow: wie er zu dem Bereich gelangt, welche Klickfolge er nutzt oder nach einem Screenshot. Frage sofort bei mehreren plausiblen Fachflows, unklaren Voraussetzungen oder riskanten Erkundungsschritten; spätestens nach zwei gezielten Fehlversuchen oder fünf Minuten ohne Fortschritt pro Aktion. Blockiere nur die betroffene Aktion.

### 2. DISCOVER
Erkunde vereinbarte Aktionen gezielt. In dieser Phase sind direkte playwright-cli-Kommandos/Snapshots erlaubt, um den Flow und robuste Locators zu bestimmen. Nutze bevorzugt den bereits geöffneten Browser; keine Botblockaden umgehen oder Tarntechniken bauen.

Dokumentiere pro Interaktion: POM-Methode, Locator, Scope, erwartete Trefferzahl, fachliche Identität, Zustandsanker und verifizierbare Nachbedingung.

Locator-Priorität:
1. stabiler beobachteter Test-ID-Vertrag,
2. exakter semantischer Locator (`getByRole`, `getByLabel`),
3. fachliche ID innerhalb eines eindeutigen Containers,
4. kurzes stabiles Attribut mit Begründung.

Test-ID ist nicht automatisch eindeutig: jedes Einzelziel muss im relevanten Zustand genau einen Treffer liefern. Keine `.first()/.nth()`-Reparatur, generierten CSS-Klassen, XPath-Ketten, Koordinatenklicks, `force:true`, Sleeploops oder stille Locator-Fallbackketten.

### 3. BUILD
Lies `references/implementation-contract.md`. Scaffold:

```bash
node "<BUILDER_ROOT>/scripts/scaffold.mjs" --name <site>-automation \
  --url https://example.org --out "<TARGET_ROOT>/<site>-automation"
cd "<TARGET_ROOT>/<site>-automation"
npm install
```

Kein Browser-Download als Laufzeitvoraussetzung. Das Zielprojekt enthält `site.config.ts` mit fester browser session und Attach-Methode. Normaler Runtime-Code darf niemals `chromium.launch`, `playwright-cli open`, `close`, `close-all` oder `kill-all` aufrufen.

Architektur:
`CLI -> Action Registry -> Browser Executor -> playwright-cli named attached session -> bundled Action/POM code -> existing Page`.

Implementiere POMs in `src/pages/`/`src/components/`; je Action ein Modul in `src/actions/`. Action-Metadaten müssen `id`, `kind`, Schema, `modulePath`, Outputvalidator und `next` enthalten. `next` beschreibt erlaubte/sinnvolle Folgeaktionen für kleine Modelle.

`run-code` akzeptiert keine normalen Imports im übergebenen File. Deshalb bündelt `src/runtime/cli-browser.ts` das TypeScript-Modul plus SitePage mit esbuild und schreibt nur temporär eine einzelne Function Expression nach `.local/run-code/`. Eingaben werden vorher schema-validiert und als Datenliteral eingebettet; der Agent schreibt keinen freien run-code-Text.

Write-Aktionen bleiben `prepare -> Nutzerfreigabe -> execute`, mit Preview-/Account-/Versionsvergleich und permanentem Attempt-Marker. Nach möglichem Commit nie automatisch wiederholen.

### 4. VERIFY
Lies `references/verification.md`. Führe Typecheck/Tests aus. Prüfe pro Action Erfolg, Invalid Input, leer/nicht vorhanden, Selector-Eindeutigkeit, Postcondition, Auth/Human-State sowie erlaubte nächste Aktionen.

Zusätzlich zwingend testen:
- `list`/`describe` funktionieren ohne Browserzugriff.
- Browser bereits offen + korrekte Extension/CDP-Verbindung -> `connect`/`doctor` hängt an, startet keinen Browser.
- Browser geschlossen/nicht attachbar -> `BROWSER_REQUIRED`/`ATTACH_FAILED`, kein Fallback auf `open`/managed/headless.
- `run`/`plan`/`execute` verwenden nur die benannte Session.
- temporäres run-code-Bundle ist eine einzelne Function Expression und enthält die gebündelten POMs.
- normale Action-Ausführung benötigt keine Snapshot-Ref-Sequenz und keine LLM-generierten Playwright-Befehle.
- `allowedNextActions` stimmt mit Registry/Dokumentation überein.

Live-Tests nur sichere Reads bzw. ausdrücklich freigegebene Testmutationen. Login/MFA/CAPTCHA durch Nutzer im bestehenden Browser.

### 5. HANDOFF
Vervollständige den Website-Skill mit konkreten Action-IDs, Beispielen, Preconditions, Outputs, Postconditions, Fehlerreaktionen und `allowedNextActions`.

Der fertige Skill muss ausdrücklich sagen: **Browser ist bereits offen; Skill hängt an; Skill startet oder schließt keinen Browser.** Unbekannte Aktion oder UI-Drift führt zurück zum Builder, nicht zu freier Browsernavigation.

Paket niemals mit `.local`, Browserprofilen, Cookies, Traces, `node_modules` oder persönlichen Daten ausliefern.

## Ressourcen
- `references/intake-and-discovery.md`: Intake/Rückfragen/Discovery-Budget.
- `references/implementation-contract.md`: verbindliche Runtime-/POM-/CLI-Architektur.
- `references/verification.md`: Abnahme- und Regressionstests.
- `references/sources.md`: technische Quellen.
- `assets/site-template/`: Zielskill-Gerüst.
- `assets/examples/`: POM-/Action-Beispiele, nur als Muster.
