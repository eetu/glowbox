// SVG path data → filled polygons, pure and node-testable. A vendored copy of
// @glowbox/neon's parser (same command vocabulary and adaptive flattening: M/L/H/V/C/S/
// Q/T/A/Z, relatives, implicit repeats, the compact arc-flag form `a1 1 0 011 0`), with
// one deliberate difference in what comes out the far end.
//
// Neon needed CENTRELINES, because a tube is a stroke — which made authoring artwork
// for it a craft (single-stroke pen paths, no boolean shapes). A VFD anode is the
// opposite: a patch of phosphor SCREEN-PRINTED onto the plate, so it is a FILL. Path
// data straight out of any vector editor — or copied off an icon set — works as-is, and
// subpaths keep their winding so a shape with a hole (the reels of a cassette, the ring
// of a disc) fills correctly as one anode.

type Pt = [number, number];
type Cubic = [Pt, Pt, Pt]; // c1, c2, end
type Item = { line: Pt } | { cubic: Cubic };
interface Sub {
	start: Pt;
	items: Item[];
	closed: boolean;
}

export interface PathToPolysOptions {
	/** Curve-flattening tolerance as a fraction of the path's bounding-box diagonal
	 *  (default 0.002 — well under one screen pixel at any panel size). */
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

/** Turn SVG path data (a `d` string, or several) into closed polygons in the path's own
 *  units — the geometry an `icon` element screen-prints onto its plate. Every subpath
 *  comes back closed whether or not it carried a `Z`, since an anode is a filled patch
 *  and an unclosed one is just an authoring slip. Coordinates are flat
 *  `[x0,y0,x1,y1,…]` per polygon, which is the panel's one geometry currency. Throws on
 *  malformed data. */
export function pathToPolys(d: string | string[], opts: PathToPolysOptions = {}): number[][] {
	const flat: number[][] = [];
	for (const poly of pathToRings(d, opts)) {
		const out: number[] = [];
		for (const [x, y] of poly) out.push(x, y);
		flat.push(out);
	}
	return flat;
}

function pathToRings(d: string | string[], opts: PathToPolysOptions = {}): [number, number][][] {
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

	const rings: [number, number][][] = [];
	for (const s of subs) {
		const pts: Pt[] = [s.start];
		for (const it of s.items) {
			if ('line' in it) pts.push(it.line);
			else flatten(pts[pts.length - 1], it.cubic, tol, pts, 0);
		}
		// A fill closes implicitly — drop a duplicated final point rather than adding
		// one, and never mind whether the author wrote the `Z`. Winding is preserved as
		// authored, so a reversed inner subpath still punches its hole.
		const first = pts[0];
		const last = pts[pts.length - 1];
		if (pts.length > 2 && first[0] === last[0] && first[1] === last[1]) pts.pop();
		if (pts.length >= 3) rings.push(pts);
	}
	return rings;
}
