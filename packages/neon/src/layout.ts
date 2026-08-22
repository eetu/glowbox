// @glowbox/neon layout — pure text→tube arithmetic, node-testable by design (the
// split-flap `drum.ts` pattern): place stroke-font glyphs on baselines, group their
// centrelines into TUBE SECTIONS (the strike/wear/flicker unit — one electrode pair
// each), and round interior corners so sharp polylines read as bent glass. Grouping
// is behavioural on its own: a 'word' section lights and dies as one tube while its
// glyph strokes stay separate runs. `crossover` makes it geometric too — the strokes
// are threaded onto one continuous tube and the hops between them come back as
// BLOCKOUT runs, the coated glass a real sign carries between its letters.
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
	 *  first text line at y = 0). */
	strokes: [number, number][][];
	/** Per-stroke: this run is BLOCKOUT — glass the sign maker coated so it carries
	 *  the discharge without showing it (the crossover from one stroke to the next,
	 *  bent back off the face plane and painted). Absent = every run is lit glass. */
	painted?: boolean[];
	/** The electrode pair: the free ends of the section's first and last stroke,
	 *  each with an outward unit direction for the electrode stub. */
	ends: { x: number; y: number; dx: number; dy: number }[];
	/** 0-based text line the section sits on — per-line colours key off this. */
	line: number;
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

/** How a section's strokes are joined into one physical tube: `false` leaves them
 *  as separate runs, `'direct'` hops straight from one to the next with a sag, and
 *  `'rail'` drops the crossover to a rail under the text the way a sign shop keeps
 *  the returns clear of the letterforms (art has no baseline, so it takes the
 *  direct route either way). */
export type Crossover = false | 'direct' | 'rail';

