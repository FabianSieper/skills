# Selectors

Selectors are encapsulated in Page Object Models (`src/pages/*.ts`).
Do not use or reference them directly. The agent interacts only via registered CLI actions.

`OwnOffersPage` owns the authenticated Selling → My Offers → Singles table, its left-hand filter, bottom pagination, and card-name links. It rejects missing or non-unique controls and verifies the stock filter remains unchanged while reading all pages.
