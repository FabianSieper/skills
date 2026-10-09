# Betrieb der Foundation

Dies beschreibt den vorhandenen Stand und die nächsten Schritte. Die noch
fehlenden Lernfunktionen sind in `../PLAN.md` erfasst.

## Lokale Prüfung

Im Checkout:

```bash
npm run check
npm test
npm run generate:preview
```

Nach beauftragter Änderung an kanonischen gemeinsamen Quellen: `npm run generate`,
dann erneut prüfen. Generierte Referenzen nicht separat bearbeiten.

## Installation auf einem neuen Rechner

Nach Veröffentlichung des Foundation-Commits zunächst nur die Auswahl prüfen:

```bash
npx skills@1.7.1 add FabianSieper/skills --list
```

Vor tatsächlicher globaler Installation vorhandene gleichnamige Skills und lokale
Änderungen prüfen. Erst dann gezielt installieren:

```bash
npx skills@1.7.1 add FabianSieper/skills -g \
  -a codex -a github-copilot -a opencode \
  --skill create-skill --skill improve-skill --skill coding-conventions
```

Dies installiert Skill-Pakete. Es richtet weder Registry noch Bootstrap, Hooks
oder `skillctl` ein. Vor Verwendung eine neue Agentensitzung starten und die
tatsächliche Skill-Erkennung prüfen. Die GitHub-Paketinstallation wurde in einem
isolierten Testbereich nachgewiesen; echte Agentensitzungen bleiben offen.

## Updates und neue Skills

Die Primärquelle dokumentiert gezielte Updates:

```bash
npx skills@1.7.1 update create-skill improve-skill coding-conventions -g
```

Der echte Remote-Update-Test steht noch aus. Neue Skills benötigen gezieltes
`add`; eine automatische Profilsynchronisierung existiert noch nicht. Herkunft,
Ressourcen und lokale Änderungen vor/nach jedem Update vergleichen.

## Lernvorgang, Konflikt, Audit und Deinstallation

Bis zur Implementierung manuell nach `improve-skill` beziehungsweise `create-skill`
vorgehen: Ziel/Regel/Basis bestimmen, erforderliche inhaltliche Zustimmung einholen,
isolierten Branch verwenden, tatsächliche Tests berichten und Diff menschlich
freigeben lassen. Bei konkurrierender Änderung stoppen und neu vergleichen;
kein Reset, Force-Push oder stilles Verwerfen fremder Arbeit.

`skillctl audit`, Registry-Setup und verwaltete Bootstrap-Deinstallation sind noch
nicht verfügbar. Audit-Befunde begründen Vorschläge, keine automatischen Löschungen.
Globale Agenten-Konfiguration wurde durch den Foundation-Import nicht verändert.

## Rückweg

Der Import bewahrt die bisherige Git-Historie. Eine veröffentlichte Änderung
durch normalen `git revert <import-commit>` auf einem eigenen Branch und
bewusste Freigabe zurücknehmen. Keine Tags umbiegen oder Historie überschreiben.
Der vollständige Installations-Rollback mit fester Revision ist noch zu testen;
eine ungetestete Installer-Syntax wird hier nicht angegeben.
