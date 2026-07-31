// The glass: what the anodes are painted with, and what you look at them through.
// Two independent presets, because a real panel has two independent parts —
//   • PHOSPHOR is the paint on the anode. It decides the emitted colour, how white the
//     hot centre of a driven anode reads, the pale tint the *undriven* paint shows
//     (every VFD has faint ghost shapes floating behind the glass), how wide the glow
//     blooms, and how long it lingers after the drive stops (`lag` — the smear).
//   • FILTER is the tinted window in front of the whole envelope. Almost every stereo
//     panel had one: it multiplies everything, pushes the light toward its own hue, and
//     — the reason it exists — crushes those undriven ghost shapes so the dark parts of
//     the panel read as black instead of grey.
// The pairing is the look: ZnO:Zn behind green plastic is the cyan-green stereo face
// everyone remembers; the same phosphor behind smoke reads colder and more clinical.
import type { RGB } from './color';

/** Anode phosphors. 'zn-o' (ZnO:Zn, ~505 nm) is the classic stereo cyan-green and the
 *  default; 'blue' is the later premium look, 'amber' the car-radio/clock-radio one,
 *  'white' the filtered-to-neutral rarity. */
export type PhosphorName = 'zn-o' | 'blue' | 'amber' | 'white';

export interface PhosphorSpec {
	/** The emitted colour of a fully-driven anode. */
	color: RGB;
	/** Hot-core whiteness 0..1 — how far a driven anode's centre mixes toward white.
	 *  Runs high for VFDs: a lit anode is visibly whiter in the middle than an LED. */
	core: number;
	/** The undriven anode's own tint — the phosphor PAINT, visible as faint ghost
	 *  shapes behind the glass whenever the filter doesn't hide them. */
	anode: RGB;
	/** Glow spread multiplier. Phosphor blooms wider and softer than an LED die. */
	halo: number;
	/** Persistence multiplier: how long this phosphor lingers after the drive stops,
	 *  relative to the panel's `persistence`. ZnO:Zn is fast; blues linger. */
	lag: number;
}

export const PHOSPHORS: Record<PhosphorName, PhosphorSpec> = {
	'zn-o': { color: [0.42, 1, 0.82], core: 0.82, anode: [0.5, 0.56, 0.5], halo: 1.6, lag: 1 },
	blue: { color: [0.44, 0.68, 1], core: 0.78, anode: [0.48, 0.52, 0.58], halo: 1.8, lag: 1.35 },
	amber: { color: [1, 0.66, 0.2], core: 0.7, anode: [0.56, 0.5, 0.42], halo: 1.4, lag: 0.85 },
	white: { color: [0.88, 0.95, 1], core: 0.88, anode: [0.54, 0.55, 0.56], halo: 1.7, lag: 1.1 }
};

/** The tinted window in front of the envelope. 'green' is the stereo-faceplate classic,
 *  'smoke' the neutral grey one, 'amber' the warm strip; 'none' leaves bare glass (the
 *  undriven anode ghosts stay clearly visible, which is what a filterless panel looks
 *  like). Any `Color` works too — it's treated as a green-density filter of that hue. */
export type FilterName = 'none' | 'green' | 'smoke' | 'amber';

export interface FilterSpec {
	/** What the window multiplies through. */
	tint: RGB;
	/** How much of the undriven-anode ghost survives, 0..1 (0 = perfectly hidden). */
	ghost: number;
	/** How dark the glass reads where nothing is lit at all, 0..1. */
	floor: number;
}

export const FILTERS: Record<FilterName, FilterSpec> = {
	none: { tint: [1, 1, 1], ghost: 1, floor: 0.1 },
	green: { tint: [0.44, 1, 0.66], ghost: 0.22, floor: 0.035 },
	smoke: { tint: [0.68, 0.72, 0.78], ghost: 0.3, floor: 0.045 },
	amber: { tint: [1, 0.7, 0.32], ghost: 0.25, floor: 0.04 }
};
