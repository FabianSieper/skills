# Page and control evidence

This Computer Use skill resolves controls from fresh accessibility state. The
older TypeScript POM selectors are legacy evidence only and are not an operating
interface.

## Recognition rules

- URL origin must be exactly `https://www.cardmarket.com`; URL alone is never
  sufficient.
- A page needs a unique visible heading/context and its expected main region.
- A control needs exactly one current accessible match inside the relevant
  business context. Missing or duplicate matches are UI drift.
- Accessibility indices expire after every interaction or rerender. Always
  obtain a fresh AX tree before resolving the next target.
- Prefer roles/names and nearby card, set, artwork, seller, or article identity.
  Do not select by visual order alone.
- Never fall back to guessed coordinates, hidden DOM data, raw HTML, or a URL
  constructed from observed slugs.

## Known semantic surfaces

- Search entry: Magic game shell, visible search textbox, visible Search button.
- Results: search context plus card result collection or explicit empty message.
- Detail: one card title plus printing/product context and seller region.
- Versions: versions/reprints/artworks context tied to the same parent card.
- Own offers: authenticated Selling → My Offers → Singles heading, stock filter,
  and offer table.

Cardmarket can change labels and layout. These descriptions are recognition
requirements, not permission to guess a selector. If the current AX state does
not prove the surface or target, stop and report the missing/ambiguous evidence.
