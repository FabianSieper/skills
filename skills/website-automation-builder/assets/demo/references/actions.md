# Local fixture action evidence

## inventory.find

Search filters → exact SKU result → exact item or explicit empty marker. POM verifies SKU and nonempty title. next: inventory.update-title. Automated fixture evidence is produced by scripts/test-demo.mjs; real site evidence is separate.

## inventory.update-title

Read account/target/version preview → approved edit dialog → save → exact title and new version. next: inventory.find. Fixture tests include account/version drift, uncertain commit and replay rejection. No real business writes are authorized by this demo.
