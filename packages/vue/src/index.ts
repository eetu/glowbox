// @glowbox/vue — glowbox components for Vue 3:
//   import { LedGrid, NixieTube } from "@glowbox/vue";
export { LedGrid } from './LedGrid';
export { NixieTube } from './NixieTube';

// Re-export the core + nixie option/handle types so consumers can type against the
// components (`LedDisplay`, `NixieOptions`, …) without adding @glowbox/led-grid or
// @glowbox/nixie as direct dependencies. The nixie handle is aliased to avoid clashing
// with the `NixieTube` component export above.
export type * from '@glowbox/led-grid';
export type { NixieOptions, NixieStyle, NixieTube as NixieTubeHandle } from '@glowbox/nixie';
