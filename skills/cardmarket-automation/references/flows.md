# Flows

## Detect Current State
1. `info` – returns `state` and `auth.loggedIn`.

## Require Login
The user never signs in "first": login-required actions handle login on their own.
1. Run the needed action directly (e.g. `nav.own-offers`).
2. If the attached browser is logged out, the runtime automatically opens the Cardmarket login form, waits up to 2 minutes for the user's credentials, and re-runs the same action.
3. If `AUTH_REQUIRED` still comes back (step `login-timeout`): the login page is open in the user's browser — tell them to log in, then re-run the exact same command.
4. `info` – verify `auth.loggedIn` is `true`, then continue from the required state.

## Find a Card
1. `nav.search { query }`
2. `info` – read result tiles
3. choose a tile index from `cards`
4. `nav.open { index }`
5. `info` – read detail

## Read Card Detail
1. `nav.open { index }`
2. `info { ...requested seller filter }` – `info {}` applies the canonical seller default.

`info` applies and verifies the exact seller filter before it reads other offers. Do not use a seller list whose returned `filter` differs from the requested comparison filter.

## Read Versions
1. `nav.versions`
2. `info`
3. optional `nav.artwork { index }`
4. `info`

## Check Seller Quantities Across Versions
1. `nav.versions`
2. `info { limit, minQty }`
3. inspect `artworks[].qualifies`, `maxSellerQuantity`, and `sellersAtLeast`

## Read Own Offers
1. Ensure the browser is logged in (`info` → `auth.loggedIn: true`).
2. Navigate to the required card detail state.
3. `user.offers`
4. Inspect `offers[]`, especially `articleId`, `condition`, `language`, `price`, and `quantity`.

## Read Own Offers Listing
1. Ensure the browser is logged in (`info` → `auth.loggedIn: true`).
2. `nav.own-offers` – Selling → My Offers → Singles.
3. For a card search, always use the visible Singles filter UI: `nav.own-offers.filter { cardName: "Forest" }`.
4. `info` – read the current page and active stock filter.
5. To list all offers, call `info { all: true }`. It follows every enabled bottom next-page control, checks the filter remains unchanged, and stops only after the last page (`complete: true`).

## Compare an Own Offer with Other Sellers
1. On `own-offers`, filter by `cardName` when appropriate and run `info` to identify the current-page row index.
2. `nav.own-offers.open { index }` – opens the listing's card-name detail link.
3. `info { ...requested seller filter }` – omit the filter fields for the canonical seller default; otherwise pass all requested values.
4. Compare the stock row's `price` with `sellers[]`. The returned `filter` is the exact filter used for that comparison. If relevant, use `nav.versions` from the detail page to inspect other print variants.

## Update One Own Offer
1. `user.offers`
2. If `count > 1`, ask the user which `articleId` should be changed.
3. Receive an explicit instruction for the exact change(s).
4. `plan user.offer.update { articleId, ...changes }`
5. Review the plan preview and obtain user approval.
6. `execute --plan <planId> --approve <approvalHash>`
7. `user.offers` – verify the business state.

## Bulk Price Update by Name
1. Ensure the browser is logged in and on `own-offers` (`nav.own-offers` if needed).
2. Receive an explicit instruction for the card names and target prices.
3. Build parallel `names` and `prices` arrays; add `articleIds` when a card name can match multiple stock entries.
4. `plan stock.bulk-price-by-name { names, prices, articleIds? }`
5. Review the plan preview and obtain user approval.
6. `execute --plan <planId> --approve <approvalHash>`
7. Inspect `updated`, `unchanged`, and `failed`; retry ambiguous names with explicit `articleIds`; verify with `info` on the own-offers page.

## Audit Own Offer Price Deviations
This is a documented process, not a separate action.
1. `nav.own-offers`
2. `stock.market-comparison { limit?, location? }` — compares own offers with market sellers using each offer's own condition and language.
3. Inspect `offers[]`:
   - `belowMarket: false` means the own offer is above the lowest matching market price.
   - `marketFrom` is the lowest matching seller price; `marketSellers` is the compact seller count.
   - `marketFrom: "N/A"` means no matching seller was found, so treat it as insufficient market data rather than an automatic correction.
4. Select only offers that are meaningfully mispriced for the user's requested tolerance or strategy.
5. After explicit approval, apply corrections with `stock.bulk-price-by-name` for name-driven updates or `stock.bulk-price-update` when stable article IDs are preferred.
6. Verify with `info` on the own-offers page and optionally re-run `stock.market-comparison` for the affected subset.

## Error Handling
- `wrong_state`: run `info`, then choose a transition valid for the returned state.
- `not_available`: report or choose another path.
- `not_found`: re-run `info` and use an available index.
- `UI_DRIFT` / `AMBIGUOUS_SELECTOR`: stop and report to builder.
- `BROWSER_REQUIRED`: hard stop.
- `HUMAN_REQUIRED`: wait for manual Cloudflare solve.
- `AUTH_REQUIRED`: **automatic** — the runtime already opened the login form and waited for you to log in, then re-runs the same action. If it returns step `login-timeout`, the login page is open: tell the user to log in, then re-run the exact same command. Never start a different flow on your own.
- `PLAN_CHANGED`: create and review a new plan.
- `PLAN_USED` / `UNKNOWN_COMMIT`: do not retry; verify with `user.offers` on detail or `info` on the own-offers page.
