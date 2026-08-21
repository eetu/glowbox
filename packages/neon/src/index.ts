// @glowbox/neon — a glass-tube neon sign component (a sibling rendering core to
// @glowbox/nixie and the other glowbox displays):
//   import { createNeonSign } from "@glowbox/neon";
//   const sign = createNeonSign(canvas, { text: 'Open', gas: 'rose', sound: true });
//   sign?.setText('Cocktails');
export { type Color, parseColor, type RGB } from './color';
export { HERSHEY_LICENSE, type NeonFont, type NeonGlyph, resolveFont } from './font';
export { GASES, type GasName, type GasSpec } from './gas';
export {
	type LayoutOptions,
	layoutTubes,
	type NeonArt,
	type NeonLayout,
	roundCorners,
	type TubeGrouping,
	type TubeSection
} from './layout';
export { createNeonSign, type NeonProgram, type NeonSign, type NeonSignOptions } from './neon';
export { pathToStrokes, type PathToStrokesOptions } from './path';
export { createHum, createMechSound, type HumVoice, type MechSound, type MechTick } from './sound';
export { type Theme } from './theme';
