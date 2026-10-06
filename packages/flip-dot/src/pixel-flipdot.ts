// The board as data at whole-pixel scale, for a game painting it into its own low-resolution
// raster. Geometry stays apart from physics: `flipDotPixels` lays the dots out once,
// `flipFrames` draws one dot at each step of its flip, and `flipPhases` says where every dot is
// in its flip at a moment: the scan wave, each solenoid's jitter and the rule that a disc
// finishes its last flip first, as a function of the frames shown, the time and a seed. A disc
// is paint, so the faces' colours are the game's. `flipLandings` says when discs hit their
// stops, which is when the board clicks.
import type { FlipDotShape, FlipDotStagger } from './flip-dot';
import type { PixelLayout, PixelPart, PixelRect } from './pixel';
import { maskRects } from './pixel-stroke';

export interface FlipPixelOptions {
	cols: number;
	rows: number;
	/** Dot diameter, px: round from 3, a square at 1–2. */
	dot: number;
	/** Pixels between dots. Default 1. */
	gap?: number;
	/** 'disc' (default) or 'square', the octagonal vane. */
	shape?: FlipDotShape;
}

/** One dot: its column and row, its box's top-left, and its face as rects. */
export interface FlipDotPart extends PixelPart {
	col: number;
	row: number;
	/** Where the dot's box starts: `flipFrames` rects are drawn from here. */
	x: number;
	y: number;
}

export interface FlipFrameOptions {
	/** 'disc' (default) or 'square', the octagonal vane. */
	shape?: FlipDotShape;
	/** Pivot axis in degrees, the canvas board's `axis` (default 135). */
	axis?: number;
}

/** One step of a flip, as the rects each colour covers, from the dot's top-left. What none
 *  covers shows the board behind. */
export interface FlipFrame {
	/** Showing face A, the face at phase 0. */
	a: PixelRect[];
	/** Showing face B, the face at phase 1. */
	b: PixelRect[];
	/** The disc edge-on, a sliver along the axis: the rim's colour, or the board's to leave
	 *  the socket empty for that instant, as the flat canvas board does. */
	edge: PixelRect[];
}

/** A frame the board was given at `t` seconds: row-major, non-zero for face B. */
export interface FlipChange {
	t: number;
	frame: ArrayLike<number>;
}

export interface FlipTiming {
	cols: number;
	rows: number;
	/** The board: each solenoid's jitter and the 'random' scatter follow it. Default 0. */
	seed?: number;
	/** 'scan' (default) sweeps rows top to bottom, 'random' scatters, 'none' flips at once. */
	stagger?: FlipDotStagger;
	/** Total stagger spread, ms (default 150). */
	scanMs?: number;
	/** One disc's flip, ms (default 70; 0 = instant). */
	flipMs?: number;
}

/** A disc hitting its stop: which dot, and when, in seconds. */
export interface FlipLanding {
	index: number;
	col: number;
	row: number;
	t: number;
}

type Mask = Uint8Array;

// The octagon's corners clip at this fraction of the half-width, as on the canvas vane.
const CLIP = 0.42;

/** Whether a point (pixel units from the dot's centre) is on the dot's face. A pixel is in
 *  when its centre is: a disc shrinks by about an eighth of a pixel so a 3 px disc is a plus,
 *  not a square. */
const insideOf = (dot: number, shape: FlipDotShape) => {
	const r = dot / 2;
	if (dot <= 2) return (x: number, y: number) => Math.abs(x) < r && Math.abs(y) < r;
	if (shape === 'square')
		return (x: number, y: number) =>
			Math.abs(x) <= r && Math.abs(y) <= r && Math.abs(x) + Math.abs(y) <= (2 - CLIP) * r;
	const r2 = r * r - r / 4;
	return (x: number, y: number) => x * x + y * y <= r2;
};

const maskOf = (dot: number, test: (x: number, y: number) => boolean): Mask => {
	const m = new Uint8Array(dot * dot);
	for (let y = 0; y < dot; y++)
		for (let x = 0; x < dot; x++)
			if (test(x + 0.5 - dot / 2, y + 0.5 - dot / 2)) m[y * dot + x] = 1;
	return m;
};

const sizeOf = (dot: number) => Math.max(1, Math.round(dot));

/** The dot at rest, from its box's top-left. */
const restRects = (dot: number, shape: FlipDotShape) =>
	maskRects(maskOf(dot, insideOf(dot, shape)), dot, dot);

/**
 * The board laid out on whole pixels: each dot a part `{ col, row, x, y, rects }`, row-major,
 * so `parts[i]` goes with `flipPhases(...)[i]`. `rects` is the face at rest (a round mask from 3 px,
 * a square at 1–2, the vane an octagon); a dot mid-flip is `flipFrames` drawn from `x, y`.
 * Dots are `dot + gap` apart, the layout as wide as the dots and the gaps between them.
 */
