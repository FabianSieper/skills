import { registerAction } from "../runtime/engine.ts";
import { action as find } from "./inventory.find.ts";
import { action as update } from "./inventory.update-title.ts";
export const actions = [
  registerAction(find, new URL("./inventory.find.ts", import.meta.url)),
  registerAction(
    update,
    new URL("./inventory.update-title.ts", import.meta.url),
  ),
];
