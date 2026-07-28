// @glowbox/split-flap — an electromechanical split-flap display component (a sibling
// rendering core to @glowbox/flip-dot and @glowbox/seven-segment):
//   import { createSplitFlap } from "@glowbox/split-flap";
//   const board = createSplitFlap(canvas, { cols: 12, sound: true });
//   board?.setText("DEPARTURES");
export { type Color, parseColor, type RGB } from './color';
export {
	DEFAULT_CHARSET,
	DRUM_ALNUM,
	DRUM_DIGITS,
	DRUM_NORDIC,
	flapIndex,
	flapsOf,
	padCells,
	stepsBetween
} from './drum';
export {
	chromaDrum,
	type ChromaDrumOptions,
	paletteFrame,
	type PaletteFrameOptions
} from './palette';
export { createMechSound, type MechSound, type MechTick } from './sound';
export {
	createSplitFlap,
	type FlapFace,
	type SplitFlapBoard,
	type SplitFlapOptions
} from './split-flap';
