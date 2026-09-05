import { action as searchAction } from './search.action.ts';
import { action as priceAction } from './price.action.ts';
import { action as artworksAction } from './artworks.action.ts';
import type { Action } from '../runtime/engine.ts';

export const actions: Action[] = [searchAction, priceAction, artworksAction];