export interface LayoutOptions {
	tubes?: TubeGrouping;
	/** Bend the crossover runs between a section's strokes (default false). */
	crossover?: Crossover;
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

// --- crossovers (the blockout runs) -------------------------------------------------
// A real sign is ONE bent tube per circuit: where a stroke ends and the next begins,
// the glass carries on — pushed back off the face plane and dipped in blockout paint,
// so it conducts without showing. These are the runs that make a word read as tube
// rather than as loose glyph fragments; the renderer draws them matte, and the light
// leaks at the seam where the paint stops.

/** One crossover run from `a` to `b`. Glass cannot corner: the run LEAVES along the
 *  tube's own direction (`adir`, the outward tangent at the stroke end) and ARRIVES
 *  along the next stroke's reversed one (`bdir`), with a lead straight enough to
 *  read as the same tube diving back before it bends. `railY` (text only — art has
 *  no baseline) takes a hop with real distance down under the letterforms, the way
 *  a shop routes a long return clear of the counters. */
export function crossoverRun(
	a: [number, number],
	adir: [number, number],
	b: [number, number],
	bdir: [number, number],
	bendR: number,
	railY?: number
): [number, number][] {
	const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
	if (span < 1e-6) return [a, b];
	// The dive: continue out of the glass before turning, and rise into the next
	// stroke the same way. Short hops get shorter leads or they overshoot each other.
	const lead = Math.min(bendR * 1.4, span * 0.35);
	const pa: [number, number] = [a[0] + adir[0] * lead, a[1] + adir[1] * lead];
	const pb: [number, number] = [b[0] + bdir[0] * lead, b[1] + bdir[1] * lead];
	// A hop shorter than a few bends takes the short way whatever the sign is wired
	// for: the returns inside one letterform are stubs, and railing them out to the
	// baseline would run more painted glass than lit.
	if (railY != null && span > bendR * 6) {
		const drop = Math.max(railY, pa[1] + bendR, pb[1] + bendR);
		return roundCorners([a, pa, [pa[0], drop], [pb[0], drop], pb, b], bendR * 2);
	}
	return roundCorners([a, pa, pb, b], bendR * 2);
}

/** Thread a section's strokes onto one tube the way a bender would: finish one
 *  glyph before moving to the next (`groups` arrive in reading order), and inside a
 *  glyph take whichever stroke is nearest, entered by its nearer end, so the glass
 *  covers the letterform with as little doubling back as it can. The hops come back
 *  as painted runs; where two strokes already meet there is nothing to bend. */
const dist = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ends2 = (s: [number, number][]): [[number, number], [number, number]] => [
	s[0],
	s[s.length - 1]
];

// One glyph's strokes, ordered and oriented into a single run. Greedy nearest-next
// from a given opening move, and every opening move is tried — a letter whose
// strokes already chain end to end (the N: up the stem, down the diagonal, up the
// other stem) then comes out with no returns at all, which is how it is bent.
function route(
	group: [number, number][][],
	tail: [number, number] | null
): { runs: [number, number][][]; hops: number[] } {
	let bestRuns: [number, number][][] = [];
	let bestHops: number[] = [];
	let bestCost = Infinity;
	for (let start = 0; start < group.length; start++) {
		for (const flip of [false, true]) {
			const left = group.map((s, i) => ({ s, i }));
			const runs: [number, number][][] = [];
			const hops: number[] = [];
			let at = tail;
			let cost = 0;
			let pick = start;
			let pickFlip = flip;
			while (left.length) {
				const k = left.findIndex((e) => e.i === pick);
				const [{ s }] = left.splice(k < 0 ? 0 : k, 1);
				const run = pickFlip ? [...s].reverse() : s;
				const hop = at ? dist(at, run[0]) : 0;
				hops.push(hop);
				cost += hop;
				runs.push(run);
				at = run[run.length - 1];
				let near = Infinity;
				for (const e of left) {
					const [h, l] = ends2(e.s);
					const dh = dist(at, h);
					const dl = dist(at, l);
					if (Math.min(dh, dl) < near) {
						near = Math.min(dh, dl);
						pick = e.i;
						pickFlip = dl < dh;
					}
				}
			}
			if (cost < bestCost) {
				bestCost = cost;
				bestRuns = runs;
				bestHops = hops;
			}
		}
	}
	return { runs: bestRuns, hops: bestHops };
}

function thread(
	groups: [number, number][][][],
	mode: Exclude<Crossover, false>,
	bendR: number,
	railY?: number
): { strokes: [number, number][][]; painted: boolean[] } {
	const out: [number, number][][] = [];
	const painted: boolean[] = [];
	let prev: [number, number][] | null = null;
	for (const group of groups) {
		const { runs, hops } = route(group, prev ? prev[prev.length - 1] : null);
		for (let i = 0; i < runs.length; i++) {
			const run = runs[i];
			// A hop shorter than a bend is two strokes already meeting: nothing to bend,
			// nothing to paint.
			if (prev && hops[i] > bendR * 0.5) {
				// The dive leaves the glass along ITS tangent and rises into the next
				// stroke along its own — endOf is the same outward direction the
				// electrode stubs use.
				const ea = endOf(prev, true);
				const eb = endOf(run, false);
				out.push(
					crossoverRun(
						[ea.x, ea.y],
						[ea.dx, ea.dy],
						[eb.x, eb.y],
						[eb.dx, eb.dy],
						bendR,
						mode === 'rail' ? railY : undefined
					)
				);
				painted.push(true);
			}
			out.push(run);
			painted.push(false);
			prev = run;
		}
	}
	return { strokes: out, painted };
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
	const grouping: TubeGrouping = opts.tubes ?? 'auto';
	const group = grouping === 'auto' ? (f.grouping ?? 'glyph') : grouping;
	const align = opts.align ?? 'center';
	const advance = (f.ascent + f.descent) * Math.max(0.5, opts.lineSpacing ?? 1.1);
	const track = (opts.letterSpacing ?? 0) * f.capHeight;
	// The bend radius: generous enough to read as glass at any size, small enough
	// to keep counters open — scaled to the face so custom fonts bend in proportion.
	const bendR = f.capHeight * 0.12;

	const lines = text.split(/\r?\n/);
	const sections: TubeSection[] = [];
	const crossover: Crossover = opts.crossover ?? false;

	// One section, threaded onto one tube if the sign is wired that way. The
	// electrode pair is the whole run's two free ends — every joint in between is
	// glass the paint hides, not a place to put a stub.
	const section = (
		groups: [number, number][][][],
		line: number,
		railY?: number,
		art?: number
	): TubeSection => {
		const flat = groups.flat();
		const t = crossover && flat.length > 1 ? thread(groups, crossover, bendR, railY) : null;
		const s = t?.strokes ?? flat;
		const sec: TubeSection = {
			strokes: s,
			ends: [endOf(s[0], false), endOf(s[s.length - 1], true)],
			line
		};
		if (t) sec.painted = t.painted;
		if (art != null) sec.art = art;
		return sec;
	};

	// Measure first (alignment needs the widest line), then place.
	const measure = (line: string): number => {
		let wsum = 0;
		let n = 0;
		for (const ch of line) {
			const g = f.glyphs[ch];
			if (!g) continue;
			wsum += g.adv;
			n++;
		}
		return wsum + Math.max(0, n - 1) * track;
	};
	const widths = lines.map(measure);
	const width = Math.max(0, ...widths);

	for (let li = 0; li < lines.length; li++) {
		const baseY = li * advance;
		let x =
			align === 'left' ? 0 : align === 'right' ? width - widths[li] : (width - widths[li]) / 2;
		// A pending section accumulates glyphs — one group of strokes each, in
		// reading order — until the grouping closes it.
		let open: [number, number][][][] | null = null;
		// The crossover rail for this line: just under the baseline, where a shop
		// runs the long returns so they miss the letterforms.
		const railY = baseY + f.descent * 0.9;
		const close = () => {
			if (!open || !open.length) {
				open = null;
				return;
			}
			sections.push(section(open, li, railY));
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
				// A space: no glass — and the word gap, so 'word' grouping closes here.
				if (group === 'word') close();
			} else {
				const placed = g.strokes.map((s) =>
					roundCorners(
						s.map(([gx, gy]) => [gx + x, gy + baseY] as [number, number]),
						bendR
					)
				);
				if (group === 'glyph') {
					sections.push(section([placed], li, railY));
				} else {
					(open ??= []).push(placed);
				}
			}
			x += g.adv + track;
		}
		close(); // 'word' flushes the last word; 'line' flushes the whole line
	}

	const blockTop = -f.ascent;
	const blockH = Math.max(0, lines.length - 1) * advance + f.ascent + f.descent;
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
			sec.ends = [endOf(sec.strokes[0], false), endOf(sec.strokes[sec.strokes.length - 1], true)];
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
				const kept: [number, number][][] = [];
				const paint: boolean[] = [];
				sec.strokes.forEach((s, si) => {
					for (const run of cutStroke(s, f.face, BLOCKOUT)) {
						kept.push(run);
						paint.push(sec.painted?.[si] ?? false);
					}
				});
				sec.strokes = kept;
				if (sec.painted) sec.painted = paint;
			}
			if (!sec.strokes.length) continue;
			sec.ends = [
				endOf(sec.strokes[0], false),
				endOf(sec.strokes[sec.strokes.length - 1], true)
			].filter((e) => !applicable.some((f) => covered(e.x, e.y, f.face, BLOCKOUT + 1.5)));
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
