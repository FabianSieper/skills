# Szenario: "Welche meiner Karten auf Cardmarket ist unterpriced?"

Status: **in Arbeit** — Live-Phase läuft. Dieses Dokument ist das laufende
Problemtagebuch für genau dieses Szenario. Es wird mit jedem Fund und jedem
Fix fortgeschrieben. Ziel: ein (auch schwacher) Agent kann das Szenario
deterministisch, sparsam (wenig Schritte, wenig Context) und nachvollziehbar
über die Cardmarket-UI abarbeiten.

Szenario-Definition: Der Nutzer ist eingeloggt und hat eigene Angebote
(My Offers → Singles). Für jedes eigene Angebot soll geprüft werden, ob der
eigene Preis unter dem Marktpreis (anderen Sellern für dieselbe Karte/Version)
liegt. Ergebnis: Liste der unterpriced eigenen Angebote mit Referenzpreis und
Abstand.

## Statuslegende

- `offen` — identifiziert, noch nicht gelöst
- `live-bestätigt` — im Browser nachvollzogen
- `fixiert` — Skill-Dokumente geändert
- `verifiziert` — Fix dokumentiert + `task test` läuft / Live-Check bestanden

## Probleme

### P1 — MCP in der Host-Konfiguration deaktiviert
- **Status:** offen → live-bestätigt (Session)
- **Beobachtung:** `~/.config/opencode/opencode.json` definiert
  `mcp.munim-computer-use` mit `command: ["npx","-y","munim-computer-use"]`
  (identisch zu `references/transport.md` — das ist der richtige MCP) mit
  `"enabled": false`. In dieser Session sind die `munim-computer-use_*` Tools
  aber aufrufbar (Gate bestanden, vgl. "MCP-Prüfung" unten). In einer *frischen*
  Session ohne Override würde der Skill am Gate stoppen — korrekt, aber der
  Nutzer wüsste nicht, wie er den MCP dauerhaft aktiviert.
- **Fix:** (siehe Lösungsbereich, wenn erledigt)

### P2 — Kein Batch-Plan für "alle eigenen Angebote prüfen"
- **Status:** fixiert (neuer Plan `underpriced-scan` — begrenzter Scan)
- **Problem:** Die Pläne `own-offers` → `own-offer-market` → `compare` sind
  pro *einzelnem* Angebot dokumentiert. Das Szenario braucht aber einen
  begrenzten Scan über **alle** eigenen Angebote (ggf. mehrere Seiten). Kein
  Plan dokumentiert: Pagination-Loop, Cursor/Zeilen-Identität über Back/Forward,
  Gruppenbildung nach Karten-Identität, Stop-Kriterien. Ein schwacher Agent
  improvisiert: endlose Loops, Context-Explosion, verlorene Filter-Position.
- **Konsequenz:** Kernlücke des Szenarios.

### P3 — "Unterpriced" ist nicht definiert (keine deterministische Vergleichsregel)
- **Status:** fixiert (deterministische Verdict-Regel in `compare`)
- **Problem:** `compare` verlangt nur, dass "own price, product-wide 'from'
  data, matching seller prices" *unterschieden* werden. Es fehlt eine feste
  Regel, ab wann ein Angebot "unterpriced" gilt (z. B. eigener Preis <
  günstigstem kompatiblen Seller-Preis, oder < Median, oder < Marktpreis-Spalte
  der Stock-Tabelle). Ohne Regel entscheidet jeder Agent anders — Resultat nicht
  reproduzierbar, Vergleichbarkeit zwischen Runs verloren.
- **Offene Frage:** Liefert die Stock-Tabelle selbst schon eine Marktpreis-Spalte?
  (live prüfen — siehe P7)

### P4 — Eigener Preis nicht klar auf der Detailseite verankert
- **Status:** live bestätigt (eigene Zeile + `Edit`-Kontrollen auf der Detailseite)
- **Problem:** Auf der Detailseite ist die Preisliste der *anderen* Seller.
  Ob/wo das eigene Angebot dort sichtbar ist, ist nicht dokumentiert. Der Agent
  muss den eigenen Preis aus der Stock-Zeile merken und zur Detail-Identität
  binden. Nicht dokumentiert, wie das robust zu tun ist (welche Felder der
  Zeile sind die Identität: Name+Set+Condition+Language?).

