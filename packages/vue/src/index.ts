// @glowbox/vue — glowbox components for Vue 3:
//   import { LedGrid, NixieTube, SevenSegment, FlipDots } from "@glowbox/vue";
export { FlipDots } from './FlipDots';
export { LedGrid } from './LedGrid';
export { NixieTube } from './NixieTube';
export { SevenSegment } from './SevenSegment';

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
