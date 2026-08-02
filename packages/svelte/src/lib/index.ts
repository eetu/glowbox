// @glowbox/svelte — glowbox components for Svelte 5:
//   import { LedGrid, NixieTube, SevenSegment, FlipDots, SplitFlap, NeonSign, VfdPanel, LcdModule } from "@glowbox/svelte";
export { default as FlipDots } from './FlipDots.svelte';
export { default as LcdModule } from './LcdModule.svelte';
export { default as LedGrid } from './LedGrid.svelte';
export { default as NeonSign } from './NeonSign.svelte';
export { default as NixieTube } from './NixieTube.svelte';
export { default as SevenSegment } from './SevenSegment.svelte';
export { default as SplitFlap } from './SplitFlap.svelte';
export type { VfdValue } from './VfdPanel.svelte';
export { default as VfdPanel } from './VfdPanel.svelte';

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
