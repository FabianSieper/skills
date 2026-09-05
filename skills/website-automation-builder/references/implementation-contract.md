# Implementierungsvertrag

## Zielarchitektur
`Agent -> Website-CLI -> Action Registry -> Browser Executor -> playwright-cli attached session -> bundled Action/POM -> existing Page`.

Der Agent darf in normaler Nutzung nur Action-ID und Parameter wählen. Er schreibt keine Klickfolge und keinen freien `run-code`-Snippet. POMs besitzen Locators und UI-Operationen; Actions verbinden POM-Methoden zu fachlichen Flows und prüfen Postconditions.

## Browservertrag: existing-browser-only
Der Browser ist bei normaler Skill-Nutzung bereits geöffnet. Dies ist ein harter Default.

- Standardadapter: `attach --extension=chrome` mit fester benannter Session.
- Optional: `attach --cdp=chrome` oder expliziter CDP-Endpunkt, nur wenn im Zielskill bewusst konfiguriert und getestet.
- Niemals automatisch zwischen Extension/CDP wechseln.
- Niemals `playwright-cli open`, `close`, `close-all`, `kill-all` oder `chromium.launch` in normaler Runtime verwenden.
- Browser fehlt/nicht attachbar: `BROWSER_REQUIRED` bzw. `ATTACH_FAILED`.
- Auth fehlt: `AUTH_REQUIRED`; Nutzer meldet sich im bereits offenen Browser an. MFA/CAPTCHA: `HUMAN_REQUIRED`.
- Keine eigene storage-state-Datei als Standard. Browserprofil, Cookies, Extensions und Login bleiben Eigentum des bereits laufenden Browsers.

`connect` darf ausschließlich eine playwright-cli-Verbindung zum offenen Browser herstellen. Es startet keinen Browser. `list`/`describe` greifen gar nicht auf den Browser zu.

## Warum Bundling nötig ist
`playwright-cli run-code --filename=...` erwartet eine einzelne Function Expression und akzeptiert dort keine normale `import/export/require`-Syntax. Daher bleibt die Quellstruktur modular in TypeScript, während `src/runtime/cli-browser.ts` für jeden Aufruf ein temporäres, selbstenthaltenes Bundle erzeugt:

1. Action-Modul + POMs + `SitePage` mit esbuild bündeln.
2. Validierte Eingabe als JSON-Datenliteral einbetten.
3. Eine einzelne `async page => { ... }`-Expression nach `.local/run-code/<uuid>.js` schreiben.
4. Über `playwright-cli -s=<session> --raw run-code --filename=<file>` im bestehenden Browser ausführen.
5. JSON-Ergebnis parsen und temporäre Datei löschen.

Der Agent erzeugt dieses Bundle nicht. Keine Nutzereingabe an Shellcode, `eval` oder Modulpfade durchreichen.

## Zielstruktur
```text
<site>-automation/
  SKILL.md
  agents/openai.yaml
  package.json
  package-lock.json
  tsconfig.json
  site.config.ts
  src/cli.ts
  src/runtime/{errors,input,guards,cli-browser,engine,fingerprint}.ts
  src/pages/SitePage.ts
  src/pages/*.ts
  src/components/*.ts
  src/actions/*.ts
  src/actions/index.ts
  tests/*.test.ts
  examples/*.json
  references/{actions,flows,selectors,verification}.md
  references/build-state.json
  .local/                      # privat; Pläne/Attempt-Marker/temp run-code
```

## Action-Modul
Jede Action exportiert genau ein `action`-Objekt mit:
- `id`, `kind`, `description`, `parameters`, `outputDescription`
- `modulePath`: `fileURLToPath(import.meta.url)`
- `next`: registrierte erlaubte/sinnvolle Folgeaktionen
- `validateOutput`
- bei read: `run(page,input)`
- bei write: `prepare(page,input)` und `execute(page,input,preview)`