### P5 — `Go back`-Semantik für Stock-Filter/Pagination nicht verifiziert
- **Status:** fixiert (dokumentiert: `Go back` + Re-Observe + Seiten-Konfirme im Plan; nicht live verifiziert)
- **Problem:** `own-offer-market` sagt: "`Go back` later restores the stock
  filter/page context". Nicht live verifiziert, dass Back wirklich dieselbe
  Seite (mit derselben Pagination-Position und Sortierung) wiederherstellt.
  Wenn nicht: Cursor-Verlust → Agent liest dieselben Zeilen doppelt oder
  überspringt welche.

### P6 — Pagination der Stock-Tabelle nicht dokumentiert
- **Status:** fixiert (dokumentiert: Pagination-Loop + `complete`-Flag im Plan; nicht live verifiziert)
- **Problem:** `own-offers`-Plan hat keinen Pagination-Schritt (Next-Page
  Control, Read-back der Seiten-Position, `complete`-Flag). Stock-Listen sind
  oft mehrseitig; der Batch-Scan braucht einen dokumentierten Loop mit
  Coverage-Tracking (50 Zeilen/Seite, max. 20 Seiten je Request).

### P7 — Stock-Tabelle: Spalten nicht bekannt (Entscheidung: 1 Read vs. N Navigationen)
- **Status:** live beantwortet (Spalten `Name`/`Info.`/`Offer`, keine Marktpreis-Spalte)
- **Problem:** `selectors.md` dokumentiert die Own-offers-Oberfläche nur als
  "heading and offer table", Spalten unbekannt. Falls die Tabelle schon
  "Market price"/"Current price"-Spalten enthält, ist der gesamte Scan **ein**
  begrenztes Table-Read (enorm effizient). Falls nicht, sind pro Angebot
  Forward→Detail→Read→Back nötig. Die Effizienz des Szenarios hängt davon ab.
  Live-Prüfung läuft.

### P8 — Preisformat (deutsches Dezimalkomma) kann bei Vergleich fehlführen
- **Status:** live bestätigt (Anzeige Komma, Edit-Input Punkt; Skill dokumentiert beides)
- **Problem:** `0,10 €` (Komma). Schwache Modelle sortieren/vergleichen
  Preise textuell oder parsen das Komma falsch (→ 0.1 vs 010). `compare`
  enthält keine explizite Pars-Regel.

### P9 — "Meine Karten" ≠ "meine Angebote": Deduplizierung nach Karten-Identität
- **Status:** fixiert (dokumentiert: Gruppierung nach Karten-Identität im Plan; nicht live verifiziert)
- **Problem:** Dieselbe Karte kann mehrfach gelistet sein (Condition/Language/
 _quantity). Der Nutzer fragt nach *Karten*. Der Scan muss Ergebnisse nach
  Karten-Identität gruppieren und pro Gruppe einen Fazit-Preis bilden. Nicht
  dokumentiert.

### P10 — Selling-Mega-Menü: Bedienbarkeit für schwache Agenten unklar
- **Status:** live bestätigt (`SELLING`-Link → My-Offers-Kategorie-Übersicht → Kachel-Klick)
- **Problem:** `own-offers` sagt "Selling -> My Offers -> Singles navigation
  controls" — aber wie das Menü aussieht (Dropdown? Hover? mehrere Klicks?),
  ist nicht dokumentiert. Schwacher Agent weiß nicht, ob er klickt, hovers oder
  wartet, und in welchem Schritt welches Control sichtbar ist.

### P11 — Decision-Table-Zelle für das Szenario-Ziel fehlt
- **Status:** fixiert (Transitions `underpriced-scan` + `price-change` in `graph.json`)
- **Problem:** `graph.json` hat (state, goal)-Zellen für "read own stock" und
  "compare own offer with matching sellers", aber keine Zelle für das
  Szenario-Ziel "find underpriced own offers". Die Tabelle soll total sein;
  eine fehlende Zelle ist laut Konzept ein Builder-Gap, keine Ermessenssache.

### P12 — Ergebnisformat des Szenarios nicht festgelegt
- **Status:** fixiert (dokumentiert: festes per-card-Format im Plan; nicht live verifiziert)
- **Problem:** Welche Ausgabe hat ein verlässlicher Scan? (Karte, Version,
  eigener Preis, Referenz, Abstand, Verdict, Coverage, verwendete
  Referenzart.) Ohne festes Format ist der Abschluss frei interpretierbar.

