// @glowbox/vfd — a vacuum-fluorescent display PANEL: the stereo faceplate, where a
// character field, screen-printed word legends, a spectrum grid, icons and a tuning dial
// all live in one vacuum envelope and share its phosphor persistence, its dimmer, its
// filament haze and its filter glass.
//
//   import { createVfdPanel } from "@glowbox/vfd";
//   const panel = createVfdPanel(canvas, {
//     frame: [320, 64],
//     layout: [
//       { kind: 'digits', name: 'main', chars: 8, glyphs: '14seg', x: 10, y: 8, w: 150, h: 30 },
//       { kind: 'legend', name: 'st', text: 'ST', x: 172, y: 6, w: 14, h: 8 },
//       { kind: 'bars', name: 'spec', bands: 12, rows: 8, peakHold: true, x: 200, y: 8, w: 110, h: 34 }
//     ]
//   });
//   panel?.set('main', 'FM 98.50');
//   panel?.light('st', true);
export { type Color, parseColor, type RGB } from './color';
export {
	CELL,
	CELL_EXTRAS,
	CELL_SLANT,
	cellGeometry,
	MATRIX_DOTS,
	matrixDotLit,
	matrixGeometry,
	segmentBits,
	segmentCount,
	segmentNames,
	type VfdGlyphs,
	type WordRect,
	wordRuns
} from './faces';
export { FONT_5X7, glyph5x7 } from './font5x7';
export {
	type CellContent,
	type CompiledElement,
	compilePanel,
	driveElement,
	type ElementState,
	fallPeaks,
	GRID_COLS,
	layCells,
	type VfdAnode,
	type VfdBars,
	type VfdDigits,
	type VfdDots,
	type VfdElement,
	type VfdIcon,
	type VfdLegend,
	type VfdPanelLayout,
	type VfdRule,
	type VfdScale
} from './panel';
export { pathToPolys, type PathToPolysOptions } from './path';
export {
	type FilterName,
	FILTERS,
	type FilterSpec,
	type PhosphorName,
	PHOSPHORS,
	type PhosphorSpec
} from './phosphor';
export { createVfdPanel, type VfdPanel, type VfdPanelOptions } from './vfd';
