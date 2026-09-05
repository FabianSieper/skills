# Cardmarket Skill – Flows

## Standard-Flow

```
Startseite
  → Suche (query)
  → Result-Kachel (erste)
  → Detailseite: Top-Block + Seller-Angebote
  → "Show Versions"
  → Versionen-/Artwork-Liste
```

1. `cards.search` → Karte identifizieren (Set, ab-Preis, Detail-URL)
2. `cards.price` → Verfügbarkeit + Preise (Top-Block + Seller-Angebote)
3. `cards.artworks` → Druckvarianten / Artworks (optional mit `minQty` für Seller-Mengen)

## Variante: nur Artworks

Nur Versionen/Druckvarianten suchen:
1. `cards.search` → `cards.artworks` (`minQty=0`, nur Auflisten)
2. Optional: `cards.artworks` mit `minQty>0` → Seller-Mengen-Check je Kachel

## Fehler- und Abbruchverhalten

- Keine Treffer → `found: false` mit leeren Listen (kein Fehler).
- UI-Drift/ambiguity → `UI_DRIFT` / `AMBIGUOUS_SELECTOR`; nicht mit
  `.first()`/`.nth()`/force „reparieren", an Builder zurück.
- Browser fehlt → `BROWSER_REQUIRED` / `ATTACH_FAILED` (harter Stopp).
- Cloudflare > 90 s → `HUMAN_REQUIRED` (Operator löst in Chrome).
- Alle Aktionen: `kind: read`, `retryable: false`, `mayHaveCommitted: false`
  (keine Schreibaktion, nichts kann vercommitet sein).
