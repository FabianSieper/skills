# Validierungsstand

Stand des ursprünglichen Pakets: **9. Oktober 2026**. Foundation-Version 0.1.0.
Die folgenden Paketnachweise bleiben historisch; aktuelle Import-Prüfungen stehen am Ende.

## Tatsächlich ausgeführt

| Prüfung | Ergebnis |
| --- | --- |
| Skill-Frontmatter mit vorhandenem Skill-Validator | Alle drei bestanden |
| YAML-Parsing und projektspezifische Metadatenprüfung | Alle drei bestanden |
| Relative Paketverweise und generierte Referenzkopien | Bestanden |
| Herkunftskonsistenz und eindeutige Test-IDs | Bestanden |
| Lokale Node-Tests für den Integritätshelfer | 13 bestanden, 0 fehlgeschlagen |
| Getrennte ZIP-Pakete mit jeweiligem Skill und Ressourcen | Erstellt und Archivintegrität geprüft |

Die 13 Node-Tests prüfen unter anderem Idempotenz, nicht schreibenden Dry-Run, gezielte Regeneration, fehlende Referenzen, unzulässige Pfade, Symlinks, doppelte IDs, inkonsistente Herkunft, unzulässige Ergebnisdeklarationen in Testdefinitionen und das Zeilenbudget. Sie testen **nicht** den Erfolg eines Agenten mit diesen Skills.

## Größen der Einstiege

| Skill | Wörter einschließlich Metadaten | Zeilen |
| --- | ---: | ---: |
| create-skill | 520 | 32 |
| improve-skill | 552 | 33 |
| coding-conventions | 325 | 23 |

Zusatzreferenzen kommen nur bei den im Einstieg genannten Schritten hinzu. Dies sind keine Tokenmessungen. Ein passender Tokenizer war in dieser Umgebung nicht verfügbar; konkrete Tokenbudgets sind in den Zielprofilen noch zu messen.

## Vorbereitet, nicht ausgeführt

30 Verhaltens-/Integrationsfälle und acht Routing-Fälle sind formuliert. Die Zielumgebungen für Sol, Luna, Qwen und Ornith waren nicht verfügbar. Keine dieser Modellelevaluationen wird als bestanden oder kompatibel ausgegeben.

Ein Zugriff auf die npm-Registry scheiterte mit DNS-Fehler `EAI_AGAIN`. Deshalb wurde `npx skills` nicht erfolgreich geladen oder ausgeführt. Verschachtelte Installation, Agenten-Dateipfade, GitHub-Updates und echte CLI-Skill-Auswahl sind weiterhin zu testen.

Session-Hooks, Quellrepo-Resolver, Zustimmungsinstanz, GitHub-Schutz und automatische Release-/Updateprozesse sind nicht implementiert. Die Foundation benennt ihre Anforderungen; Markdown und lokale Hashes erzwingen sie nicht gegen einen Agenten mit uneingeschränkten Schreibrechten.

## Nachweise

`verification/summary.json`, `verification/integrity-check.log`, `verification/local-tests.tap` sowie `verification/format-*.log` dokumentieren die lokalen Prüfungen. Das Archivmanifest dient nur dem Integritätsvergleich, nicht als unabhängiger Herkunfts- oder Qualitätsbeweis.

Ein ausgearbeiteter Ausgangsstand ist keine Garantie monotoner Verbesserung. Die erste Freigabe für den produktiven Lernkreislauf erfordert die im Gesamtauftrag beschriebenen Integrations-, Modell- und Berechtigungsnachweise.

## Aktuelle Import-Prüfung (9. Oktober 2026)

Die Foundation wurde an `https://github.com/FabianSieper/skills` gebunden.
Repository-ID und alle drei SKILL.md-Einstiege bleiben unverändert. Die drei
Herkunftsdateien wurden aus der kanonischen Konfiguration neu erzeugt.

- `npm run check`: bestanden; 38 Testdefinitionen strukturell geprüft.
- `npm test`: 13 bestanden, keine fehlgeschlagen.
- `npm run generate:preview`: keine ausstehenden Änderungen.
- `skills@1.7.1`: verschachtelte lokale Erkennung bestanden. Installation mit
  allen drei Agentenzielen im isolierten Home-/XDG-/Codex-/Temp-Bereich bestanden.
- Standardmodus, explizites `--copy` und Auswahl nur von `create-skill`: bestanden.
  Alle installierten Dateien stimmen bytegenau mit ihren Paketen überein.
  Die Agentenziele verwenden in dieser Version eine gemeinsame Kopie unter
  `.agents/skills`; kein Symlink zum Entwicklungs-Checkout.
- Der Ursprungs-Checkout blieb beim Installer-Test unverändert. Keine reale
  globale Agentenkonfiguration eingerichtet.

Aktuelle Nachweise: `verification/import-integrity-check.log`,
`verification/import-local-tests.tap`, `verification/installer-smoke.json`.
Die früheren `verification/summary.json`- und Archivnachweise gelten für das
ursprüngliche Paket; ihre damalige Registry-Blockade ist kein aktueller Fehler.

Reproduktion des Installer-Smoke-Tests: `node tooling/installer-smoke.mjs` mit
einem Pfad zur zuvor isoliert geladenen `skills@1.7.1/bin/cli.mjs` als Argument.
Der Test verwendet eigene Umgebungsverzeichnisse, keine Tokens und Timeouts.
Echte Agenten-Erkennung, Updates, Modellverhalten,
Rechte-Trennung und Installations-Rollback bleiben offen.

### Installation direkt aus GitHub

Der Foundation-Import wurde mit normalem `git push` über den bestehenden
SSH-Zugang auf `main` veröffentlicht (0b2b6a9). Anschließend wurden
`npx --yes skills@1.7.1 add FabianSieper/skills --list` und die gezielte globale
Installation für Codex/Copilot/OpenCode in einem getrennten Testbereich ausgeführt.
Alle drei installierten Pakete waren bytegleich mit dem geprüften Quellstand;
kein Build des Repositorys wurde ausgeführt. Nachweis:
`verification/github-installer-smoke.json`. Die ersten npx-Testaufrufe mit
`--prefix` beziehungsweise unvollständigem Offline-Cache scheiterten; der normale
gepinnte npx-Aufruf mit Registry-Zugriff bestand.
