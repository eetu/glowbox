// @glowbox/neon path support — SVG path data → tube centrelines, pure and
// node-testable. `pathToStrokes` turns a `d` attribute (or several) into the
// same `[x,y][][]` polylines the layout pipeline runs on, so sign artwork can be
// authored in any vector editor and pasted in. The full command vocabulary is
// handled (M/L/H/V/C/S/Q/T/A/Z, relatives, implicit repeats, the compact
// arc-flag form `a1 1 0 011 0`); curves flatten adaptively with a tolerance
// scaled to the path's own bounding box, so a 24-unit icon and a 512-unit
// drawing both come out smooth under the tube width.
//
// One thing no parser can fix: neon needs CENTRELINES. A filled icon's outline
// path strokes as a double-walled tube silhouette — author single-stroke paths
// (the pen tool, not the shape-minus-shape booleans), and put the bends you
// want in the path itself (sharp corners render as sharp glass).

type Pt = [number, number];
type Cubic = [Pt, Pt, Pt]; // c1, c2, end
type Item = { line: Pt } | { cubic: Cubic };
interface Sub {
	start: Pt;
	items: Item[];
	closed: boolean;
}

export interface PathToStrokesOptions {
	/** Curve-flattening tolerance as a fraction of the path's bounding-box
	 *  diagonal (default 0.002 — invisible under the tube width at any size). */
	tolerance?: number;
}

const isLetter = (ch: string) => /[a-zA-Z]/.test(ch);

// Endpoint-parameterised arc → cubic segments (SVG spec F.6.5), split at ≤90°.
function arcCubics(
	x0: number,
	y0: number,
	rx: number,
	ry: number,
	phiDeg: number,
	large: number,
	sweep: number,
	x1: number,
	y1: number
): Cubic[] {
	// Degenerate radii never reach here — the caller emits a line per the spec.
	rx = Math.abs(rx);
	ry = Math.abs(ry);
	const phi = (phiDeg * Math.PI) / 180;
	const cosP = Math.cos(phi);
	const sinP = Math.sin(phi);
	// Move to the arc's local frame.
	const dx = (x0 - x1) / 2;
	const dy = (y0 - y1) / 2;
	const x1p = cosP * dx + sinP * dy;
	const y1p = -sinP * dx + cosP * dy;
	// Scale radii up if the endpoints can't be reached (spec-mandated clamp).
	const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
	if (lambda > 1) {
		const s = Math.sqrt(lambda);
		rx *= s;
		ry *= s;
	}
	const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
	const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
	const co = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
	const cxp = (co * rx * y1p) / ry;
	const cyp = (-co * ry * x1p) / rx;
	const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
	const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;
	const ang = (ux: number, uy: number, vx: number, vy: number) => {
		const sign = ux * vy - uy * vx < 0 ? -1 : 1;
		const d = Math.hypot(ux, uy) * Math.hypot(vx, vy);
		return sign * Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d)));
	};
	const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
	let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
	if (!sweep && dt > 0) dt -= 2 * Math.PI;
	if (sweep && dt < 0) dt += 2 * Math.PI;

	const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
	const out: Cubic[] = [];
	const at = (t: number): Pt => [
		cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP,
		cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP
	];
	const dAt = (t: number): Pt => [
		-rx * Math.sin(t) * cosP - ry * Math.cos(t) * sinP,
		-rx * Math.sin(t) * sinP + ry * Math.cos(t) * cosP
	];
	for (let i = 0; i < segs; i++) {
		const a = t1 + (dt * i) / segs;
		const b = t1 + (dt * (i + 1)) / segs;
		const k = ((4 / 3) * Math.tan((b - a) / 4)) as number;
		const p0 = at(a);
		const p1 = at(b);
		const d0 = dAt(a);
		const d1 = dAt(b);
		out.push([[p0[0] + k * d0[0], p0[1] + k * d0[1]], [p1[0] - k * d1[0], p1[1] - k * d1[1]], p1]);
	}
	return out;
}

