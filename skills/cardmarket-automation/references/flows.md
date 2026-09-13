# Supported Computer Use flows

All flows use the single bound Unified Computer Use tab. Observe fresh AX state
before and after every interaction and verify exact business identity. Stop on
ambiguity, blockers, or UI drift.

## Find and read a card

1. From the Cardmarket home/game surface, locate one visible Magic search field.
2. Set the query with `setValue`; do not submit with Enter.
3. Click the unique visible Search control and re-observe.
4. Verify a results surface or an explicit empty state.
5. Read at most 50 visible results. Preserve card name, set/printing, displayed
   image/variant evidence, URL, and “from” price classification.
6. Open only the result whose visible identity matches the requested target.
7. Verify the detail title and printing context before reporting detail data.

## Read sellers

1. Verify the exact detail identity.
2. Locate the seller-filter region and apply requested values. If the user gave
   none, use Excellent-or-better, English, Germany, any seller type, and leave
   foil/signed/altered unrestricted.
3. Submit through the unique visible UI control.
4. Re-observe and read every effective filter value back.
5. Read at most 50 seller rows. Report filter semantics, timestamp, sorting, and
   coverage. A partial list is never a global minimum.

## Read versions or artworks

1. From verified detail, click the visible versions/reprints/artwork control.
2. Verify the versions surface still names the same parent card.
3. Read at most 50 visible variants with set, artwork/image evidence,
   availability, and “from” price classification.
4. If one exact variant is requested, click it by full visible identity and
   verify the resulting detail page before reading seller prices.

## Read own offers

1. Require a visibly authenticated account state. If login or MFA is needed,
   hand control to the user and wait for confirmation before re-observing.
2. Navigate through visible Selling → My Offers → Singles controls.
3. Verify the own-offers heading, filter region, and table.
4. Apply requested stock filters, submit once, and read all effective values
   back.
5. Read at most 50 rows per page and 20 pages. Deduplicate using visible article
   identity. Report `complete:false` if the terminal page or filter continuity
   cannot be proven.

## Compare own and market offers

For each bounded own-offer target, bind the exact article/card identity and its
condition, language, variant flags, quantity, and price. Open the matching card
through its visible link, apply compatible seller filters, read them back, and
collect bounded seller prices. Return to the immediately preceding stock page
with browser history and verify the stock filter/page context before continuing.

Stop rather than compare incompatible or unknown variants. Distinguish the own
price, product-wide “from” data, and matching seller prices.

## Unsupported writes

Offer creation, editing, deletion, and bulk price updates are disabled. Do not
open an edit workflow as a workaround and do not submit any durable change.
