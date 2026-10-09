# Persönliche Skill-Library

Quelle: **[FabianSieper/skills](https://github.com/FabianSieper/skills)**.
Version 0.1.0 ist die bewusst erstellte Foundation für eine kontrolliert lernende,
projektübergreifende Library. Die bisherigen Repository-Dateien wurden auf
Nutzerauftrag ersetzt; ihre Git-Historie bleibt erhalten.

| Skill | Aufgabe |
| --- | --- |
| `create-skill` | Neue wiederverwendbare Abläufe eingrenzen, kompakt entwerfen und testbar machen. |
| `improve-skill` | Lernbedarf diagnostizieren, richtig zuordnen, knapp bestätigen lassen und gezielt verbessern. |
| `coding-conventions` | Selbstdokumentierenden Code durch Namen, Struktur und notwendige Begründungen schreiben. |

**Vorhanden:** drei Skills, gemeinsame Standards, portable Ressourcen,
Herkunftsmanifeste, Bootstrap-Fragment, 38 Testdefinitionen und lokale Prüfhelfer.
**Noch offen:** `skillctl`, vertrauenswürdige Registry/Resolver, technische
Zustandsübergänge, installierte Adapter, Modellrunner, Rechte-Trennung und
Freigabeautomatisierung. Die Foundation arbeitet im Vorschlagsmodus.

## Installation

Nach Veröffentlichung dieses Standes zuerst die Auswahl prüfen:

```bash
npx skills@1.7.1 add FabianSieper/skills --list
```

Vor globaler Installation gleichnamige vorhandene Skills und lokale Änderungen
prüfen. Danach die gewünschten Skills gezielt installieren:

```bash
npx skills@1.7.1 add FabianSieper/skills -g \
  -a codex -a github-copilot -a opencode \
  --skill create-skill --skill improve-skill --skill coding-conventions
```

Lokale und direkte GitHub-Paketinstallation mit CLI 1.7.1 wurden isoliert geprüft.
GitHub-Updates und Skill-Erkennung in Agentensitzungen sind noch nicht verifiziert.
`npx skills` installiert kein Verwaltungstool und richtet den Bootstrap nicht ein.

## Lokale Pflege

Node.js ab 22.20.0; für den späteren Produktivbetrieb Node 24 LTS verwenden.
Keine Laufzeitabhängigkeiten für die vorhandenen Foundation-Prüfungen:

```bash
npm run check
npm test
npm run generate:preview
```

Kanonische Regeln liegen in `governance/` und `templates/`. Nur dort ändern;
anschließend mit `npm run generate` die betroffenen Paketkopien synchronisieren.
Installierte Kopien und Installer-Caches niemals als Quelle bearbeiten.

## Weiterarbeiten

[PLAN.md](PLAN.md) enthält Reihenfolge, Abnahmen und aktuellen Status.
Nächster Schritt ist der vollständige lokale Lernvorgang mit sicherem Quellresolver,
Vorschlagszuständen und isoliertem Kandidaten. Die vorhandenen Skill-Einstiege
werden dafür nicht pauschal neu geschrieben.

[INTEGRATION.md](INTEGRATION.md) beschreibt die ursprüngliche Übergabe;
[Gesamtauftrag](docs/IMPLEMENTATION-PROMPT.md),
[Betrieb](docs/operations.md), [Schutzgrenzen](docs/security.md) und
[Kompatibilität](docs/compatibility.md) halten Anforderungen und Nachweise fest.
[VALIDATION.md](VALIDATION.md) trennt lokale Prüfungen von noch ausstehenden
Verhaltens-/Integrationsnachweisen. Keine autonome Veröffentlichung freigegeben.
