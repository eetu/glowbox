// @glowbox/lcd — public surface. A character LCD module core (HD44780-class):
//   import { createLcdModule } from '@glowbox/lcd';
export { type Color, parseColor, type RGB } from './color';
export { compile5x7, FONT_5X7, glyph5x7, repertoire5x7 } from './font5x7';
export { LATIN_5X7 } from './latin';
export {
	createLcdModule,
	layLines,
	type LcdCursor,
	type LcdModule,
	type LcdModuleOptions
} from './lcd';
export { type PanelName, PANELS, type PanelSpec } from './panels';
export { type PixelLayout, type PixelPart, type PixelRect } from './pixel';
export {
	crystalAt,
	type LcdDot,
	lcdInk,
	type LcdInkOptions,
	type LcdPixelOptions,
	lcdPixels,
	type LcdTargetOptions,
	lcdTargets,
	stepCrystals
} from './pixel-lcd';
export { type Theme } from './theme';
export { DEAD_AT, FLICKER_FROM, type Wear, wearLevels, wearOf } from './wear';
