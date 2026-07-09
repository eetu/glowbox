// @scene/led-grid core — framework-agnostic. Embed in any SPA:
//   import { createLedDisplay } from "@scene/led-grid";
// Framework wrappers are separate entry points (e.g. "@scene/led-grid/svelte").
export type { LedDisplay, LedDisplayOptions, RGB, Vec3 } from './led-display';
export { createLedDisplay } from './led-display';
