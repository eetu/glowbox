// @glowbox/neon layout — pure text→tube arithmetic, node-testable by design (the
// split-flap `drum.ts` pattern): place stroke-font glyphs on baselines, group their
// centrelines into TUBE SECTIONS (the strike/wear/flicker unit — one electrode pair
// each), and round interior corners so sharp polylines read as bent glass. Grouping
// is behavioural on its own: a 'word' section lights and dies as one tube while its
// glyph strokes stay separate runs. `crossover` makes it electrical too — the section
// is one CIRCUIT, its electrode pair routed to the tube's true ends, with the returns
// between strokes real but painted out behind the sign, invisible by definition.
// ART pieces (the martini glass, the dice, the border ring) place the same way a
// sign maker composes them: anchored to the text block — behind it or beside it —
// never in the line of text.
import { type Color } from './color';
import { type NeonFont, resolveFont } from './font';
import { type GasName } from './gas';
import { pathToStrokes } from './path';

/** One tube section — the unit that strikes, flickers, ages and dies together. */
export interface TubeSection {
	/** Corner-rounded centreline polylines in sign units (y-down, baseline of the
	 *  first text line at y = 0). Under `outline` these are the CONTOUR the tube
	 *  is bent around the letterform, not the letterform itself. */
	strokes: [number, number][][];
	/** Under `outline`: the letterform's own centrelines — what the painted
	 *  `face` slab is stroked from, kept because the tube no longer runs there. */
	skeleton?: [number, number][][];
	/** The line's glyph scale when it differs from 1 (`lineScale`) — the slab
	 *  paint is typography and follows it; the tube's width never does. */
	scale?: number;
	/** The electrode pair: the CIRCUIT's two free ends — the routed bent tube's
	 *  start and finish, each with an outward unit direction for the electrode
	 *  stub. The strokes between them join through invisible painted-out returns
	 *  behind the sign. */
	ends: { x: number; y: number; dx: number; dy: number }[];
	/** 0-based text line the section sits on — per-line colours key off this. */
	line: number;
	/** 0-based WORD the section belongs to, counted across the whole text in
	 *  reading order — the circuit unit `wordOn` switches and `wordColor`
	 *  paints. Absent on art sections. */
	word?: number;
	/** Index into the sign's `art` list when this section is artwork, not text. */
	art?: number;
}

/** A piece of sign artwork: single-stroke path geometry, composed against the
 *  text block the way a sign maker would — behind it or beside it, never inline. */
export interface NeonArt {
	/** The geometry: SVG path data (a `d` string or several) or ready centreline
	 *  polylines. Author CENTRELINES — a filled icon's outline strokes as a
	 *  double-walled silhouette — and put the bends in the path itself (sharp
	 *  corners render as sharp glass; text corners are auto-rounded, art is not). */
	d: string | string[] | [number, number][][];
	/** Where the piece sits relative to the text block (default 'behind'). */
	place?: 'behind' | 'left' | 'right' | 'above' | 'below';
	/** The piece's height as a multiple of the text block's height (defaults:
	 *  behind 1.5, left/right 1, above/below 0.7). */
	size?: number;
	/** Nudge from the anchored position, in text-block heights (y-down). */
	dx?: number;
	dy?: number;
	/** Tilt, degrees clockwise about the piece's centre. */
	rotate?: number;
	/** The piece's own fill (default: the sign's gas / single-colour override —
	 *  per-line colour arrays never bleed onto art). */
	gas?: GasName;
	color?: Color;
	/** The piece's painted face — a wide slab of paint under its tubes that
	 *  catches their light (default: none; the sign's per-line `face` never
	 *  bleeds onto art). */
	face?: Color;
	/** The piece's own discharge direction, overriding the sign's: a white tube
	 *  can shine BLACK ('absorb') on a pale wall while the lettering beside it
	 *  still shines its colour ('emit') — one sign, mixed polarity, because it's
	 *  the ELEMENT that runs dark, not the whole circuit. */
	polarity?: 'emit' | 'absorb';
	/** Sectioning: the whole piece as one tube (default — it strikes, ages and
	 *  dies together) or one tube per subpath. */
	tubes?: 'piece' | 'path';
	/** Treat the piece's coordinates as living in this shared design frame
	 *  ([width, height], origin 0,0) instead of its own bounding box — so several
	 *  pieces cut from ONE drawing (the hair, the face, the jacket, each its own
	 *  colour) keep their registration when given identical placement. */
	frame?: [number, number];
	/** Wired past the flasher cam: the piece holds steady while 'flash'/'chase'
	 *  cycle the rest — the diner border that stays lit around the blinking word
	 *  (default false). */
	steady?: boolean;
	/** A solid face: the piece's CLOSED subpaths cut the tubes of everything
	 *  behind it in z-order (earlier pieces, the text, 'behind' pieces), the way
	 *  a sign maker ends a rear tube shy of a front piece's edge — the classic
	 *  overlapping-dice pair. Cut ends read as the tube diving behind (no
	 *  electrode stub). Default false. */
	opaque?: boolean;
}

