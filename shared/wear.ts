// SHARED SOURCE. This file lives in `shared/` and is SYMLINKED into each package that
// needs it (see `scripts/check-shared.mjs` and CLAUDE.md → Conventions). Editing it here
// edits it for every one of them. It is not a package and nothing depends on it at
// runtime: each bundler inlines it, so the cores stay genuinely zero-dep.
// Shared by: flip-dot, lcd, neon, nixie, seven-segment, vfd.
//
// The wear the displays age by, as a function of (part, age, t, seed) for the pixel exports:
// a game's world is a function of time and seed, so nothing here keeps state, reads a clock
// or calls Math.random. The arc is the canvas cores' (they keep their own timer-scheduled
// version): each part dims by up to half its wear at full age; past 0.7 the most-worn part
// dips now and then; from 0.95 it is dead and the runner-up takes over the dips.

/** How worn, and when: `age` 0 fresh … 1 worn out, `seed` the instance, `t` seconds. */
export interface Wear {
	age: number;
	seed: number;
	t: number;
}

/** From this age the most-worn part dips; from `DEAD_AT` it is off for good. */
export const FLICKER_FROM = 0.7;
export const DEAD_AT = 0.95;
/** A dip is due once in each window of this many seconds, if at all. */
const WINDOW = 1.4;

/** A seeded hash of three integers to 0..1: the jitter and the dips are its draws. */
export const unit = (a: number, b: number, c: number): number => {
	let h =
		Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Each of `count` parts' wear, 0..1: deterministic per seed, different across seeds. */
export function wearOf(count: number, seed: number): Float32Array {
	const w = new Float32Array(count);
	for (let i = 0; i < count; i++) w[i] = 0.5 + 0.5 * Math.sin(seed + i * 12.9898);
	return w;
}

/**
 * Each part's light multiplier at `t`, into `out`: 1 fresh, `1 − wear·age/2` worn. Past
 * `FLICKER_FROM` the most-worn part dips once in most 1.4 s windows to 5–35 %, recovering
 * in about a sixth of a second; past 0.9 the runner-up takes some of the dips; from
 * `DEAD_AT` the most-worn part is 0 and the runner-up takes them all.
 */
export function wearLevels(
	count: number,
	{ age, seed, t }: Wear,
	out: Float32Array = new Float32Array(count)
): Float32Array {
	const wear = wearOf(count, seed);
	let dying = 0;
	for (let i = 1; i < count; i++) if (wear[i] > wear[dying]) dying = i;
	let second = dying === 0 ? 1 : 0;
	for (let i = 0; i < count; i++) if (i !== dying && wear[i] > wear[second]) second = i;
	for (let i = 0; i < count; i++) out[i] = 1 - wear[i] * age * 0.5;
	if (age > FLICKER_FROM && count > 1) {
		const k = Math.floor(t / WINDOW);
		const s = Math.round(seed * 1000);
		const at = k * WINDOW + unit(s, k, 1) * (WINDOW - 0.4);
		if (unit(s, k, 2) < 0.85 && t >= at) {
			const depth = 0.05 + 0.3 * unit(s, k, 3);
			const target = age >= DEAD_AT || (age >= 0.9 && unit(s, k, 4) < 0.35) ? second : dying;
			out[target] *= Math.min(1, depth + (t - at) * 6);
		}
	}
	if (age >= DEAD_AT) out[dying] = 0;
	return out;
}
