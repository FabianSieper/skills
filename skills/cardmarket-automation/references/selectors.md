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