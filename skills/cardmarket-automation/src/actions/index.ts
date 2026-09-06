import { action as navHomeAction } from './nav-home.action.ts';
import { action as navSearchAction } from './nav-search.action.ts';
import { action as navOpenAction } from './nav-open.action.ts';
import { action as navVersionsAction } from './nav-versions.action.ts';
import { action as navArtworkAction } from './nav-artwork.action.ts';
import { action as navFilterAction } from './nav-filter.action.ts';
import { action as infoAction } from './info.action.ts';
import type { Action } from '../runtime/engine.ts';

export const actions: Action[] = [navHomeAction, navSearchAction, navOpenAction, navVersionsAction, navArtworkAction, navFilterAction, infoAction];
