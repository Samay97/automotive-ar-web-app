import * as earcut from 'earcut';
import { loadInspector } from './helper/inspector';
loadInspector();
(window as any).earcut = earcut;

export * from './app';
export * from './xr-session';