/** How glyphs group into sections. 'auto' = the face's own default ('glyph' for
 *  block letters, 'word' for connected script), 'line' = one tube per text line. */
export type TubeGrouping = 'auto' | 'glyph' | 'word' | 'line';

export interface LayoutOptions {
	tubes?: TubeGrouping;
	/** How much glass shares one circuit (default true — how a real sign is
	 *  bent): under `tubes: 'auto'` the sans face wires per WORD instead of per
	 *  glyph, so the whole word is one tube behind one electrode pair, its
	 *  crossover runs painted out behind the sign — invisible — and every
	 *  interior stroke end bare glass diving behind. `false` cuts back to
	 *  channel-letter circuits. Electrode PLACEMENT is not this option's:
	 *  every section's pair always sits on its routed run's two free ends. */
	crossover?: boolean;
	/** Bend the tube around the letterform instead of along it (default false):
	 *  each glyph's tube becomes the CONTOUR of its slab — the border of the
	 *  painted letter — while the centrelines move to `skeleton` for the `face`
	 *  paint. Fat painted typography, a normal-width tube tracing its edge. One
	 *  flag, or one per text line (art follows the single-flag form only). */
	outline?: boolean | boolean[];
	/** Per-line glyph scale (default all 1) — a headline line at twice the size
	 *  of the line under it. The tube keeps its regular width whatever the
	 *  letter size; an outlined line's slab scales with it. */
	lineScale?: number[];
	/** Per-line alignment (default 'center' — signs centre). */
	align?: 'left' | 'center' | 'right';
	/** Baseline-to-baseline advance as a multiple of the face's ascent+descent
	 *  (default 1.1). */
	lineSpacing?: number;
	/** Extra tracking between glyphs as a fraction of cap height (default 0).
	 *  Tracking a script face apart breaks its joins — that's the deal. */
	letterSpacing?: number;
	/** The whole text block's tilt, degrees clockwise about its centre — the
	 *  rising script of the classic window sign (default 0; negative rises
	 *  left-to-right). Art pieces keep their own `rotate` and still anchor to
	 *  the untilted block box. */
	tilt?: number;
	/** Artwork composed against the text block (see `NeonArt`). 'behind' pieces
	 *  render (and strike) before the text; the rest after. */
	art?: NeonArt[];
}

/** A laid-out sign in sign units (y-down): sections plus the full bounds —
 *  text and art — the renderer fits to the canvas. `top` is negative (ascent
 *  above the first baseline); `left` goes negative when art hangs out past the
 *  text block's left edge. */
export interface NeonLayout {
	sections: TubeSection[];
	left: number;
	width: number;
	top: number;
	height: number;
	lines: number;
}

let warnedGlyph = false;

/** Round a polyline's interior corners: each vertex becomes a sampled quadratic
 *  fillet of radius ≤ `r` (clamped to half the shorter adjacent segment), so the
 *  path reads as bent glass, not folded sheet metal. Endpoints are untouched. */