function parseOne(d: string): Sub[] {
	let i = 0;
	const err = (msg: string): never => {
		throw new Error(`glowbox: bad SVG path data at ${i}: ${msg} (…"${d.slice(i, i + 12)}")`);
	};
	const ws = () => {
		while (i < d.length && /[\s,]/.test(d[i])) i++;
	};
	const more = () => {
		ws();
		return i < d.length && !isLetter(d[i]);
	};
	const num = (): number => {
		ws();
		const m = /^[-+]?(\d*\.\d+|\d+\.?)([eE][-+]?\d+)?/.exec(d.slice(i));
		if (!m) err('number expected');
		i += m![0].length;
		return parseFloat(m![0]);
	};
	// Arc flags are single characters and may be run together ("011").
	const flag = (): number => {
		ws();
		const ch = d[i];
		if (ch !== '0' && ch !== '1') err('flag expected');
		i++;
		return ch === '1' ? 1 : 0;
	};

	const subs: Sub[] = [];
	let sub: Sub | null = null;
	let cx = 0;
	let cy = 0;
	let sx = 0;
	let sy = 0;
	let pcx: number | null = null; // previous cubic control (for S)
	let pcy = 0;
	let pqx: number | null = null; // previous quad control (for T)
	let pqy = 0;

	const open = () => {
		if (!sub) {
			sub = { start: [cx, cy], items: [], closed: false };
			subs.push(sub);
		}
		return sub;
	};
	const lineTo = (x: number, y: number) => {
		open().items.push({ line: [x, y] });
		cx = x;
		cy = y;
	};
	const cubicTo = (c: Cubic) => {
		open().items.push({ cubic: c });
		cx = c[2][0];
		cy = c[2][1];
	};

	ws();
	while (i < d.length) {
		ws();
		if (i >= d.length) break;
		const c = d[i];
		if (!isLetter(c)) err('command expected');
		i++;
		const rel = c === c.toLowerCase();
		const C = c.toUpperCase();
		let tracked = false; // did this command maintain a reflection control?
		switch (C) {
			case 'M': {
				let first = true;
				do {
					const x = num() + (rel ? cx : 0);
					const y = num() + (rel ? cy : 0);
					if (first) {
						sub = null;
						cx = x;
						cy = y;
						sx = x;
						sy = y;
						first = false;
					} else {
						lineTo(x, y); // extra pairs are implicit LineTos
					}
				} while (more());
				break;
			}
			case 'L':
				do lineTo(num() + (rel ? cx : 0), num() + (rel ? cy : 0));
				while (more());
				break;
			case 'H':
				do lineTo(num() + (rel ? cx : 0), cy);
				while (more());
				break;
			case 'V':
				do lineTo(cx, num() + (rel ? cy : 0));
				while (more());
				break;
			case 'C':
				do {
					const c1: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					const c2: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					const p: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					cubicTo([c1, c2, p]);
					pcx = c2[0];
					pcy = c2[1];
				} while (more());
				tracked = true;
				break;
			case 'S':
				do {
					const c1: Pt = pcx != null ? [2 * cx - pcx, 2 * cy - pcy] : [cx, cy];
					const c2: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					const p: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					cubicTo([c1, c2, p]);
					pcx = c2[0];
					pcy = c2[1];
				} while (more());
				tracked = true;
				break;
			case 'Q':
				do {
					const q: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					const p: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					// Degree elevation: a quadratic is exactly this cubic.
					cubicTo([
						[cx + (2 / 3) * (q[0] - cx), cy + (2 / 3) * (q[1] - cy)],
						[p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])],
						p
					]);
					pqx = q[0];
					pqy = q[1];
				} while (more());
				tracked = true;
				break;
			case 'T':
				do {
					const q: Pt = pqx != null ? [2 * cx - pqx, 2 * cy - pqy] : [cx, cy];
					const p: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
					cubicTo([
						[cx + (2 / 3) * (q[0] - cx), cy + (2 / 3) * (q[1] - cy)],
						[p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])],
						p
					]);
					pqx = q[0];
					pqy = q[1];
				} while (more());
				tracked = true;
				break;
			case 'A':
				do {
					const rx = num();
					const ry = num();
					const rot = num();
					const la = flag();
					const swp = flag();
					const x = num() + (rel ? cx : 0);
					const y = num() + (rel ? cy : 0);
					if (rx === 0 || ry === 0)
						lineTo(x, y); // spec: degenerate arc is a line
					else for (const cu of arcCubics(cx, cy, rx, ry, rot, la, swp, x, y)) cubicTo(cu);
				} while (more());
				break;
			case 'Z': {
				if (sub) {
					(sub as Sub).closed = true;
					sub = null;
				}
				cx = sx;
				cy = sy;
				break;
			}
			default:
				err(`unknown command '${c}'`);
		}
		if (!tracked) {
			pcx = null;
			pqx = null;
		}
	}
	return subs;
}

