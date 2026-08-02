// @glowbox/lcd — public surface. A character LCD module core (HD44780-class):
//   import { createLcdModule } from '@glowbox/lcd';
export { type Color, parseColor, type RGB } from './color';
export { FONT_5X7, glyph5x7 } from './font5x7';
export {
	createLcdModule,
	layLines,
	type LcdCursor,
	type LcdModule,
	type LcdModuleOptions
} from './lcd';
export { type PanelName, PANELS, type PanelSpec } from './panels';
