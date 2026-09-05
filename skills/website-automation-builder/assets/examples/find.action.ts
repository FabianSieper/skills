/** Local fixture example; adapt only after observing the real website. */
import { fileURLToPath } from 'node:url';
import type { Action } from '../runtime/engine.ts';
import { AutomationError } from '../runtime/errors.ts';
import { InventoryPage } from '../pages/InventoryPage.ts';

export const action: Action = {
  id: 'inventory.find', kind: 'read',
  modulePath: fileURLToPath(import.meta.url),
  next: ['inventory.open'],
  description: 'Find an item by its exact SKU; null means explicitly not found.',
  parameters: {sku:{type:'string',description:'Exact SKU',required:true,min:1,max:64}},
  outputDescription: 'null, or an object with the exact sku and nonempty title strings',
  run: async (page,input) => new InventoryPage(page).search(input.sku as string),
  validateOutput(value) {
    if (value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AutomationError('POSTCONDITION_FAILED');
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || typeof record.sku !== 'string' || typeof record.title !== 'string' || !record.title.trim())
      throw new AutomationError('POSTCONDITION_FAILED');
    return {sku:record.sku,title:record.title};
  }
};