// Adaptive de Casteljau flattening: subdivide until both controls hug the chord.
function flatten(p0: Pt, c: Cubic, tol: number, out: Pt[], depth: number) {
	const [c1, c2, p1] = c;
	const dx = p1[0] - p0[0];
	const dy = p1[1] - p0[1];
	const d1 = Math.abs((c1[0] - p1[0]) * dy - (c1[1] - p1[1]) * dx);
	const d2 = Math.abs((c2[0] - p1[0]) * dy - (c2[1] - p1[1]) * dx);
	const dd = d1 + d2;
	if (depth >= 18 || dd * dd <= tol * tol * (dx * dx + dy * dy)) {
		out.push(p1);
		return;
	}
	const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const ab = mid(p0, c1);
	const bc = mid(c1, c2);
	const cd = mid(c2, p1);
	const abc = mid(ab, bc);
	const bcd = mid(bc, cd);
	const m = mid(abc, bcd);
	flatten(p0, [ab, abc, m], tol, out, depth + 1);
	flatten(m, [bcd, cd, p1], tol, out, depth + 1);
}

/** Turn SVG path data (a `d` string, or several — subpaths become separate glass
 *  runs either way) into centreline polylines in the path's own units, ready for
 *  a custom `NeonFont` glyph or the sign's `art`. Throws on malformed data. */
export function pathToStrokes(
	d: string | string[],
	opts: PathToStrokesOptions = {}
): [number, number][][] {
	const subs = (typeof d === 'string' ? [d] : d).flatMap(parseOne);
	// Tolerance rides the drawing's own scale: a rough bbox over anchors+controls.
	let lo = Infinity;
	let hi = -Infinity;
	let lov = Infinity;
	let hiv = -Infinity;
	const see = ([x, y]: Pt) => {
		lo = Math.min(lo, x);
		hi = Math.max(hi, x);
		lov = Math.min(lov, y);
		hiv = Math.max(hiv, y);
	};
	for (const s of subs) {
		see(s.start);
		for (const it of s.items) {
			if ('line' in it) see(it.line);
			else it.cubic.forEach(see);
		}
	}
	const diag = subs.length ? Math.hypot(hi - lo, hiv - lov) : 0;
	const tol = Math.max(1e-9, diag * Math.max(1e-5, opts.tolerance ?? 0.002));

	const strokes: [number, number][][] = [];
	for (const s of subs) {
		const pts: Pt[] = [s.start];
		for (const it of s.items) {
			if ('line' in it) pts.push(it.line);
			else flatten(pts[pts.length - 1], it.cubic, tol, pts, 0);
		}
		if (s.closed) {
			const first = pts[0];
			const last = pts[pts.length - 1];
			if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
		}
		if (pts.length >= 2) strokes.push(pts);
	}
	return strokes;
}