export function roundCorners(stroke: [number, number][], r: number): [number, number][] {
	if (stroke.length < 3 || r <= 0) return stroke;
	const out: [number, number][] = [stroke[0]];
	for (let i = 1; i < stroke.length - 1; i++) {
		const a = stroke[i - 1];
		const b = stroke[i];
		const c = stroke[i + 1];
		const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
		const d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
		const t = Math.min(r, d1 / 2, d2 / 2);
		if (!(t > 0.01)) {
			out.push(b);
			continue;
		}
		// Enter the fillet t before the vertex, leave t after; sample the quadratic
		// with the vertex as control point (collinear points just stay on the line).
		const p1: [number, number] = [b[0] + ((a[0] - b[0]) * t) / d1, b[1] + ((a[1] - b[1]) * t) / d1];
		const p2: [number, number] = [b[0] + ((c[0] - b[0]) * t) / d2, b[1] + ((c[1] - b[1]) * t) / d2];
		out.push(p1);
		for (const u of [0.25, 0.5, 0.75]) {
			const v = 1 - u;
			out.push([
				v * v * p1[0] + 2 * v * u * b[0] + u * u * p2[0],
				v * v * p1[1] + 2 * v * u * b[1] + u * u * p2[1]
			]);
		}
		out.push(p2);
	}
	out.push(stroke[stroke.length - 1]);
	return out;
}

// --- occlusion (`opaque` art) ------------------------------------------------------
// The blockout: how far shy of a front face a cut tube ends, sign units — a bit
// over one tube width, so the rear glass reads as diving cleanly behind.
const BLOCKOUT = 2.4;

// Covered by the face: inside any of its closed loops (union — a die's pips sit
// inside its body anyway), or within `m` of any loop edge.
function covered(px: number, py: number, face: [number, number][][], m: number): boolean {
	const m2 = m * m;
	for (const poly of face) {
		let inside = false;
		for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
			const [xi, yi] = poly[i];
			const [xj, yj] = poly[j];
			const dx = xj - xi;
			const dy = yj - yi;
			const t = Math.max(
				0,
				Math.min(1, ((px - xi) * dx + (py - yi) * dy) / (dx * dx + dy * dy || 1))
			);
			const ex = xi + t * dx - px;
			const ey = yi + t * dy - py;
			if (ex * ex + ey * ey < m2) return true;
			if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
		}
		if (inside) return true;
	}
	return false;
}

// Cut a stroke against a face: densify first (a long straight run must sample the
// face, not just its endpoints), then keep the uncovered runs.
function cutStroke(
	stroke: [number, number][],
	face: [number, number][][],
	m: number
): [number, number][][] {
	const dense: [number, number][] = [stroke[0]];
	for (let i = 1; i < stroke.length; i++) {
		const [ax, ay] = stroke[i - 1];
		const [bx, by] = stroke[i];
		const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5));
		for (let s = 1; s <= steps; s++)
			dense.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps]);
	}
	const out: [number, number][][] = [];
	let run: [number, number][] | null = null;
	for (const p of dense) {
		if (covered(p[0], p[1], face, m)) run = null;
		else if (run) run.push(p);
		else out.push((run = [p]));
	}
	return out.filter((r) => r.length >= 2);
}

// --- crossovers (the invisible returns) ----------------------------------------------
// A real sign is ONE bent tube per circuit: where a stroke ends and the next begins,
// the glass carries on — pushed back off the face plane and dipped in blockout paint,
// invisible against the panel. Nothing of that is drawn (paint done well is exactly
// the part you cannot see); what it changes is the HARDWARE. A wired section carries
// one electrode pair at the circuit's true ends, and every stroke end in between is
// bare glass diving behind — the same cut-end read the `opaque` occlusion uses.

const dist = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Where the bender's tube starts and finishes. Strokes are routed greedily —
 *  finish one glyph before the next (`groups` arrive in reading order), inside a
 *  glyph take the nearest stroke entered by its nearer end — and every opening
 *  move is tried, so a letterform already bent as one continuous run (the N: up
 *  the stem, down the diagonal, up the other stem) routes with no returns at
 *  all. The circuit's two free ends are what the electrodes sit on; nothing
 *  about the drawn glass changes. */
