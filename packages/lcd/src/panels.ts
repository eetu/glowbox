// The glass presets. A character module is a sandwich: polarizers + liquid crystal
// over a backlight (or a reflector), and the PANEL — not the controller — decides how
// the family's first reflective display reads:
//   • 'green'  — the classic STN yellow-green, POSITIVE image: dark ink on a lit pane.
//     Readable with the backlight off too (that's what reflective means).
//   • 'blue'   — STN blue, NEGATIVE image: light ink on a deep blue pane. Transmissive,
//     so the backlight IS the image: unlit it drops to a barely-there ghost.
//   • 'white'  — FSTN black-on-white, positive; the "modern" module.
// Ink never changes hue with drive — a dot is a shutter, not an emitter. What drive
// changes is how CLOSED the shutter is, which is why everything downstream is one
// alpha per dot.
import { type RGB } from './color';

export type PanelName = 'green' | 'blue' | 'white';

export interface PanelSpec {
	/** The pane with the backlight at full. */
	pane: RGB;
	/** The pane with the backlight off (reflected room light — or almost nothing,
	 *  for a transmissive negative panel). */
	paneOff: RGB;
	/** The ink — what a fully driven dot looks like. On a negative panel this is
	 *  LIGHT (the shutter opens onto the backlight). */
	ink: RGB;
	/** Negative image: ink is light-through, so its visibility rides the backlight. */
	negative: boolean;
	/** Resting visibility of an undriven dot — the famous ghost lattice you can see
	 *  on any STN at an angle. */
	ghost: number;
}

export const PANELS: Record<PanelName, PanelSpec> = {
	green: {
		pane: [0.68, 0.75, 0.36],
		paneOff: [0.56, 0.6, 0.44],
		ink: [0.09, 0.12, 0.14],
		negative: false,
		ghost: 0.07
	},
	blue: {
		pane: [0.05, 0.13, 0.55],
		paneOff: [0.04, 0.05, 0.1],
		ink: [0.93, 0.96, 1],
		negative: true,
		ghost: 0.05
	},
	white: {
		pane: [0.92, 0.93, 0.95],
		paneOff: [0.6, 0.61, 0.63],
		ink: [0.07, 0.08, 0.1],
		negative: false,
		ghost: 0.05
	}
};
