# Flows

## Detect Current State
1. `info` – returns `state` and `auth.loggedIn`.

## Require Login
1. `info` – read `auth.loggedIn`.
2. If `auth.loggedIn` is `false` and the task needs a logged-in session:
   1. `nav.home` – navigates to the Cardmarket login page.
   2. ask the user to enter username/password in the attached browser.
   3. `info` – verify `auth.loggedIn` is `true`.
   4. continue from the required state.
3. If an action returns `AUTH_REQUIRED`, automatically call `nav.home` and prompt the user to log in, then retry the action.
3. If an action returns `AUTH_REQUIRED`, automatically call `nav.home` and prompt the user to log in, then retry the action.

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
3. For a card search, `nav.own-offers.filter { cardName: "Forest" }`.
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

## Error Handling
- `wrong_state`: run `info`, then choose a transition valid for the returned state.
- `not_available`: report or choose another path.
- `not_found`: re-run `info` and use an available index.
- `UI_DRIFT` / `AMBIGUOUS_SELECTOR`: stop and report to builder.
- `BROWSER_REQUIRED`: hard stop.
- `HUMAN_REQUIRED`: wait for manual Cloudflare solve.
- `AUTH_REQUIRED`: **automatic** — call `nav.home` to go to the login page, prompt the user to enter credentials, then retry the original action.
- `PLAN_CHANGED`: create and review a new plan.
- `PLAN_USED` / `UNKNOWN_COMMIT`: do not retry; verify with `user.offers`.