export function circuitEnds(groups: [number, number][][][]): {
	first: [number, number][];
	last: [number, number][];
} {
	let bestFirst: [number, number][] | null = null;
	let bestLast: [number, number][] | null = null;
	let bestCost = Infinity;
	// Openings are per whole circuit: the first glyph's every stroke, both ways
	// round; later glyphs follow greedily from wherever the tube is.
	for (let start = 0; start < groups[0].length; start++) {
		for (const flip of [false, true]) {
			let at: [number, number] | null = null;
			let first: [number, number][] | null = null;
			let last: [number, number][] | null = null;
			let cost = 0;
			for (const group of groups) {
				const left = group.slice();
				let pick: number = at ? -1 : start;
				let pickFlip: boolean = at ? false : flip;
				while (left.length) {
					if (pick < 0) {
						// The nearest remaining stroke, entered by its nearer end.
						let near = Infinity;
						for (let i = 0; i < left.length; i++) {
							const dh = dist(at!, left[i][0]);
							const dl = dist(at!, left[i][left[i].length - 1]);
							if (Math.min(dh, dl) < near) {
								near = Math.min(dh, dl);
								pick = i;
								pickFlip = dl < dh;
							}
						}
					}
					const s = left.splice(pick, 1)[0];
					const run: [number, number][] = pickFlip ? [...s].reverse() : s;
					if (at) cost += dist(at, run[0]);
					first ??= run;
					last = run;
					at = run[run.length - 1];
					pick = -1;
				}
			}
			if (cost < bestCost) {
				bestCost = cost;
				bestFirst = first;
				bestLast = last;
			}
		}
	}
	return { first: bestFirst!, last: bestLast! };
}

// --- outline (the tube bent around the painted letter) -------------------------------
// The slab half-width in sign units (cap height 21): the painted letterform is the
// skeleton stroked this wide each side, and the outline tube runs its contour. One
// constant shared with the renderer, so the border always sits on the paint's edge.
// Sized so the counters survive — the sans E's bars sit ~10 units apart, and a
// fatter slab welds them into a block no outline can save.
export const SLAB_R = 3.1;

const distToStroke = (px: number, py: number, s: [number, number][]): number => {
	let best = Infinity;
	for (let i = 1; i < s.length; i++) {
		const [ax, ay] = s[i - 1];
		const [bx, by] = s[i];
		const dx = bx - ax;
		const dy = by - ay;
		const t = Math.max(
			0,
			Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))
		);
		const ex = ax + t * dx - px;
		const ey = ay + t * dy - py;
		best = Math.min(best, ex * ex + ey * ey);
	}
	return Math.sqrt(best);
};

// One stroke's slab contour at radius R: offset curves both sides, semicircular
// caps at open ends. The skeleton's corners are already filleted, so per-sample
// normals rotate smoothly and a plain perpendicular offset stays a clean curve.
function contourOf(stroke: [number, number][], R: number): [number, number][][] {
	// Densify so the offset follows the fillets.
	const dense: [number, number][] = [stroke[0]];
	for (let i = 1; i < stroke.length; i++) {
		const [ax, ay] = stroke[i - 1];
		const [bx, by] = stroke[i];
		const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.4));
		for (let k = 1; k <= steps; k++)
			dense.push([ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps]);
	}
	const m = dense.length;
	if (m < 2) return [];
	const normal = (i: number): [number, number] => {
		const a = dense[Math.max(0, i - 1)];
		const b = dense[Math.min(m - 1, i + 1)];
		const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
	};
	const left: [number, number][] = [];
	const right: [number, number][] = [];
	for (let i = 0; i < m; i++) {
		const [nx, ny] = normal(i);
		left.push([dense[i][0] + nx * R, dense[i][1] + ny * R]);
		right.push([dense[i][0] - nx * R, dense[i][1] - ny * R]);
	}
	const closed =
		Math.hypot(...([0, 1].map((k) => dense[0][k] - dense[m - 1][k]) as [number, number])) < R * 0.5;
	if (closed) {
		// A closed skeleton's slab is an annulus: outer ring and inner ring, two
		// separate tubes.
		left.push(left[0]);
		right.push(right[0]);
		return [left, right];
	}
	// Open: one stadium with SQUARE-CUT ends — down the left side, around the far
	// cap's two corners, back up the right, around the near cap, home. Panel
	// letters are cut square, so the border tube turns two crisp corners at each
	// terminal instead of a semicircular bulge; the small fillet below is the
	// glass bend a corner really gets.
	const cap = (
		at: [number, number],
		out: [number, number],
		a: [number, number],
		b: [number, number]
	) => {
		const d = Math.hypot(out[0], out[1]) || 1;
		const tx = (out[0] / d) * R;
		const ty = (out[1] / d) * R;
		return [
			[a[0] + tx, a[1] + ty],
			[b[0] + tx, b[1] + ty]
		] as [number, number][];
	};
	const outFar: [number, number] = [
		dense[m - 1][0] - dense[m - 2][0],
		dense[m - 1][1] - dense[m - 2][1]
	];
	const outNear: [number, number] = [dense[0][0] - dense[1][0], dense[0][1] - dense[1][1]];
	const ring: [number, number][] = roundCorners(
		[
			...left,
			...cap(dense[m - 1], outFar, left[m - 1], right[m - 1]),
			...[...right].reverse(),
			...cap(dense[0], outNear, right[0], left[0]),
			left[0]
		],
		R * 0.45
	);
	return [ring];
}

