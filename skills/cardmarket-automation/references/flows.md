# Flows – Cardmarket

> Status: `live_verified` – Flows sind implementiert und live validiert
> (Browser an Chrome angehängt, Session `cardmarket-automation`).

## Standard-Flow: Suche → Preis → Artworks

```
cards.search  →  cards.price  →  cards.artworks
```

1. `cards.search { query: "Forest" }` liefert die Result-Kacheln.
2. `cards.price { name: "Forest", sellers: 50 }` startet auf der Startseite,
   sucht über die Such-UI, öffnet die erste Result-Kachel und liefert Top-Block
   + Seller-Angebote (Condition, Sprache, Preis, Menge).
3. `cards.artworks { name: "Forest", minQty: 5 }` klickt den "Show Versions"
   Link auf der Detailseite, listet alle Drucke/Artworks und prüft optional die
   Seller-Mengen.

Alle Actions starten auf der Cardmarket-Startseite (`www.cardmarket.com`) und
navigieren ausschließlich über sichtbare UI-Elemente – kein Deep-Link, kein
Direct-Goto auf Teil-URLs.

## Variante: nur Artworks-Liste

`cards.artworks { name: "...", minQty: 0 }` listet alle Versionen/Artworks
(Set, Version, Verfügbarkeit, ab-Preis, Bild, URL) ohne Detailseiten-Besuche –
das ist der schnelle Modus.

## Fehler- und Abbruchverhalten

- Cloudflare-Challenge, die >90 s persistiert → `HUMAN_REQUIRED`
  (step `cloudflare-challenge`); der Operator löst manuell in Chrome, der Run
  kann danach fortgesetzt werden.
- Browser nicht anhängbar → `BROWSER_REQUIRED` / `ATTACH_FAILED`; der Skill
  startet NIE einen eigenen Browser.
- Kein Suchtreffer → `cards.artworks` gibt `found: false` mit leeren
  `artworks` zurück (kein Fehler).
- Kein "Show Versions"-Link auf der Detailseite → `found: false` (manche
  Karten haben nur eine Version).