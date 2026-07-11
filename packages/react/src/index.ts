// @glowbox/react — glowbox components for React:
//   import { LedGrid, NixieTube } from "@glowbox/react";
export { LedGrid, type LedGridProps } from './LedGrid';
export { NixieTube, type NixieTubeProps } from './NixieTube';

// Re-export the core + nixie option/handle types so consumers can type against the
// components (`LedDisplay`, `NixieOptions`, …) without adding @glowbox/core or
// @glowbox/nixie as direct dependencies. The nixie handle is aliased to avoid clashing
// with the `NixieTube` component export above.
export type * from '@glowbox/core';
export type { NixieOptions, NixieStyle, NixieTube as NixieTubeHandle } from '@glowbox/nixie';
