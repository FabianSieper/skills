# Page and control evidence

This munim-computer-use skill resolves controls only from fresh accessibility
state (`munim-computer-use_get_app_state`). There is no legacy selector interface;
this file is the only operating evidence.

## Recognition rules

- URL origin must be exactly `https://www.cardmarket.com`; URL alone is never
  sufficient.
- A page needs a unique visible heading/context and its expected main region.
- A control needs exactly one current accessible match inside the relevant business
  context. Missing or duplicate matches are UI drift.
- Accessibility element IDs expire after every interaction or rerender. Always
  obtain a fresh state before resolving the next target.
- Prefer roles/names and nearby card, set, artwork, seller, or article identity.
  Do not select by visual order alone.
- Never fall back to guessed coordinates, hidden DOM data, raw HTML, or a URL
  constructed from observed slugs.

## Targeted observations

Reconfirm a surface or origin cheaply with `query` observations, which keep valid
fresh IDs without returning the whole tree:

- **Post-navigation origin/title:** `query:"cardmarket"` or `query:"<page title
  fragment>"` confirms the origin and the loaded page. The address bar follows the
  WebArea content, so a small root-anchored tree can miss it.
- **Pre-action control:** `query:"Search"` confirms the search field and its control
  before the results flow; `query:"shopping cart"` resolves the buy controls on a
  detail page.
- A **zero-match** query is a minimal payload and still proves the tree is current;
  it does not by itself prove the control is absent.

## Planned control map

The plans in [flows](flows.md) resolve these documented controls. A zero match on a
row's `resolve` or `verify` query is UI drift: stop and report; do not probe or dump
the full tree.

| plan | documented control (accessibility) | `resolve` query | `verify` query / expected |
|---|---|---|---|
| `reanchor` | address bar `TextField "smart search field"`; one tab at the fixed `/en` home entry | tab-bar / `window:<index>` | `query:"cardmarket"` → exact `/en` origin + start shell |
| `search` | `TextField "Search"` beside `PopUpButton "Category"` + adjacent search `Button` | `query:"Search"` | `query:"Search Results"` → `N Hits` or empty state |
| `open-result` | result `Link` (image + `Heading "<Set> <Card>"` + `From`) | result rows in bound window | detail title + printing identity both match |
| `read-sellers` | visible seller sort/filter controls + offers table | offers region | each effective filter reads back, or a no-filter report |
| `versions` | `Link "Show Versions (N)"` on detail | versions control | versions heading names the same parent card |
| `open-variant` | variant `Link` (set + optional `Version N` + `From`) | variant rows | detail identity matches the variant |
| `own-offers` | Selling -> My Offers -> Singles controls | Selling nav | own-offers heading + table + filters read back |
| `own-offer-market` | stock row's card `Link` (article/card identity) | stock row | detail matches; `Go back` restores stock context |

`reanchor` is the only direct navigation and targets only `https://www.cardmarket.com/en`;
all other movement uses visible forward controls. The start-shell search `Button` may need
a bounded `max_elements:120` start-region read when it is not found by `query`.

## Known semantic surfaces

- **Start:** Magic game shell (`WebArea` "Cardmarket: Buy & Sell MTG Cards ..."),
  main search box (`TextField "Search"`, `PopUpButton "Category"`, empty-named
  search `Button`), category links (`SINGLES`, `BOOSTERS`, ...). A login form
  (`TextField "Username"`/`"Password"`, `Button "Log in"`) is a blocker; the
  underlying start shell is not ready while the overlay is present.
- **Search suggestion dropdown:** after typing, a list of `Link`s of the form
  `"<Set> <Card> <count> Singles"`, plus `Link "Advanced Singles Search"` and
  `Link "Show All (N+ Hits)"`. For the results flow, do not click suggestion
  Links; click the visible Search control.
- **Results:** H1 `Search Results`; filter region (`PopUpButton "Category"`,
  `PopUpButton "Expansion"`, `TextField "Name"`, `CheckBox "Exact Match"`,
  `CheckBox "Only available"`, `Button "Search"`, `PopUpButton "Sort by"`);
  hit line `N Hits`; `Button " LIST VIEW"`/`" GRID VIEW"`; result `Link`s
  (image + `Heading "<Set> <Card>"` + `From` price); pagination controls.
- **Detail:** breadcrumb ending in the card; H1 `<Card> <Set> - Singles`; info
  block (`Rarity`, `Number`, `Printed in`, `Reprints` with
  `Link "Show Versions (N)"`/`Link "Show Offers"`, `Available items`, `From`,
  `Price Trend`, 30/7/1-day average price); rules text; offers table
  (columns `Seller Location`/`Seller Type`/`Language`/`Min. Condition`/`Extra`/
  `Quantity`; per-row seller `Link`, condition `Link`, language, price,
  buy control). The observed table has sortable column headers, not necessarily a
  seller-filter form; if no filter controls are present, report unfiltered offers.
- **Versions/artworks:** breadcrumb ending in `<Card> - Versions`, H1
  `<Card> N versions`, `SHOW VERSIONS`/`SHOW OFFERS` controls, and variant
  `Link`s with set, optional `Version N`, availability, and `From` price evidence.
  The detail page's `Show Versions (N)` count may differ from the versions page's
  total version count; verify the parent-card identity rather than assuming the
  counts are identical.
- **Own offers:** authenticated Selling -> My Offers -> Singles heading and offer
  table. A stock filter region may be absent; if absent, report that no stock
  filters were applied.

Price values use the German/European format (`0,10 €` — comma decimal separator,
space before the currency symbol).

Cardmarket can change labels and layout. These descriptions are recognition
requirements, not permission to guess a selector. If the current state does not
prove the surface or target, stop and report the missing/ambiguous evidence.