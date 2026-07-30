// Gas presets — what's inside the tube decides the light. Clear-glass fills (neon's
// red-orange, argon/mercury's blue) glow the gas's own colour and leave near-neutral
// glass when off; phosphor-coated tubes (the greens, golds and roses of real signage)
// are visibly painted even unlit — their coat shows in the dead-glass pass. `core` is
// how white-hot the centre of the tube reads relative to the gas colour.
import type { RGB } from './color';

export type GasName = 'neon' | 'argon' | 'helium' | 'co2' | 'green' | 'gold' | 'rose';

export interface GasSpec {
	/** The lit gas colour. */
	color: RGB;
	/** Hot-core whiteness 0..1 — how far the tube centre mixes toward white. */
	core: number;
	/** The unlit tube's tint (the dead-glass pass). */
	unlit: RGB;
	/** Phosphor-coated: the off tube shows its coat clearly, not just pale glass. */
	coated: boolean;
}

export const GASES: Record<GasName, GasSpec> = {
	neon: { color: [1, 0.32, 0.12], core: 0.72, unlit: [0.62, 0.4, 0.34], coated: false },
	argon: { color: [0.5, 0.62, 1], core: 0.8, unlit: [0.46, 0.49, 0.58], coated: false },
	helium: { color: [1, 0.55, 0.48], core: 0.7, unlit: [0.6, 0.46, 0.42], coated: false },
	co2: { color: [0.92, 0.95, 1], core: 0.85, unlit: [0.55, 0.56, 0.6], coated: false },
	green: { color: [0.3, 1, 0.45], core: 0.65, unlit: [0.42, 0.6, 0.46], coated: true },
	gold: { color: [1, 0.72, 0.2], core: 0.65, unlit: [0.64, 0.55, 0.36], coated: true },
	rose: { color: [1, 0.4, 0.62], core: 0.68, unlit: [0.66, 0.47, 0.54], coated: true }
};
