// Gas presets — what's inside the tube decides the light. Clear-glass fills (neon's
// red-orange, argon/mercury's blue) glow the gas's own colour and leave near-neutral
// glass when off; phosphor-coated tubes (the greens, golds and roses of real signage)
// are visibly painted even unlit — their coat shows in the dead-glass pass. `core` is
// how white-hot the centre of the tube reads relative to the gas colour, and `ink` is
// what the same fill discharges when it absorbs instead of emits.
import type { RGB } from './color';

export type GasName = 'neon' | 'argon' | 'helium' | 'co2' | 'green' | 'gold' | 'rose';

export interface GasSpec {
	/** The lit gas colour. */
	color: RGB;
	/** The ink this gas discharges under `polarity: 'absorb'` — the gas's own
	 *  pigment rather than a darkened copy of `color`: clear fills ink their hue
	 *  deep, and a near-white fill inverts (co2's black light). That inversion is
	 *  the invented part, so it is a table value, not a formula. */
	ink: RGB;
	/** Hot-core whiteness 0..1 — how far the tube centre mixes toward white. */
	core: number;
	/** The unlit tube's tint (the dead-glass pass). */
	unlit: RGB;
	/** Phosphor-coated: the off tube shows its coat clearly, not just pale glass. */
	coated: boolean;
}

export const GASES: Record<GasName, GasSpec> = {
	neon: {
		color: [1, 0.32, 0.12],
		ink: [0.62, 0.12, 0.05],
		core: 0.72,
		unlit: [0.62, 0.4, 0.34],
		coated: false
	},
	argon: {
		color: [0.5, 0.62, 1],
		ink: [0.11, 0.2, 0.62],
		core: 0.8,
		unlit: [0.46, 0.49, 0.58],
		coated: false
	},
	helium: {
		color: [1, 0.55, 0.48],
		ink: [0.6, 0.2, 0.16],
		core: 0.7,
		unlit: [0.6, 0.46, 0.42],
		coated: false
	},
	co2: {
		color: [0.92, 0.95, 1],
		ink: [0.06, 0.07, 0.1],
		core: 0.85,
		unlit: [0.55, 0.56, 0.6],
		coated: false
	},
	green: {
		color: [0.3, 1, 0.45],
		ink: [0.06, 0.42, 0.16],
		core: 0.65,
		unlit: [0.42, 0.6, 0.46],
		coated: true
	},
	gold: {
		color: [1, 0.72, 0.2],
		ink: [0.55, 0.36, 0.05],
		core: 0.65,
		unlit: [0.64, 0.55, 0.36],
		coated: true
	},
	rose: {
		color: [1, 0.4, 0.62],
		ink: [0.62, 0.1, 0.27],
		core: 0.68,
		unlit: [0.66, 0.47, 0.54],
		coated: true
	}
};

// A named colour IS the ink it lays down, so absorbed light keeps the ordering the
// eye reads when the same sign emits: a pale tube inks faintly, a saturated one
// deeply. The curve is per-channel so hue survives, and the cap keeps the palest
// pigment a mark rather than nothing.
const INK_GAMMA = 1.4;
const INK_MAX = 0.88;

export function pigment(c: RGB): RGB {
	const p: RGB = [c[0] ** INK_GAMMA, c[1] ** INK_GAMMA, c[2] ** INK_GAMMA];
	const top = Math.max(p[0], p[1], p[2]);
	if (top <= INK_MAX) return p;
	const k = INK_MAX / top;
	return [p[0] * k, p[1] * k, p[2] * k];
}
