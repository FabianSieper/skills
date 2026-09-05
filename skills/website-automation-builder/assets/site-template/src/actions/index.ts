import { registerAction, type RegisteredAction } from "../runtime/engine.ts";

// BUILD_REQUIRED: import { action as find } from './catalog.find.ts';
// BUILD_REQUIRED: registerAction(find,new URL('./catalog.find.ts',import.meta.url))
export const actions: readonly RegisteredAction[] = [];
