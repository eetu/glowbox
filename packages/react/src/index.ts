// @glowbox/react — glowbox components for React:
//   import { LedGrid, NixieTube, SevenSegment } from "@glowbox/react";
export { LedGrid, type LedGridProps } from './LedGrid';
export { NixieTube, type NixieTubeProps } from './NixieTube';
export { SevenSegment, type SevenSegmentProps } from './SevenSegment';

// Re-export the cores' option/handle types so consumers can type against the
// components (`LedDisplay`, `NixieOptions`, …) without adding the core packages as
// direct dependencies. Handles are aliased to avoid clashing with the component
// exports above.
export type * from '@glowbox/led-grid';
export type { NixieOptions, NixieStyle, NixieTube as NixieTubeHandle } from '@glowbox/nixie';
export type {
	SevenSegmentDisplay,
	SevenSegmentOptions,
	SevenSegmentStyle
} from '@glowbox/seven-segment';
