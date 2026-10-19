import { pageRoutes, type FileRouteTreeEntry } from 'virtual:file-routes';
import { createRouter } from '@solidjs/router';
import { fileRoutes } from '@solidjs/router/fs';
import { base } from './base';

// Widened to an array: inferring the router's types from the generated tuple of every route goes past TypeScript's
// instantiation depth limit (TS2589) once the docs have a few dozen pages. Nothing here reads typed paths.
export const Router = createRouter({ base, routes: fileRoutes(pageRoutes as readonly FileRouteTreeEntry[]) });
