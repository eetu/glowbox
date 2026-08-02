// @glowbox/react — glowbox components for React:
//   import { LedGrid, NixieTube, SevenSegment, FlipDots, SplitFlap, NeonSign, VfdPanel, LcdModule } from "@glowbox/react";
export { FlipDots, type FlipDotsProps } from './FlipDots';
export { LcdModule, type LcdModuleProps } from './LcdModule';
export { LedGrid, type LedGridProps } from './LedGrid';
export { NeonSign, type NeonSignProps } from './NeonSign';
export { NixieTube, type NixieTubeProps } from './NixieTube';
export { SevenSegment, type SevenSegmentProps } from './SevenSegment';
export { SplitFlap, type SplitFlapProps } from './SplitFlap';
export { VfdPanel, type VfdPanelProps, type VfdValue } from './VfdPanel';

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
export type {
	LcdCursor,
	LcdModule as LcdModuleHandle,
	LcdModuleOptions,
	PanelName,
	PanelSpec
} from '@glowbox/lcd';
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
export type {
	FilterName,
	PhosphorName,
	VfdBars,
	VfdDigits,
	VfdElement,
	VfdGlyphs,
	VfdIcon,
	VfdLegend,
	VfdPanel as VfdPanelHandle,
	VfdPanelOptions,
	VfdRule,
	VfdScale
} from '@glowbox/vfd';