### P13 — Observation-Budget explizit pro Stock-Read benennen
- **Status:** fixiert (dokumentiert: konkreter `max_elements`-Budgetwert im Plan; nicht live verifiziert)
- **Problem:** Transport erlaubt `max_elements`-bounded Reads (typisch
  100–200), aber kein Plan nennt für die Stock-Tabelle einen konkreten Wert.
  Eine volle Stock-Zeile hat viele Elemente (Bild, Links, Preise, Qty) —
  50 Zeilen × ~8–10 Elemente ≈ 400–500+; ohne konkreten Budgetwert dumpen
  schwache Agenten den vollen Baum (800 Elemente, 20–37 KB).

### P14 — Installierte globale Kopie vs. Repo-Kopie (Drift-Risiko)
- **Status:** live-bestätigt + fixiert (nach dem Fix `task sync:agents` ausgeführt)
- **Beobachtung:** `~/.agents/skills/cardmarket-automation` ist eine **Kopie**
  (kein Symlink), aktuell inhaltsidentisch mit
  `skills/cardmarket-automation`. Repo-Änderungen ohne `task sync:agents`
  betreffen nicht die installierte Kopie, die andere Sessions laden.
- **Konsequenz:** Nach jedem Skill-Fix: `task sync:agents` ausführen.

### P15 — Phantom-Window im Safari-Inventory
- **Status:** live-bestätigt
- **Beobachtung:** `list_apps` zeigte zunächst `Safari windows=0` ( Flake ),
  nach `activate_app` dann `windows=2`: ein `<untitled>`-Window ohne WebArea
  und das Dashboard-Window. Ein schwacher Agent könnte das leere Window fälschlich
  als bindbare Seite interpretieren. Bindung erfordert WebArea-Evidenz —
  in der Skill nicht explizit als Anti-Pattern benannt.

## MCP-Prüfung (erledigt)

- Installierter MCP: `munim-computer-use` npm v0.3.0, `npx -y munim-computer-use`
  — identisch zum Befehl in `references/transport.md` und in
  `~/.config/opencode/opencode.json`. ✅ Das ist der verlinkte MCP.
- Gate in dieser Session: `munim-computer-use_list_apps` aufrufbar → bestanden. ✅
- ABER: global `enabled:false` (P1).

## BLOCKER — nicht eingeloggt

