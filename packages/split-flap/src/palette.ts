// Chroma drums. Real installations carry drums of solid-colour flaps and use a
// wall of modules as a (very) low-res image display — the picture assembles as a
// thousand cards clack into place. In this core a drum stays a charset (one
// grapheme per flap); the `palette` option names which flaps are paint rather
// than print, and this file maps RGB pixels onto those flaps. Pure and
// node-testable, like `dither.ts` on the flip-dot board.
import { type Color, parseColor, type RGB } from './color';

export interface ChromaDrumOptions {
	/** Hue steps around the wheel (default 12 — a flap every 30°; 0 makes a
	 *  monochrome drum: blank + the grey ramp only). */
	hues?: number;
	/** Lightness levels per hue (default 3). */
	shades?: number;
	/** Grey-ramp flaps between the dark blank and white (default 6). */
	grays?: number;
}

// Standard HSL→RGB; local so generated drums are identical in node and browser
// (the vendored parser needs a live canvas for hsl() strings).
const hsl = (h: number, s: number, l: number): RGB => {
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [f(0), f(8), f(4)];
};

/** Generate a full-chroma image drum, the way the real installations card
 *  theirs: a grey ramp out of the dark blank flap up to white, then the whole
 *  hue ring with its lightness shades laid serpentine — neighbouring colours
 *  are neighbouring flaps in BOTH hue and lightness, so a gradient or a hue
 *  shift is a couple of flips, and only a full complement change pays a wrap.
 *  Default 43 flaps (blank + 6 greys + 12 hues × 3 shades). Returns
 *  `{ charset, palette }`, ready to hand to `createSplitFlap`. */
export function chromaDrum(opts: ChromaDrumOptions = {}): {
	charset: string;
	palette: Record<string, Color>;
} {
	const hues = Math.max(0, Math.round(opts.hues ?? 12));
	const shades = Math.max(1, Math.round(opts.shades ?? 3));
	const grays = Math.max(2, Math.round(opts.grays ?? 6));
	const POOL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const palette: Record<string, Color> = { ' ': [0.09, 0.09, 0.11] };
	let charset = ' ';
	let at = 0;
	const flap = (c: RGB) => {
		// Past the pool, keep minting printable code points (Latin-1 letters on) —
		// the graphemes are addresses, not text.
		const ch = at < POOL.length ? POOL[at] : String.fromCharCode(0xc0 + (at - POOL.length));
		at++;
		charset += ch;
		palette[ch] = c;
	};
	for (let i = 0; i < grays; i++) {
		const l = 0.18 + (0.95 - 0.18) * (i / (grays - 1));
		flap([l, l, l]);
	}
	for (let h = 0; h < hues; h++)
		for (let s = 0; s < shades; s++) {
			// Serpentine: down one hue's shades, back up the next hue's.
			const step = h % 2 ? shades - 1 - s : s;
			const l = shades === 1 ? 0.5 : 0.68 - (0.38 * step) / (shades - 1);
			flap(hsl((h * 360) / hues, 0.62, l));
		}
	return { charset, palette };
}

export interface PaletteFrameOptions {
	/** 'floyd' diffuses the quantisation error (serpentine Floyd–Steinberg) —
	 *  smoother gradients, busier board. Default 'none': the hard
	 *  nearest-colour cut, the blocky look the boards are loved for. */
	dither?: 'none' | 'floyd';
}

/** Map a row-major RGB grid (r,g,b triplets 0..1, y-down) onto palette flaps:
 *  each pixel becomes the drum's nearest colour, weighted for the eye (greens
 *  count more than blues). Include the blank flap's card colour in the palette
 *  so dark pixels rest as blanks. Returns one string per row, ready for
 *  `setText`. */
export function paletteFrame(
	rgb: ArrayLike<number>,
	cols: number,
	rows: number,
	palette: Record<string, Color>,
	opts: PaletteFrameOptions = {}
): string[] {
	const chars: string[] = [];
	const paints: RGB[] = [];
	for (const [ch, c] of Object.entries(palette)) {
		chars.push(ch);
		paints.push(parseColor(c));
	}
	if (chars.length === 0) return Array.from({ length: rows }, () => ' '.repeat(cols));
	const n = cols * rows;
	const buf = new Float32Array(n * 3);
	for (let i = 0; i < n * 3; i++) {
		const v = Number(rgb[i]);
		buf[i] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
	}
	const nearest = (r: number, g: number, b: number): number => {
		let best = 0;
		let bd = Infinity;
		for (let p = 0; p < paints.length; p++) {
			const dr = r - paints[p][0];
			const dg = g - paints[p][1];
			const db = b - paints[p][2];
			const d = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
			if (d < bd) {
				bd = d;
				best = p;
			}
		}
		return best;
	};
	const pick = new Int32Array(n);
	const floyd = opts.dither === 'floyd';
	for (let y = 0; y < rows; y++) {
		// Serpentine: alternate scan direction so diffusion artefacts don't comb.
		const ltr = !floyd || y % 2 === 0;
		for (let i = 0; i < cols; i++) {
			const x = ltr ? i : cols - 1 - i;
			const at = (y * cols + x) * 3;
			const p = nearest(buf[at], buf[at + 1], buf[at + 2]);
			pick[y * cols + x] = p;
			if (!floyd) continue;
			const spread = (dx: number, dy: number, w: number) => {
				const nx = x + (ltr ? dx : -dx);
				const ny = y + dy;
				if (nx < 0 || nx >= cols || ny >= rows) return;
				const to = (ny * cols + nx) * 3;
				for (let c = 0; c < 3; c++)
					buf[to + c] = Math.max(0, Math.min(1, buf[to + c] + (buf[at + c] - paints[p][c]) * w));
			};
			spread(1, 0, 7 / 16);
			spread(-1, 1, 3 / 16);
			spread(0, 1, 5 / 16);
			spread(1, 1, 1 / 16);
		}
	}
	return Array.from({ length: rows }, (_, y) => {
		let line = '';
		for (let x = 0; x < cols; x++) line += chars[pick[y * cols + x]];
		return line;
	});
}
