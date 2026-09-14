# Supported munim-computer-use plans

Every supported task is a named plan. All plans use the single bound Safari tab
through `munim-computer-use_*` tools. A plan is the deterministic contract: it
names the exact control to act on, the observation that finds it, the action, the
observation that verifies it, the expected result, and when to stop. You never
search the page for your next control. The observation budget is hard (window-
scoped, `query`- or `max_elements`-bounded, per [transport](transport.md)); a zero
match on a documented `resolve` or `verify` observation is UI drift, so stop and
report instead of probing or dumping the full tree. The states and transitions
these plans connect are in [graph](graph.json).

Each plan below lists the same fields:

- `control` — the exact accessibility element to act on.
- `disambiguation` — how to tell it from nearby lookalikes.
- `resolve` — the scoped observation that finds the control.
- `action` — the single interaction to perform.
- `verify` — the scoped observation that confirms the move.
- `expected` — the state/identity that proves success.
- `drift stop` — the condition that halts the plan.

## Plan `reanchor` — enter or return to the `/en` start shell

- `control`: the bound tab's address bar (`TextField "smart search field"`); when no
  tab is bound, one new tab at the fixed `/en` home entry.
- `disambiguation`: re-anchoring is the only direct navigation allowed, and it
  targets only `https://www.cardmarket.com/en`; never a product, seller, or stock URL.
- `resolve`: initial or `window:<index>` observation of the bound tab bar.
- `action`: `set_value` the fixed home-entry URL, then `press_key Enter` (the only
  allowed Enter target), or open one fixed home-entry tab.
- `verify`: scoped observation of the start shell.
- `expected`: exact `https://www.cardmarket.com/en` origin plus the recognizable
  start shell.
- `drift stop`: no bound tab and repeated tab creation, or the returned page is not
  the start shell.

## Plan `search` — from `start` to `results`

- `control`: the visible Magic search field (`TextField "Search"`) and the plan's
  adjacent Search control.
- `disambiguation`: the field sits beside `PopUpButton "Category"`; never click a
  search-suggestion Link and never submit with Enter.
- `resolve`: scoped observation `query:"Search"` in the bound window.
- `action`: `set_value`/`type_text` the query, then `click` the Search control.
- `verify`: scoped observation of the results heading.
- `expected`: H1 `Search Results` plus `N Hits`, or an explicit empty state.
- `drift stop`: zero match on `resolve`/`verify`.

## Plan `open-result` — from `results` to `detail`

- `control`: the single result `Link` whose visible card name plus set/printing
  identity matches the requested target.
- `disambiguation`: require both the card name and the set/printing context to match;
  never choose the first plausible result or an ordinal position.
- `resolve`: scoped observation of the result rows in the bound window.
- `action`: `click` the matching result link in the same tab.
- `verify`: scoped observation of the detail title and printing context.
- `expected`: detail title and printing identity both match the clicked result.
- `drift stop`: no single matching result, a duplicate identity, or a new tab.

## Plan `read-sellers` — read offers on `detail`

- `control`: the visible seller sort/filter controls and the offers table.
- `disambiguation`: do not assume a seller-filter form exists; act only on controls
  actually visible in the offers region.
- `resolve`: scoped observation of the offers region in the bound window.
- `action`: apply requested values through each visible control, then `click` that
  control's submit; otherwise read the unfiltered offers.
- `verify`: scoped observation reading back each effective filter value.
- `expected`: up to 50 seller rows (`Seller`, `Product Information`, `Offer`) with
  filter/no-filter status, visible sorting, and coverage.
- `drift stop`: a requested filter cannot be applied or read back.

## Plan `versions` — from `detail` to `versions`

- `control`: the visible `Link "Show Versions (N)"`.
- `disambiguation`: the link's card title must match the verified detail identity.
- `resolve`: scoped observation of the versions control on detail.
- `action`: `click` the versions link in the same tab.
- `verify`: scoped observation of the versions heading.
- `expected`: the versions surface names the same parent card.
- `drift stop`: the versions surface names a different parent card.

## Plan `open-variant` — from `versions` to `detail`

- `control`: the single variant `Link` whose visible set/artwork identity matches
  the requested variant.
- `disambiguation`: require the full set/artwork identity, not ordinal position.
- `resolve`: scoped observation of the variant rows in the bound window.
- `action`: `click` the matching variant link.
- `verify`: scoped observation of the resulting detail identity.
- `expected`: detail identity matches the clicked variant.
- `drift stop`: no single matching variant, a duplicate, or a new tab.

## Plan `own-offers` — to the authenticated own-offers surface

- `control`: the visible Selling -> My Offers -> Singles navigation controls.
- `disambiguation`: requires a visibly authenticated account; login/MFA is a
  blocker handed to the user.
- `resolve`: scoped observation of the Selling navigation in the bound window.
- `action`: `click` the visible Selling -> My Offers -> Singles controls, then
  apply visible stock filters only when present.
- `verify`: scoped observation reading back the heading, table, and each filter.
- `expected`: authenticated own-offers heading and table; `complete:false` when the
  terminal page or filter continuity cannot be verified.
- `drift stop`: unauthenticated state, a missing surface, or an unreadable filter.

## Plan `own-offer-market` — from `own-offers` to a market detail

- `control`: that stock row's card `Link`, bound by article/card identity.
- `disambiguation`: match the row by visible article/card identity, condition, and
  language; never by ordinal position.
- `resolve`: scoped observation of the stock row in the bound window.
- `action`: `click` the row's card link in the same tab.
- `verify`: scoped observation of the detail identity.
- `expected`: detail matches the clicked row; `Go back` later restores the stock
  filter/page context.
- `drift stop`: the click creates a new tab or the detail identity does not match.

## Plan `compare` — own price versus matching sellers

- `control`: the matched market detail's seller controls and table (reuse plan
  `read-sellers` on that detail).
- `disambiguation`: compare only when condition, language, location, and variant
  flags are all compatible; never compare incompatible or unknown variants.
- `resolve`: scoped observation of the detail identity, then the offers region.
- `action`: apply compatible seller filters through visible controls, or report
  none applied; read bounded seller prices.
- `verify`: scoped observation of the matched seller rows.
- `expected`: the own price, product-wide "from" data, and matching seller prices
  distinguished, with coverage reported.
- `drift stop`: any required compatibility field is missing or unknown.

## Plan `price-change` — guarded own-offer price write

This is the only write path and is **off by default**; run it only when the user
explicitly asks to change the price of a specific own offer while logged in.

- `control`: that own offer's edit form, price field only.
- `disambiguation`: confirm the exact article/card, condition, language, and
  location plus the original price; do not proceed on an ambiguous match.
- `resolve`: scoped observation of the offer's edit control.
- `action`: after action-time confirmation, `set_value`/`type_text` **only the
  price field**, then `click` the visible submit control (never Enter).
- `verify`: scoped observation reading back the new price (and the restored value
  when the change was explicitly a test).
- `expected`: the new price is read back; no other field changed.
- `drift stop`: any step is ambiguous, blocked, or cannot be read back; bulk price
  updates and every other durable write stay disabled.
