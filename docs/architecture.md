# Architekturstand

`foundation.json` hält stabile Repository- und Skill-IDs sowie die kanonische
Quelle. `governance/` und `templates/` führen die gemeinsamen Regeln;
`tooling/foundation.mjs` erzeugt portable Kopien in den Meta-Skills und die
Herkunftsdateien aller drei Skills. Installationen benötigen keinen Build.

Der bestehende JavaScript-Helfer bleibt erhalten. Das fehlende Verwaltungswerkzeug
wird als kleines strikt typisiertes TypeScript-CLI ergänzt, ohne eine zweite
Qualitätslogik zu erfinden. Freigabecode, Registry und Kandidatenverwaltung fehlen
noch. Installierte Pakete werden niemals zum Entwicklungsziel.

Der Bootstrap existiert als Fragment, ist aber nicht global angebunden. Die
Evaluationsdateien enthalten Kriterien, keine erfolgreichen Modellläufe.
Markdown legt Anforderungen fest; wirksame technische Rechte müssen getrennt
implementiert und nachgewiesen werden.
