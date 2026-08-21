// @glowbox/flip-dot — an electromechanical flip-dot board component (a sibling
// rendering core to @glowbox/nixie and @glowbox/seven-segment):
//   import { createFlipDots, ditherFrame } from "@glowbox/flip-dot";
//   const board = createFlipDots(canvas, { cols: 28, rows: 14, sound: true });
//   board?.setFrame(ditherFrame((x, y) => luma(x, y), 28, 14));
export { type Color, parseColor, type RGB } from './color';
export { ditherFrame, type DitherMode, type DitherOptions, type GraySource } from './dither';
export {
	createFlipDots,
	type FlipDotBoard,
	type FlipDotShape,
	type FlipDotsOptions,
	type FlipDotStagger
} from './flip-dot';
export { createMechSound, type MechSound, type MechTick } from './sound';
export { type Theme } from './theme';