// One glyph's outline: each stroke's contour, cut where it runs inside a SIBLING
// stroke's slab — the union's border emerges without polygon booleans, the same
// coverage-test trick the `opaque` cuts use.
function outlineGlyph(group: [number, number][][], R: number): [number, number][][] {
	const out: [number, number][][] = [];
	for (let gi = 0; gi < group.length; gi++) {
		const siblings = group.filter((_, i) => i !== gi);
		for (const loop of contourOf(group[gi], R)) {
			if (!siblings.length) {
				out.push(loop);
				continue;
			}
			let run: [number, number][] | null = null;
			for (const p of loop) {
				const inside = siblings.some((s) => distToStroke(p[0], p[1], s) < R * 0.98);
				if (inside) run = null;
				else if (run) run.push(p);
				else out.push((run = [p]));
			}
		}
	}
	// A sliver of contour left at a junction's tangent point is not a tube anyone
	// would bend — the cut swallows it.
	const runLen = (r: [number, number][]) =>
		r.reduce((a, p, k) => (k ? a + Math.hypot(p[0] - r[k - 1][0], p[1] - r[k - 1][1]) : 0), 0);
	return out.filter((r) => r.length >= 2 && runLen(r) > R * 0.8);
}

// The outward tangent at a stroke end — where the electrode stub points.
function endOf(stroke: [number, number][], last: boolean): TubeSection['ends'][number] {
	const p = stroke[last ? stroke.length - 1 : 0];
	const q = stroke.length > 1 ? stroke[last ? stroke.length - 2 : 1] : null;
	let dx = 0;
	let dy = -1;
	if (q) {
		const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
		if (d > 0) {
			dx = (p[0] - q[0]) / d;
			dy = (p[1] - q[1]) / d;
		}
	}
	return { x: p[0], y: p[1], dx, dy };
}

/** Lay `text` out as tube sections in sign units. `\n` splits lines; glyphs the
 *  face doesn't carry are skipped (one dev warning). Also the "extrude it
 *  yourself" seam: the same sections a 3D consumer would bend into real tube
 *  geometry — pair with the face metrics (cap height 21 for the built-ins). */
