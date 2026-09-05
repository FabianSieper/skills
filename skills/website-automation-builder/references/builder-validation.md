# Builder validation

## Aktueller Stand
Der Builder wurde auf die Architektur `registered action -> esbuild bundle -> playwright-cli run-code -> existing attached browser` umgestellt.

Geprüfte statische Invarianten:
- Zieltemplate enthält keinen Runtime-Aufruf von `chromium.launch`/`playwright-cli open`.
- Browserkonfiguration verlangt bestehende Chrome-Session und feste Attach-Methode.
- `list`/`describe` sind browserfrei; `connect` attach-only.
- Action-Vertrag enthält `modulePath` und `next`/`allowedNextActions`.
- temporäre run-code-Dateien liegen unter `.local` und werden nach Aufruf gelöscht.
- `run-code`-Wrapper ist eine einzelne Function Expression; modulare POMs werden gebündelt.

Eine Live-Abnahme gegen eine echte Website und den lokal installierten `playwright-cli` ist absichtlich Aufgabe jedes erzeugten Website-Skills. Die Builder-Umgebung besitzt keinen bereits geöffneten Nutzerbrowser und kann diese Integration nicht stellvertretend bestätigen.
