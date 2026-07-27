// @glowbox/svelte — glowbox components for Svelte 5:
//   import { LedGrid, NixieTube, SevenSegment, FlipDots } from "@glowbox/svelte";
export { default as FlipDots } from './FlipDots.svelte';
export { default as LedGrid } from './LedGrid.svelte';
export { default as NixieTube } from './NixieTube.svelte';
export { default as SevenSegment } from './SevenSegment.svelte';

// Re-export the cores' option/handle types so consumers can type against the
// components (`LedDisplay`, `NixieOptions`, …) without adding the core packages as
// direct dependencies. Handles are aliased to avoid clashing with the component
// exports above.
export type {
	FlipDotBoard,
	FlipDotShape,
	FlipDotsOptions,
	FlipDotStagger
} from '@glowbox/flip-dot';
export type * from '@glowbox/led-grid';
export type { NixieOptions, NixieStyle, NixieTube as NixieTubeHandle } from '@glowbox/nixie';
export type {
	SevenSegmentDisplay,
	SevenSegmentOptions,
	SevenSegmentStyle
} from '@glowbox/seven-segment';
