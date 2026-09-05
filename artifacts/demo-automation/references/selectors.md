# Fixture locator evidence

InventoryPage: inventory root, query-specific result-<sku>, item-<sku>, data-sku and data-version are fixture-defined identities. Each interactive target has expected count=1. Exact German textbox/button/dialog names match fixtures/inventory.html. Repeated title test IDs are scoped to the unique item; test IDs alone do not prove uniqueness. SitePage uses inventory state/account attributes. InventorySummary reads inventory-summary. Observe regions are search-filters and results. These are authored test fixtures, not observed real website locators.
