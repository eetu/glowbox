// @glowbox/vue — glowbox components for Vue 3:
//   import { LedGrid, NixieTube, SevenSegment, FlipDots, SplitFlap, NeonSign } from "@glowbox/vue";
export { FlipDots } from './FlipDots';
export { LedGrid } from './LedGrid';
export { NeonSign } from './NeonSign';
export { NixieTube } from './NixieTube';
export { SevenSegment } from './SevenSegment';
export { SplitFlap } from './SplitFlap';

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
export type {
	GasName,
	NeonFont,
	NeonProgram,
	NeonSign as NeonSignHandle,
	NeonSignOptions
} from '@glowbox/neon';
export type { NixieOptions, NixieStyle, NixieTube as NixieTubeHandle } from '@glowbox/nixie';
export type {
	SevenSegmentDisplay,
	SevenSegmentOptions,
	SevenSegmentStyle
} from '@glowbox/seven-segment';
export type { FlapFace, SplitFlapBoard, SplitFlapOptions } from '@glowbox/split-flap';
