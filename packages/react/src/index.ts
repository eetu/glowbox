// @glowbox/react — glowbox components for React:
//   import { LedGrid, NixieTube, SevenSegment, FlipDots, SplitFlap } from "@glowbox/react";
export { FlipDots, type FlipDotsProps } from './FlipDots';
export { LedGrid, type LedGridProps } from './LedGrid';
export { NixieTube, type NixieTubeProps } from './NixieTube';
export { SevenSegment, type SevenSegmentProps } from './SevenSegment';
export { SplitFlap, type SplitFlapProps } from './SplitFlap';

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
export type { FlapFace, SplitFlapBoard, SplitFlapOptions } from '@glowbox/split-flap';