export function layoutTubes(
	text: string,
	font: 'script' | 'sans' | NeonFont = 'script',
	opts: LayoutOptions = {}
): NeonLayout {
	const f = resolveFont(font);
	const crossover = opts.crossover ?? true;
	const outline = opts.outline ?? false;
	// Whether THIS section's tube borders its letterform: per line for text, and
	// art only under the single-flag form.
	const outlined = (line: number, isArt: boolean): boolean =>
		Array.isArray(outline) ? !isArt && (outline[line % outline.length] ?? false) : outline;
	const grouping: TubeGrouping = opts.tubes ?? 'auto';
	// A wired sign is circuits, and a circuit of one glyph is no circuit — so
	// crossover resolves the auto grouping to 'word' where a face would default
	// to per-glyph tubes. Naming `tubes` yourself still wins.
	const group = grouping === 'auto' ? (crossover ? 'word' : (f.grouping ?? 'glyph')) : grouping;
	const align = opts.align ?? 'center';
	const spacing = Math.max(0.5, opts.lineSpacing ?? 1.1);
	const track = (opts.letterSpacing ?? 0) * f.capHeight;
	// The bend radius: generous enough to read as glass at any size, small enough
	// to keep counters open — scaled to the face so custom fonts bend in proportion.
	const bendR = f.capHeight * 0.12;

	const lines = text.split(/\r?\n/);
	const sections: TubeSection[] = [];
	// Per-line glyph scale: a headline line at twice the size of the one under
	// it. The tube stays its regular width (glass is glass whatever the letter),
	// so a scaled line simply carries more letter per tube.
	const scaleOf = (li: number): number => {
		const s = opts.lineScale?.[li % Math.max(1, opts.lineScale?.length ?? 1)] ?? 1;
		return s > 0 ? s : 1;
	};
	// Baselines advance by what actually sits between them: the upper line's
	// descent and the lower line's ascent, each at its own size.
	const baseYs: number[] = [0];
	for (let li = 1; li < lines.length; li++)
		baseYs.push(baseYs[li - 1] + (f.descent * scaleOf(li - 1) + f.ascent * scaleOf(li)) * spacing);

	// One section = one circuit = one bent tube, whatever `crossover` grouped into
	// it — so its electrode pair ALWAYS sits on the routed run's two free ends
	// (stroke data arrives in font/author order, which is no place to hang
	// hardware), and every joint in between is glass the invisible painted-out
	// return hides, not a place to put a stub.
	const section = (
		groups: [number, number][][][],
		line: number,
		word?: number,
		art?: number
	): TubeSection => {
		// Outlined glass: the tube is bent around each glyph's slab, and the
		// letterform's own centrelines move to the skeleton for the face paint.
		// The slab is typography, so it scales with its line.
		let skeleton: [number, number][][] | undefined;
		const s = art != null ? 1 : scaleOf(line);
		if (outlined(line, art != null)) {
			skeleton = groups.flat();
			groups = groups.map((g) => outlineGlyph(g, SLAB_R * s));
		}
		const flat = groups.flat();
		let ends: TubeSection['ends'];
		if (flat.length > 1) {
			const { first, last } = circuitEnds(groups);
			ends = [endOf(first, false), endOf(last, true)];
		} else {
			ends = [endOf(flat[0], false), endOf(flat[0], true)];
		}
		const sec: TubeSection = { strokes: flat, ends, line };
		if (skeleton) sec.skeleton = skeleton;
		if (s !== 1) sec.scale = s;
		if (word != null) sec.word = word;
		if (art != null) sec.art = art;
		return sec;
	};

	// Measure first (alignment needs the widest line), then place.
	const measure = (line: string, s: number): number => {
		let wsum = 0;
		let n = 0;
		for (const ch of line) {
			const g = f.glyphs[ch];
			if (!g) continue;
			wsum += g.adv;
			n++;
		}
		return (wsum + Math.max(0, n - 1) * track) * s;
	};
	const widths = lines.map((line, li) => measure(line, scaleOf(li)));
	const width = Math.max(0, ...widths);

	// Words count across the whole text in reading order, so `wordOn` and
	// `wordColor` can address one word's circuit among its neighbours. A 'line'
	// section spans words and takes its first one's index.
	let wordIdx = 0;
	let inWord = false;
	const endWord = () => {
		if (inWord) {
			wordIdx++;
			inWord = false;
		}
	};
	for (let li = 0; li < lines.length; li++) {
		const baseY = baseYs[li];
		const s = scaleOf(li);
		let x =
			align === 'left' ? 0 : align === 'right' ? width - widths[li] : (width - widths[li]) / 2;
		// A pending section accumulates glyphs — one group of strokes each, in
		// reading order — until the grouping closes it.
		let open: [number, number][][][] | null = null;
		let openWord = 0;
		const close = () => {
			if (!open || !open.length) {
				open = null;
				return;
			}
			sections.push(section(open, li, openWord));
			open = null;
		};
		for (const ch of lines[li]) {
			const g = f.glyphs[ch];
			if (!g) {
				if (!warnedGlyph) {
					warnedGlyph = true;
					console.warn(
						`glowbox: no '${ch}' tube in this neon face — skipped. The vendored Hershey faces cover printable ASCII; pass a custom NeonFont for more.`
					);
				}
				continue;
			}
			if (g.strokes.length === 0) {
				// A space: no glass — the word gap, so 'word' grouping closes here.
				if (group === 'word') close();
				endWord();
			} else {
				const placed = g.strokes.map((st) =>
					roundCorners(
						st.map(([gx, gy]) => [gx * s + x, gy * s + baseY] as [number, number]),
						bendR * s
					)
				);
				if (!inWord) inWord = true;
				if (group === 'glyph') {
					sections.push(section([placed], li, wordIdx));
				} else {
					if (!open) openWord = wordIdx;
					(open ??= []).push(placed);
				}
			}
			x += (g.adv + track) * s;
		}
		close(); // 'word' flushes the last word; 'line' flushes the whole line
		endWord();
	}

	const blockTop = -f.ascent * scaleOf(0);
	const blockH = baseYs[baseYs.length - 1] + f.descent * scaleOf(lines.length - 1) - blockTop;
	let left = 0;
	let right = width;
	let topAll = blockTop;
	let botAll = blockTop + blockH;

	// --- the block tilt: the whole word rides a rising diagonal ---------------------
	const tilt = ((opts.tilt ?? 0) * Math.PI) / 180;
	if (tilt) {
		const cos = Math.cos(tilt);
		const sin = Math.sin(tilt);
		const cx = width / 2;
		const cy = blockTop + blockH / 2;
		const rot = ([x, y]: [number, number]): [number, number] => [
			cx + (x - cx) * cos - (y - cy) * sin,
			cy + (x - cx) * sin + (y - cy) * cos
		];
		for (const sec of sections) {
			sec.strokes = sec.strokes.map((s) => s.map(rot));
			if (sec.skeleton) sec.skeleton = sec.skeleton.map((s) => s.map(rot));
			// The electrodes are hardware on the glass: they ride the rotation, they
			// are not re-picked by it.
			sec.ends = sec.ends.map((e) => {
				const [x, y] = rot([e.x, e.y]);
				return { x, y, dx: e.dx * cos - e.dy * sin, dy: e.dx * sin + e.dy * cos };
			});
		}
		// Bounds follow the rotated block box; art keeps anchoring to the untilted one.
		left = Infinity;
		right = -Infinity;
		topAll = Infinity;
		botAll = -Infinity;
		for (const corner of [
			[0, blockTop],
			[width, blockTop],
			[width, blockTop + blockH],
			[0, blockTop + blockH]
		] as [number, number][]) {
			const [x, y] = rot(corner);
			left = Math.min(left, x);
			right = Math.max(right, x);
			topAll = Math.min(topAll, y);
			botAll = Math.max(botAll, y);
		}
	}

	// --- artwork, anchored to the text block --------------------------------------

	const behind: TubeSection[] = [];
	const faces: { ai: number; face: [number, number][][] }[] = []; // opaque pieces' closed loops
	for (let ai = 0; ai < (opts.art?.length ?? 0); ai++) {
		const a = opts.art![ai];
		const raw =
			typeof a.d === 'string' || typeof a.d[0] === 'string'
				? pathToStrokes(a.d as string | string[])
				: (a.d as [number, number][][]);
		if (!raw.length) continue;
		let lo = Infinity;
		let hi = -Infinity;
		let lov = Infinity;
		let hiv = -Infinity;
		for (const s of raw)
			for (const [x, y] of s) {
				lo = Math.min(lo, x);
				hi = Math.max(hi, x);
				lov = Math.min(lov, y);
				hiv = Math.max(hiv, y);
			}
		if (a.frame) {
			// A shared design frame overrides the piece's own bbox, so sibling
			// pieces cut from one drawing keep their registration.
			lo = 0;
			lov = 0;
			hi = Math.max(1e-6, a.frame[0]);
			hiv = Math.max(1e-6, a.frame[1]);
		}
		const place = a.place ?? 'behind';
		const size =
			a.size ?? (place === 'behind' ? 1.5 : place === 'left' || place === 'right' ? 1 : 0.7);
		const bw = Math.max(1e-6, hi - lo);
		const bh = Math.max(1e-6, hiv - lov);
		const k = (size * blockH) / bh;
		const gap = blockH * 0.35; // breathing room between the text box and a side piece
		let cx = width / 2;
		let cy = blockTop + blockH / 2;
		if (place === 'left') cx = -gap - (bw * k) / 2;
		else if (place === 'right') cx = width + gap + (bw * k) / 2;
		else if (place === 'above') cy = blockTop - gap - (bh * k) / 2;
		else if (place === 'below') cy = blockTop + blockH + gap + (bh * k) / 2;
		cx += (a.dx ?? 0) * blockH;
		cy += (a.dy ?? 0) * blockH;
		const rot = ((a.rotate ?? 0) * Math.PI) / 180;
		const cos = Math.cos(rot);
		const sin = Math.sin(rot);
		const scx = (lo + hi) / 2;
		const scy = (lov + hiv) / 2;
		const placed = raw.map((s) =>
			s.map(([x, y]): [number, number] => {
				const px = (x - scx) * k;
				const py = (y - scy) * k;
				return [cx + px * cos - py * sin, cy + px * sin + py * cos];
			})
		);
		for (const s of placed)
			for (const [x, y] of s) {
				left = Math.min(left, x);
				right = Math.max(right, x);
				topAll = Math.min(topAll, y);
				botAll = Math.max(botAll, y);
			}
		// A piece has no baseline to run a rail under, so its crossovers hop direct.
		const mk = (strokes: [number, number][][]): TubeSection => section([strokes], 0, undefined, ai);
		const secs = a.tubes === 'path' ? placed.map((s) => mk([s])) : [mk(placed)];
		// Z-order = section order = 'reveal' strike order: backdrop pieces first
		// (the border ring lights, then the word), side pieces after the text.
		if (place === 'behind') behind.push(...secs);
		else sections.push(...secs);
		if (a.opaque) {
			const face = placed.filter((s) => {
				const f = s[0];
				const l = s[s.length - 1];
				return Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6; // closed loops only
			});
			if (face.length) faces.push({ ai, face });
		}
	}
	if (behind.length) sections.unshift(...behind);

	// `opaque` faces cut every tube behind them in z-order — the overlapping-dice
	// pair: the rear die's runs end shy of the front die's edge. An end left
	// within the blockout of a face is a dive-behind, not an electrode.
	if (faces.length) {
		const cutBy = faces.map(({ ai, face }) => ({
			face,
			idx: sections.findIndex((s) => s.art === ai)
		}));
		for (let j = 0; j < sections.length; j++) {
			const applicable = cutBy.filter((f) => j < f.idx);
			if (!applicable.length) continue;
			const sec = sections[j];
			for (const f of applicable) {
				sec.strokes = sec.strokes.flatMap((s) => cutStroke(s, f.face, BLOCKOUT));
				// The paint under an outlined tube is cut by the same front face.
				if (sec.skeleton)
					sec.skeleton = sec.skeleton.flatMap((s) => cutStroke(s, f.face, BLOCKOUT));
			}
			if (!sec.strokes.length) continue;
			// The routed circuit ends are real hardware wherever the glass got cut —
			// they only go when the face covers them, and then the end is a
			// dive-behind, not an electrode.
			sec.ends = sec.ends.filter(
				(e) => !applicable.some((f) => covered(e.x, e.y, f.face, BLOCKOUT + 1.5))
			);
		}
		// A fully covered tube is no tube.
		for (let j = sections.length - 1; j >= 0; j--)
			if (!sections[j].strokes.length) sections.splice(j, 1);
	}

	return {
		sections,
		left,
		width: right - left,
		top: topAll,
		height: botAll - topAll,
		lines: lines.length
	};
}
