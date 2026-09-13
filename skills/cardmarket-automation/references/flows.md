# Supported munim-computer-use flows

All flows use the single bound Safari tab through `munim-computer-use_*` tools.
Observe fresh `get_app_state` before and after every interaction and verify exact
business identity. Stop on ambiguity, blockers, or UI drift.

## Find and read a card

1. From the Cardmarket home/game surface, locate one visible Magic search field
   (`TextField "Search"` plus its search control).
2. Set the query with `type_text`/`set_value`; do not submit with Enter.
3. Click the unique visible Search control and re-observe.
4. Verify a results surface (H1 `Search Results`, `N Hits`) or an explicit empty
   state.
5. Read at most 50 visible results. Preserve card name, set/printing, displayed
   image/variant evidence, URL, and "from" price classification.
6. Open only the result whose visible identity matches the requested target.
7. Verify the detail title and printing context before reporting detail data.

## Read sellers

1. Verify the exact detail identity.
2. Locate the seller-filter region and apply requested values. If the user gave
   none, use Excellent-or-better, English, Germany, any seller type, and leave
   foil/signed/altered unrestricted.
3. Submit through the unique visible UI control.
4. Re-observe and read every effective filter value back.
5. Read at most 50 seller rows (columns `Seller`, `Product Information`, `Offer`).
   Report filter semantics, timestamp, sorting, and coverage. A partial list is
   never a global minimum.

## Read versions or artworks

1. From verified detail, click the visible versions/reprints control
   (`Link "Show Versions (N)"`).
2. Verify the versions surface still names the same parent card.
3. Read at most 50 visible variants with set, artwork/image evidence,
   availability, and "from" price classification.
4. If one exact variant is requested, click it by full visible identity and verify
   the resulting detail page before reading seller prices.

## Read own offers

1. Require a visibly authenticated account state. If login or MFA is needed, hand
   control to the user and wait for confirmation before re-observing.
2. Navigate through visible Selling -> My Offers -> Singles controls.
3. Verify the own-offers heading, filter region, and table.
4. Apply requested stock filters, submit once, and read all effective values back.
5. Read at most 50 rows per page and 20 pages. Deduplicate using visible article
   identity. Report `complete:false` if the terminal page or filter continuity
   cannot be proven.

## Compare own and market offers

For each bounded own-offer target, bind the exact article/card identity and its
condition, language, variant flags, quantity, and price. Open the matching card
through its visible link, apply compatible seller filters, read them back, and
collect bounded seller prices. Return to the immediately preceding stock page with
the Safari `Go back` control and verify the stock filter/page context before
continuing.

Stop rather than compare incompatible or unknown variants. Distinguish the own
price, product-wide "from" data, and matching seller prices.

## Guarded own-offer price change

This is the only write path and is **off by default**. Run it only when the user
explicitly asks to change the price of a specific own offer, and only in a
logged-in state.

1. Confirm the exact own-offer identity (article/card, condition, language,
   location) and the original price. Do not proceed on an ambiguous match.
2. Ask for explicit confirmation at action time, naming the offer and the exact
   change.
3. Open the offer's edit control and set **only the price field**
   (`type_text`/`set_value`). Never touch any other field.
4. Submit, re-observe, and read back the new price.
5. When the change was a test, restore the original price, submit, re-observe, and
   read back the restored value.

If any step is ambiguous, blocked, or cannot be read back, stop and report. Do not
create, delete, or batch-update offers; bulk price updates and any other durable
write remain disabled.