- **Status:** **gelöst** — Nutzer eingeloggt als `Private HAYRUS ( 56,83 € )`
  (s. „Live-Phase (Fortsetzung — nach Login)" weiter unten).
- **Beobachtung:** Nach `open -a Safari https://www.cardmarket.com/en` lädt die
  Seite (window 1, WebArea "Cardmarket: Buy and Sell Trading Card Games Online").
  Die Seite zeigt das **öffentliche** Layout: Login-Widget (USERNAME/PASSWORD,
  `Log in`, `SIGN UP`), "Back to Home", "Pick your game!", Sprache `ENGLISH`,
  Hilfe-Links. Kein Nutzer-Avatar, kein "My"-Menü, kein authentifizierter
  Bereich.
- **Konsequenz:** `Selling -> My Offers -> Singles` (Plan `own-offers`) ist
  ohne Login nicht erreichbar. Das Szenario "welche *meiner* Karten ist
  unterpriced" erfordert zwingend ein eingeloggtes Konto. Ich kann keine
  Zugangsdaten eingeben/raten.
- **Nächster Schritt:** Nutzer bitte in Safari unter cardmarket.com einloggen;
  danach fahre ich die Live-Phase fort (P5, P7, P10 verifizieren, Batch-Plan
  bauen).

## Live-Phase (Protokoll)

- [x] MCP-Gate: `munim-computer-use_list_apps` bestanden (Richtig-MCP bestätigt).
- [x] Safari aktiviert; Inventory: 2 Windows (`<untitled>` leer, Dashboard).
- [x] Cardmarket-Home via `open -a Safari` geöffnet (ein Tab, keine URL-Tastatur-Eingabe).
- [x] Home geladen — **nicht eingeloggt** → BLOCKER, Live-Run pausiert.
- [x] (nach Login) `own-offers`: Selling-Mega-Menü (P10), Stock-Spalten (P7), Pagination (P6).
- [x] (nach Login) eine Zeile → Detail → Seller lesen (P4, P8; P5/P13 dokumentiert).
- [x] (nach Login) Batch-Plan + Ergebnisformat (P2, P3, P9, P11, P12) fixen.

## Live-Phase (Fortsetzung — nach Login als HAYRUS)

### Einlog-Stand
- Nutzer ist in Safari unter cardmarket.com eingeloggt: Avatar
  `Private HAYRUS ( 56,83 € )`. Der frühere BLOCKER ist damit gelöst.

### P10 — Selling-Menü (live bestätigt)
- `SELLING`-Link in der Top-Leiste führt zu `My Offers | Cardmarket`.
- Diese Seite ist KEINE Stock-Tabelle, sondern eine **Kategorie-Übersicht** mit
  Kacheln `Singles (109)`, `Boosters (…)` usw.
- Zum echten Stock-Tableau muss man die Kachel `Singles (109)` klicken.
  → danach `My Offers | Cardmarket` mit der Singles-Stock-Tabelle.
- Diskrepanz: Kachel `Singles (109)` vs. Tabellen-Headline `108 Hits`.

### P7 — Stock-Tabelle: Spalten (live bestätigt)
- Die Singles-Stock-Tabelle hat nur die Spalten `Name`, `Info.`, `Offer`.
- **KEINE** `Market price` / `Current price` / Referenz-Spalte.
- Konsequenz: Der „Unterpriced"-Vergang erfordert pro Angebot
  Forward → Detailseite → Seller-Preise lesen. Ein einziges Table-Read reicht
  NICHT. (P7 damit live beantwortet.)

### P4 — Eigener Preis auf der Detailseite (live bestätigt)
- Auf der Detailseite ist das eigene Angebot in der Seller-Tabelle sichtbar
  UND zusätzlich als eigene Zeile mit Kontrollen
  (`Remove article(s)`, `List article(s)`, `Edit`).
- Eigene Zeile `Absorb (V.2)`: Seller `Hayrus`, Condition `EX`,
  Language `English`, Preis `0,28 €`, Qty `1`.
- Detail-Referenzwerte `Absorb (V.2)`: From `0,20 €`, Price Trend `0,59 €`,
  30-Tage `0,58 €`, 7-Tage `0,62 €`, 1-Tag `0,21 €`.

### P8 — Preisformat (live bestätigt)
- Anzeige auf der Seite: deutsches Komma `0,28 €`.
- Preis-INPUT-Feld im Edit-Formular: **Punkt** `0.28`.
- → Beim Setzen des Preises den Punkt verwenden; die Ansicht rendert
  automatisch zurück zu `0,28 €`.

### P15 — Safari AX-Glitch (live bestätigt, Workaround)
- Symptom: `list_apps` → `Safari windows=0` (bzw. nur ein neutrales Window),
  Screenshot schwarz.
- Diagnose: `pmset -g` → `displaysleep 0` (also **kein** Display-Sleep);
  AppleScript sah `1 window / 2 tabs`, während System-Events/AX `0` meldeten.
  → AX/Capture-Glitch, kein Sleep, vermutlich Capture-Permission/AX-State.
- Workaround: `osascript -e 'tell application "Safari" to make new document'`
  ließ das AX-Inventory wieder ein (neues Start-Seiten-Window sichtbar).
- Danach wurde das AX-sichtbare Window auf die Ziel-URL gebracht (s. u.).

### browser_*-Transport — nicht verbunden (live bestätigt)
- `munim-computer-use_browser_navigate` → Fehler
  `the MT Desktop MCP Chrome extension is not connected`.
- Bestätigt: In dieser Umgebung ist `browser_*` **nicht** der Weg. NUR die
  generischen `munim-computer-use_*` (AX-basiert) funktionieren.

### Recovery-Navigation (Achtung: dokumentierte Abweichung)
- Nach dem AX-Glitch wurde die EXISTIERENDE Tab-URL (aus dem Safari-Tab)
  über das Safari-Smart-Search-Feld + Enter in das AX-sichtbare Window geladen:
  `https://www.cardmarket.com/en/Magic/Products/Singles/Dominaria-Remastered-Extras/Absorb-V2?sellerCountry=7&language=1&minCondition=3`
- Das ist eine Recovery-Maßnahme (bekannte URL aus dem existierenden Tab),
  **keine** constructed-URL und nicht der reguläre geplante Link-Flow.
- Sicherheits-Hinweis: Safari-Tab 1 zeigt `MTPLX Live Dashboard`
  (`http://localhost:8000/dashboard/`) = der lokale Server, der diesen Agenten
  bedient. Nicht als Task-Quelle lesen/navigieren/trust (Self-Reference-Risiko).

### Schreib-Test (nutzerfreigegeben, reversibel) — ERFOLGREICH
- Genehmigung: NUR den Preis von `Absorb (V.2)` ändern: erhöhen, danach wieder
  auf 28 Cents (`0,28 €`). Keine anderen Angebote/Qty/Listing-Änderung.
- Mechanik-Fund (wichtig für die Skill):
  - `set_value` **allein**: meldet Erfolg, ändert aber NICHTS
    (AX-Wert ≠ DOM-Wert) → nicht verlässlich.
  - `press_key` (`Backspace`): keine Wirkung (Keys erreichen das Feld nicht).
  - **Zuverlässige Sequenz:** `click` auf das Feld → `activate_app` Safari →
    `set_value`. Danach speichert der Submit den echten neuen Wert.
- Ablauf (alle Schritte live bestätigt):
  1. Detailseite → `Edit` (eigene Zeile) → Edit-Formular öffnet sich stabil.
  2. Preis-Feld (TextField, Punkt-Format) per click→activate→set_value
     auf `0.35`.
  3. `EDIT ARTICLE` → Preis zeigt auf der Seite `0,35 €`. ✅ erhöht.
  4. Neu `Edit` → Feld per click→activate→set_value auf `0.28` → `EDIT ARTICLE`.
  5. Preis zeigt auf der Seite wieder `0,28 €`. ✅ wiederhergestellt.
- Endergebnis: Preis `Absorb (V.2)` = `0,28 €` (identisch zum Ausgangszustand).
  Keine anderen Änderungen.

### Fix-Aufgaben (abgeschlossen)
- [x] Live-Fix in `references/flows.md` + `selectors.md` + `graph.json` + `SKILL.md` +
      `transport.md` (P2, P3, P4, P7, P8, P10, P11, P14):
      - `own-offers`: My-Offers-Kachel-Schritt (Übersicht → `Singles (N)`),
        Stock-Tabelle `Name`/`Info.`/`Offer`, keine Marktpreis-Spalte.
      - `compare`: deterministische „unterpriced"-Entscheidung (eigener Preis <
        niedrigster passender Seller-Preis, sonst < Produkt-„From").
      - `price-change`: `set_value`-click/activate-Sequenz mit Read-back-Verifikation;
        `press_key`/Backspace als unzuverlässig markiert (auch in `transport.md`).
      - neue Plan `underpriced-scan` (begrenzter Scan) + Decision-Table-Transitions
        (`price-change`, `underpriced-scan`) in `graph.json`.
      - `browser_*` „extension is not connected"-Hinweis in `transport.md`.
- [x] Doku-Todos in den Plänen dokumentiert (P5, P6, P9, P12, P13 — nicht live verifiziert):
      - `own-offers`: Pagination-Loop (Next + Seiten-Read-back, max. 50/20), `complete`-Flag
        und konkreter `max_elements`-Budgetwert (P6, P13).
      - `underpriced-scan`: `Go back` + Re-Observe + Seiten-Konfirme (P5), Gruppierung nach
        Karten-Identität (P9), festes per-card-Ergebnisformat (P12), Pagination-Loop (P6).
- [x] Verifikation: `node scripts/verify-website-concept.mjs` → ok (0 Fehler);
      `node --experimental-strip-types --test docs/strict-automation/ui-model.test.mjs`
      → 8/8 pass.
- [x] `task sync:agents` (P14): 6 Dateien kopiert, 3 stale Einträge entfernt;
      installierte globale Kopie geprüft (Transitions + Pläne vorhanden).

### Offene Todos (Live-Verifikations-Debt — bewusst nicht live geprüft)
- [ ] P5 `Go back`-Semantik live prüfen (dieselbe Seite/Sortierung/Pagination-Position?).
- [ ] P6 Stock-Tabelle-Pagination live prüfen (Next-Page-Control, `complete` bei letzter Seite).
- [ ] P9 Deduplizierung nach Karten-Identität live prüfen (Gruppierung + Fazit-Preis).
- [ ] P12 exaktes per-card-Ergebnisformat live prüfen (Render + Ablesen).
- [ ] P13 Observation-Budget pro Stock-Read live prüfen (200/500 genügt für volle Seite?).
- [ ] P1 MCP-Server in der Host-Konfig hinterlegen (Host-Setup, kein Skill-Todo).