export function flipDotPixels(options: FlipPixelOptions): PixelLayout<FlipDotPart> {
	const { shape = 'disc' } = options;
	const cols = Math.max(1, Math.floor(options.cols));
	const rows = Math.max(1, Math.floor(options.rows));
	const dot = sizeOf(options.dot);
	const gap = Math.max(0, Math.round(options.gap ?? 1));
	const face = restRects(dot, shape);
	const pitch = dot + gap;
	const parts: FlipDotPart[] = [];
	for (let row = 0; row < rows; row++)
		for (let col = 0; col < cols; col++) {
			const x = col * pitch;
			const y = row * pitch;
			parts.push({ col, row, x, y, rects: face.map((r) => ({ ...r, x: x + r.x, y: y + r.y })) });
		}
	return { width: cols * pitch - gap, height: rows * pitch - gap, parts };
}

/**
 * One dot's flip in `4 · dot` steps, face A to face B: frame `i` is phase `i / (length − 1)`,
 * so a dot at phase `p` is `frames[Math.round(p * (frames.length - 1))]`. The disc turns about
 * its axis, foreshortening across it to the edge and opening on the other face; the vane is
 * one triangular flap folding across the hinge over two painted halves, so mid-fold it shows
 * both faces. The middle frame is the edge.
 */
export function flipFrames(
	dot: number,
	{ shape = 'disc', axis = 135 }: FlipFrameOptions = {}
): FlipFrame[] {
	dot = sizeOf(dot);
	const n = dot * dot;
	const inside = insideOf(dot, shape);
	const rest = maskOf(dot, inside);
	// The axis and its normal, rounded so 0°, 90° and 180° land exactly on the grid.
	const rad = (axis * Math.PI) / 180;
	const ux = Math.round(Math.cos(rad) * 1e9) / 1e9;
	const uy = Math.round(Math.sin(rad) * 1e9) / 1e9;
	const vx = -uy;
	const vy = ux;
	// The hinge, or the edge-on disc: a 1 px line along the axis through the centre, one pixel
	// to each column or row (whichever it runs along), on the face. Half-open, so an even dot
	// on a square axis takes the row or column before the centre, not both.
	const half = Math.max(Math.abs(ux), Math.abs(uy)) / 2;
	const hinge = maskOf(dot, (x, y) => {
		const d = x * vx + y * vy;
		return d >= -half && d < half && inside(x, y);
	});
	// Which side of the hinge each pixel is on: +1 holds face A's half of the vane.
	const side = maskOf(dot, (x, y) => x * vx + y * vy >= 0);
	// The face squashed to `ak` across the axis: a pixel is on it when the point it came from
	// is on the face, and the hinge line always is.
	const squashed = (ak: number) => {
		const m = maskOf(dot, (x, y) => {
			const a = x * ux + y * uy;
			const b = (x * vx + y * vy) / ak;
			return inside(a * ux + b * vx, a * uy + b * vy);
		});
		for (let i = 0; i < n; i++) m[i] |= hinge[i];
		return m;
	};
	const rects = (test: (i: number) => unknown) => {
		const m = new Uint8Array(n);
		for (let i = 0; i < n; i++) if (test(i)) m[i] = 1;
		return maskRects(m, dot, dot);
	};
	const frame = (k: number): FlipFrame => {
		const ak = Math.abs(k);
		const edge = ak * dot < 1;
		if (shape !== 'square') {
			if (edge) return { a: [], b: [], edge: rects((i) => hinge[i]) };
			const disc = squashed(ak);
			const face = rects((i) => disc[i]);
			return k > 0 ? { a: face, b: [], edge: [] } : { a: [], b: face, edge: [] };
		}
		// Face A up, the flap lies over face B's half; face B up, it has folded onto A's.
		const halfA = (i: number) => rest[i] && !hinge[i] && side[i];
		const halfB = (i: number) => rest[i] && !hinge[i] && !side[i];
		if (edge) return { a: rects(halfA), b: rects(halfB), edge: rects((i) => hinge[i]) };
		const flap = squashed(ak);
		if (k > 0)
			return {
				a: rects((i) => halfA(i) || hinge[i] || (halfB(i) && flap[i])),
				b: rects((i) => halfB(i) && !flap[i]),
				edge: []
			};
		return {
			a: rects((i) => halfA(i) && !flap[i]),
			b: rects((i) => halfB(i) || hinge[i] || (halfA(i) && flap[i])),
			edge: []
		};
	};
	const steps = 4 * dot;
	return Array.from({ length: steps + 1 }, (_, i) => frame(Math.cos((i / steps) * Math.PI)));
}

// A seeded hash to 0..1 (wear's): the same dot on the same board always has the same jitter.
const unit = (a: number, b: number, c: number): number => {
	let h =
		Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** The last change at or before `t`, or −1. */
const lastAt = (changes: readonly FlipChange[], t: number) => {
	let lo = 0;
	let hi = changes.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (changes[mid].t <= t) lo = mid + 1;
		else hi = mid;
	}
	return lo - 1;
};

const timingOf = (o: FlipTiming) => {
	const { seed = 0, scanMs = 150, flipMs = 70 } = o;
	const cols = Math.max(1, Math.floor(o.cols));
	const rows = Math.max(1, Math.floor(o.rows));
	// An instant board has no sweep either, as on the canvas.
	const stagger: FlipDotStagger = flipMs > 0 ? (o.stagger ?? 'scan') : 'none';
	return {
		cols,
		rows,
		n: cols * rows,
		s: Math.round(seed * 1000),
		stagger,
		scan: scanMs / 1000,
		flip: Math.max(0, flipMs) / 1000
	};
};

