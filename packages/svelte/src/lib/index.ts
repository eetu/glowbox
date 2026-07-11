// @glowbox/svelte — glowbox components for Svelte 5:
//   import { LedGrid, NixieTube } from "@glowbox/svelte";
export { default as LedGrid } from './LedGrid.svelte';
export { default as NixieTube } from './NixieTube.svelte';

// Re-export the core + nixie option/handle types so consumers can type against the
// components (`LedDisplay`, `NixieOptions`, …) without adding @glowbox/core or
// @glowbox/nixie as direct dependencies. The nixie handle is aliased to avoid clashing
// with the `NixieTube` component export above.
export type * from '@glowbox/core';
export type { NixieOptions, NixieStyle, NixieTube as NixieTubeHandle } from '@glowbox/nixie';