Beispiel:
```ts
import { fileURLToPath } from 'node:url';
import type { Action } from '../runtime/engine.ts';
import { SearchPage } from '../pages/SearchPage.ts';

export const action: Action = {
  id: 'catalog.search',
  kind: 'read',
  modulePath: fileURLToPath(import.meta.url),
  next: ['catalog.open-result'],
  description: 'Search catalog by exact query.',
  parameters: { query: {type:'string',description:'Query',required:true,min:1,max:100} },
  outputDescription: 'Bounded search results.',
  run: (page,input) => new SearchPage(page).search(input.query as string),
  validateOutput: value => validateSearchResult(value)
};
```

`next` ist Teil des Agentenvertrags. Das Ergebnis enthält `allowedNextActions`; ein kleines Modell soll daraus den nächsten Schritt wählen statt die Website neu zu explorieren. Leere Liste bedeutet: Flow beendet oder neuer Nutzerauftrag nötig.

## CLI-Vertrag
```bash
npm run --silent cli -- list
npm run --silent cli -- describe catalog.search
npm run --silent cli -- connect
npm run --silent cli -- doctor
npm run --silent cli -- run catalog.search --input examples/search.json
npm run --silent cli -- plan item.update --input /private/update.json
npm run --silent cli -- execute --plan <plan-id> --approve <approval-hash>
```

`run` nur read. `plan` nur write/prepare. `execute` nur mit gespeicherter Preview und Approval-Hash. Nach möglichem Commit permanenten Attempt-Marker setzen; unbekannten Commit nicht wiederholen.

## POM- und Locator-Vertrag
POMs kapseln Locators, Zustandsanker und elementare Website-Operationen. Actions enthalten fachliche Reihenfolge und Postconditions. Keine CLI- oder Agentenlogik in POMs.

Locator-Priorität:
1. stabiler beobachteter `data-testid`/Test-ID-Vertrag,
2. exakte Rolle/Name oder Label,
3. eindeutiger fachlicher Container + semantisches Ziel,
4. kurzes stabiles Attribut mit dokumentierter Begründung.

Jedes Einzelziel muss genau einen Treffer haben. Test-ID ist kein Eindeutigkeitsbeweis. `uniqueVisible`, `clickUnique`, `fillUnique` verwenden. Keine `.first/.last/.nth`-Reparatur, generierten CSS-Klassen, XPath-Ketten, Koordinaten, `force:true`, `waitForTimeout` oder stillen Fallbackketten.

Snapshots/Refs wie `e14` sind nur Discovery-Hilfen und dürfen nicht als dauerhafte POM-Selektoren gespeichert werden.

## Zustände, Tabs und Navigation
`SitePage.assertReady()` prüft Domain, relevanten Seitenzustand, Login/Account und bekannte Blockzustände. Login allein reicht nicht zur Accountidentität.

Neue Tabs/Popups nur durch die konkrete Action erzeugen und gezielt identifizieren; keine fremden Tabs schließen. Vor Action-Ausführung aktuellen Tab/Origin prüfen. Der Runtime-Adapter darf den offenen Browser nicht aufräumen oder dessen übrige Tabs verwalten.

## Write-Vertrag
`prepare` darf keine fachliche Mutation oder Autosave auslösen. Preview enthält mindestens Zielidentität/Zustandsversion und Änderungen. `execute` prüft direkt vorher erneut Account + Preview. Nach Commit-Grenze wird jeder unklare Fehler `UNKNOWN_COMMIT`.

## Fehler und Fallbacks
Keine automatische Rückkehr zu freier Browsersteuerung. Insbesondere:
- `UNKNOWN_ACTION`: Builder erweitern.
- `UI_DRIFT`/`AMBIGUOUS_SELECTOR`: POM reparieren.
- `BROWSER_REQUIRED`/`ATTACH_FAILED`: offenen Browser/Extension/CDP bereitstellen.
- `CLI_PROTOCOL`: CLI/Runtime-Kompatibilität reparieren.
- `AUTH_REQUIRED`/`HUMAN_REQUIRED`: Nutzer im bestehenden Browser übernehmen lassen.

Keine Whole-action-Retries für Writes. Reads nur nach dokumentierter Unbedenklichkeit erneut ausführen.
