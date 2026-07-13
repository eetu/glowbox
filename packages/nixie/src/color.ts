// Colour handling for @glowbox/nixie — a deliberate vendored copy of
// @glowbox/led-grid's parser (same `Color` contract) so the package stays genuinely
// zero-dep: a display core must not pull in a sibling core for one helper. A `Color` is
// either a numeric RGB triple in 0..1 or any CSS colour string ('#ff8800',
// 'rgb(0 128 255)', 'tomato', 'hsl(...)', …).

export type RGB = [number, number, number];
export type Color = RGB | string;

// Parsed strings are memoised — redraws may pass the same literal over and over, so
// this must be O(1) after the first sighting.
const cache = new Map<string, RGB>();

// A throwaway 2D context normalises any CSS colour the browser understands. Created
// lazily and only when a non-hex string is seen; `null` when there's no DOM (SSR /
// pure-node), in which case non-hex strings fall back to black.
let ctx: CanvasRenderingContext2D | null | undefined;

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

/** Normalise a `Color` to an `RGB` triple. Arrays pass through untouched; strings are
 *  parsed (and memoised). */
export function parseColor(c: Color): RGB {
	return typeof c === 'string' ? parseString(c) : c;
}
