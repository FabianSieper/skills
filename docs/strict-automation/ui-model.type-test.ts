/** Compile-only assertions: tsc must reject each marked invalid construction. */
import type { Node, Ready } from './ui-model.ts';
import { defineTransition } from './ui-model.ts';

function narrow(ui: Ready): void {
  if (ui.node === 'detail.offer-edit') {
    const articleId: string = ui.data.articleId;
    void articleId;
    // @ts-expect-error The editor does not contain a results collection.
    void ui.data.cards;
  }
}
void narrow;

// @ts-expect-error Node data must match the selected discriminant.
const invalidNode: Node = { node: 'home', data: { query: 'Forest' } };
void invalidNode;

defineTransition({
  id: 'example.invalid',
  // @ts-expect-error Unsupported source IDs cannot enter the registry.
  from: ['imaginary-page'],
  outcomes: { opened: 'detail' },
  auth: 'public',
  can: () => true,
  matchesTarget: () => true,
});

defineTransition({
  id: 'example.invalid-destination',
  from: ['home'],
  // @ts-expect-error Unsupported destinations cannot enter the registry.
  outcomes: { opened: 'imaginary-page' },
  auth: 'public',
  can: () => true,
  matchesTarget: () => true,
});
