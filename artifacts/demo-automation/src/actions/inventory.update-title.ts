/** Local fixture example; adapt only after observing the real website. */
import type { Action } from "../runtime/engine.ts";
import { AutomationError } from "../runtime/errors.ts";
import { InventoryPage } from "../pages/InventoryPage.ts";

export const action: Action = {
  id: "inventory.update-title",
  kind: "write",
  next: ["inventory.find"],
  description: "Update one item title after an exact preview.",
  preconditions: ["Authenticated inventory page is reachable."],
  postcondition: "The exact SKU shows the requested title and a new version.",
  parameters: {
    sku: {
      type: "string",
      description: "Exact SKU",
      required: true,
      min: 1,
      max: 64,
    },
    title: {
      type: "string",
      description: "New title",
      required: true,
      min: 1,
      max: 120,
    },
  },
  example: { sku: "SKU-42", title: "Replacement title" },
  outputDescription: "Object containing the exact SKU and saved title.",
  prepare: (page, input) =>
    new InventoryPage(page).previewTitle(
      input.sku as string,
      input.title as string,
    ),
  execute: (page, input, preview) =>
    new InventoryPage(page).updateTitle(
      input.sku as string,
      input.title as string,
      preview,
    ),
  validateOutput(value) {
    const row = value as { sku?: unknown; title?: unknown };
    if (
      !value ||
      typeof value !== "object" ||
      typeof row.sku !== "string" ||
      typeof row.title !== "string" ||
      !row.title.trim()
    )
      throw new AutomationError("POSTCONDITION_FAILED", "output");
    return { sku: row.sku, title: row.title };
  },
};
