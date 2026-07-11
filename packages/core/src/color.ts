// Colour handling for @glowbox/core. A `Color` is either a numeric RGB triple in
// 0..1 (values >1 are allowed and bloom under the additive glow) or any CSS colour
// string ('#ff8800', 'rgb(0 128 255)', 'tomato', 'hsl(...)', …). Everything is
// normalised to a plain `RGB` before it reaches the LED buffer.
//
// Note: only the array form can exceed 1 (bloom); CSS strings are 0..255 → 0..1.

export type RGB = [number, number, number];
export type Vec3 = [number, number, number];
export type Color = RGB | string;

// Parsed strings are memoised — draw callbacks may pass the same literal thousands
// of times per frame, so this must be O(1) after the first sighting.
const cache = new Map<string, RGB>();

// A throwaway 2D context normalises any CSS colour the browser understands. Created
// lazily and only when a non-hex string is seen; `null` when there's no DOM (SSR /
// pure-node), in which case non-hex strings fall back to black.
let ctx: CanvasRenderingContext2D | null | undefined;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** #rgb / #rgba / #rrggbb / #rrggbbaa → RGB (alpha ignored), else null. */
function parseHex(s: string): RGB | null {
	const m = /^#([0-9a-f]{3,8})$/i.exec(s);
	if (!m) return null;
	const h = m[1];
	if (h.length === 3 || h.length === 4) {
		return [
			parseInt(h[0] + h[0], 16) / 255,
			parseInt(h[1] + h[1], 16) / 255,
			parseInt(h[2] + h[2], 16) / 255
		];
	}
	if (h.length === 6 || h.length === 8) {
		return [
			parseInt(h.slice(0, 2), 16) / 255,
			parseInt(h.slice(2, 4), 16) / 255,
			parseInt(h.slice(4, 6), 16) / 255
		];
	}
	return null;
}

/** Normalise via a 2D canvas: assigning an invalid colour leaves fillStyle unchanged,
 *  so two different sentinels detect an unparseable input. Returns null if no DOM. */
function parseViaCanvas(s: string): RGB | null {
	if (ctx === undefined) {
		const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
		ctx = canvas ? canvas.getContext('2d') : null;
	}
	if (!ctx) return null;

	ctx.fillStyle = '#000';
	ctx.fillStyle = s;
	const a = ctx.fillStyle;
	ctx.fillStyle = '#fff';
	ctx.fillStyle = s;
	const b = ctx.fillStyle;
	if (a !== b) return null; // input took neither sentinel → invalid

	const hex = parseHex(a);
	if (hex) return hex;
	// Non-hex normal form is 'rgba(r, g, b, a)' (or 'rgb(r, g, b)').
	const m = /rgba?\(([^)]+)\)/i.exec(a);
	if (m) {
		const parts = m[1].split(',').map((p) => parseFloat(p));
		return [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255];
	}
	return null;
}

function parseString(s: string): RGB {
	const key = s.trim();
	const hit = cache.get(key);
	if (hit) return hit;
	const rgb = parseHex(key) ?? parseViaCanvas(key) ?? [0, 0, 0];
	cache.set(key, rgb);
	return rgb;
}

/** Normalise a `Color` to an `RGB` triple. Arrays pass through untouched (so bloom
 *  values >1 survive); strings are parsed (and memoised). */
export function parseColor(c: Color): RGB {
	return typeof c === 'string' ? parseString(c) : c;
}

/** Like parseColor but clamps to 0..1 — for config colours (background/off) where
 *  bloom is meaningless and out-of-range would misbehave in the shader. */
export function parseColor01(c: Color): RGB {
	const [r, g, b] = parseColor(c);
	return [clamp01(r), clamp01(g), clamp01(b)];
}
