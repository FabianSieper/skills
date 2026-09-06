# Flows

## Detect Current State
1. `info` – returns `state` and `auth.loggedIn`.

## Require Login
1. `info` – read `auth.loggedIn`.
2. If `auth.loggedIn` is `false` and the task needs a logged-in session:
   1. `nav.home`
   2. ask the user to enter username/password in the attached browser
   3. `info` – verify `auth.loggedIn` is `true`
   4. continue from the required state.

## Find a Card
1. `nav.search { query }`
2. `info` – read result tiles
3. choose a tile index from `cards`
4. `nav.open { index }`
5. `info` – read detail

## Read Card Detail
1. `nav.open { index }`
2. `info`
3. optional `nav.filter { ... }`
4. `info`

## Read Versions
1. `nav.versions`
2. `info`
3. optional `nav.artwork { index }`
4. `info`

## Check Seller Quantities Across Versions
1. `nav.versions`
2. `info { limit, minQty }`
3. inspect `artworks[].qualifies`, `maxSellerQuantity`, and `sellersAtLeast`

## Error Handling
- `wrong_state`: run `info`, then choose a transition valid for the returned state.
- `not_available`: report or choose another path.
- `not_found`: re-run `info` and use an available index.
- `UI_DRIFT` / `AMBIGUOUS_SELECTOR`: stop and report to builder.
- `BROWSER_REQUIRED`: hard stop.
- `HUMAN_REQUIRED`: wait for manual Cloudflare solve.
