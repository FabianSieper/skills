# Flows

## Standard (Price + Versions)
1. `cards.search` (identify card)
2. `cards.price` (apply filter, read prices/sellers)
3. `cards.artworks` (list versions/variants)

## Artworks Only
1. `cards.search`
2. `cards.artworks` (optional `minQty` for seller check)

## Error Handling
- `found: false`: No results (continue or stop).
- `UI_DRIFT` / `AMBIGUOUS_SELECTOR`: Stop, report to builder.
- `BROWSER_REQUIRED`: Hard stop.
- `HUMAN_REQUIRED`: Wait for manual Cloudflare solve.