type Timing = ReturnType<typeof timingOf>;

/**
 * Dot `i`'s phase at `t`, the canvas board's flip in closed form. A change that flips the dot
 * starts it after its stagger delay; until then it carries on toward the face it was last
 * sent to, so a disc caught mid-flip finishes that flip first, and a change that comes before
 * the last one started starts the last one. So the dot heads for each face it is given from
 * the earlier of that flip's start and the next change's arrival, at its own speed, and comes
 * to rest there. Only the changes since it last rested are read: the walk goes back through
 * them to a moment it was at rest, then forward. `land` hears every arrival after `from`.
 */
const phaseOf = (
	changes: readonly FlipChange[],
	m: number,
	i: number,
	t: number,
	tm: Timing,
	from = Infinity,
	land?: (at: number) => void
): number => {
	const jit = unit(tm.s, 2 * i, 0);
	const dur = tm.flip * (0.85 + 0.3 * jit);
	const scan = (Math.floor(i / tm.cols) / Math.max(1, tm.rows - 1)) * tm.scan + jit * 0.014;
	const most = tm.stagger === 'scan' ? scan : tm.stagger === 'random' ? tm.scan : 0;
	const delay = (j: number) =>
		tm.stagger === 'scan'
			? scan
			: tm.stagger === 'random'
				? unit(tm.s, 2 * i + 1, Math.round(changes[j].t * 1000)) * tm.scan
				: 0;
	const bit = (j: number) => (j >= 0 && changes[j].frame[i] ? 1 : 0);
	// Back from `t`: k is a change that flipped the dot (m + 1 stands for `t`), ek when it
	// started heading there. Before ek the dot heads for bit(k − 1).
	let k = m + 1;
	let ek = t;
	const flips: number[] = [];
	const starts: number[] = [];
	for (;;) {
		const lim = Math.min(ek, from);
		let j = k - 1;
		let rested = false;
		for (; j >= 0; j--) {
			// Any earlier flip had started by changes[j].t + most and arrived a flip later.
			if (changes[j].t + most + dur <= lim) {
				rested = true;
				break;
			}
			if (bit(j) !== bit(j - 1)) break;
		}
		if (rested || j < 0) break;
		const ej = Math.min(changes[j].t + delay(j), k <= m ? changes[k].t : Infinity, t);
		if (ej + dur <= lim) break;
		flips.push(j);
		starts.push(ej);
		k = j;
		ek = ej;
	}
	let p = bit(k - 1);
	for (let s = flips.length - 1; s >= 0; s--) {
		const v = bit(flips[s]);
		if (p === v) continue;
		const e = starts[s];
		const end = s > 0 ? starts[s - 1] : t;
		const need = Math.abs(v - p) * dur;
		if (end - e >= need) {
			land?.(e + need);
			p = v;
		} else p += (Math.sign(v - p) * (end - e)) / dur;
	}
	return p;
};

/**
 * Every dot's flip phase at `t` seconds, into `out`: 0 showing face A, 1 face B, between them
 * mid-flip (pick the frame with `flipFrames`). `changes` is the frames the board was given,
 * in time order; before the first every dot shows face A, so a first change put a moment in
 * the past starts the board at rest on it. A change sweeps the board as the canvas board's
 * does: a dot starts after `(row / (rows − 1)) · scanMs + jitter · 14 ms` ('scan'), and turns
 * over in `flipMs · (0.85 + 0.3 · jitter)`, its jitter a hash of the seed and the dot. The
 * same changes, `t` and seed give the same phases, at any frame rate.
 */
export function flipPhases(
	changes: readonly FlipChange[],
	t: number,
	timing: FlipTiming,
	out: Float32Array = new Float32Array(
		Math.max(1, Math.floor(timing.cols)) * Math.max(1, Math.floor(timing.rows))
	)
): Float32Array {
	const tm = timingOf(timing);
	const m = lastAt(changes, t);
	for (let i = 0; i < tm.n; i++) out[i] = phaseOf(changes, m, i, t, tm);
	return out;
}

/**
 * The discs that hit their stops after `from` and by `to`, in time order: the moments the
 * board clicks. Call it with each frame's window and play a `createMechSound` tick per
 * landing, or a few: a full sweep lands every changed dot within `scanMs`.
 */
export function flipLandings(
	changes: readonly FlipChange[],
	from: number,
	to: number,
	timing: FlipTiming
): FlipLanding[] {
	const tm = timingOf(timing);
	const out: FlipLanding[] = [];
	if (!(to > from)) return out;
	const m = lastAt(changes, to);
	for (let i = 0; i < tm.n; i++)
		phaseOf(changes, m, i, to, tm, from, (at) => {
			if (at > from) out.push({ index: i, col: i % tm.cols, row: Math.floor(i / tm.cols), t: at });
		});
	return out.sort((p, q) => p.t - q.t);
}
