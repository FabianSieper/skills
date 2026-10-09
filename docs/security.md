# Tatsächliche Schutzgrenzen

Betriebsmodus: `proposal-first`. Die Foundation erteilt keine selbstständige
Veröffentlichungsberechtigung. Der Import ist ausdrücklich vom Nutzer beauftragt;
dies ist keine allgemeine Berechtigung für künftige Releases.

Die Herkunftsmanifeste sind konsistente Hinweise, keine Vertrauensnachweise.
Die Registry mit Remote-/Git-/Pfadprüfung, zuordenbare Entscheidungen und ein
technischer Zustandsautomat fehlen noch. Lokale Dateien, Hashes und
`protected-paths.json` hindern einen Agenten mit Schreibrechten nicht am Ändern.

GitHub-Branch-Regeln, unabhängige Prüfjobs und getrennte Nutzer-/Agentenrechte
sind nicht verifiziert. Solange diese Nachweise fehlen, bleibt die Veröffentlichung
eine bewusst beauftragte menschliche Repository-Aktion. Keine automatische
Release-Funktion aktivieren. Keine Secrets, Rohtranskripte oder Kundendaten
als Lernbelege speichern.

Die bisherigen Repository-Dateien werden ersetzt; frühere Git-Commits bleiben
erhalten. Der Ersatz entfernt keine sensiblen Daten aus der Historie.
