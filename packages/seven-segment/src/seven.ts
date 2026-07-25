// @glowbox/seven-segment — a seven-segment display *component*, a sibling rendering
// core to the nixie tube. The bar for existing at all (a font gives you the static
// shapes for free) is everything a font structurally can't do: the segment as a
// physical light source, not a glyph.
//   • Per-segment dynamics: on a value change each segment cross-fades individually,
//     with a tiny stagger — digits smear the way real multiplexed displays do.
//   • Ageing: `age` applies deterministic per-segment wear (some segments dimmer than
//     others), and past ~0.7 the most-worn segment starts *dying* — occasional flicker
//     dips, scheduled sparsely so an idle display costs nothing.
//   • Materials: 'led' is the classic red-orange emitter behind a smoked window with
//     the unlit segment ghosts showing; 'vfd' is cyan-green phosphor with a whiter hot
//     core, a wider halo, and the fine anode-grid mesh over the lit areas.
// Give it a canvas + a value; drive it with setValue/setOptions. Import-safe under
// node/SSR (no browser globals at module scope; Path2D built lazily on first draw).
import { type Color, parseColor } from './color';

const VB_W = 60;
const VB_H = 100;
// Classic rightward italic: x shifts by SLANT per unit of height above the baseline.
const SLANT = 0.09;

// --- segment geometry (viewBox units, y-down, un-slanted) --------------------
// Order: a (top), b (top-right), c (bottom-right), d (bottom), e (bottom-left),
// f (top-left), g (middle), dp (decimal point). Horizontals and verticals are
// hexagons (pointed ends) with a visible gap at the joints, like the real thing.
const T = 7.4; // segment thickness
const GAP = 1.6; // joint gap
const L = 8; // left rail x
const R = 47; // right rail x
const TOP = 9;
const MID = 50;
const BOT = 91;

type Poly = number[]; // x0,y0, x1,y1, …

function hSeg(y: number): Poly {
	const x0 = L + GAP;
	const x1 = R - GAP;
	const h = T / 2;
	return [x0, y, x0 + h, y - h, x1 - h, y - h, x1, y, x1 - h, y + h, x0 + h, y + h];
}
function vSeg(x: number, y0: number, y1: number): Poly {
	const a = y0 + GAP;
	const b = y1 - GAP;
	const h = T / 2;
	return [x, a, x + h, a + h, x + h, b - h, x, b, x - h, b - h, x - h, a + h];
}

const SEGS: Poly[] = [
	hSeg(TOP), // a
	vSeg(R, TOP, MID), // b
	vSeg(R, MID, BOT), // c
	hSeg(BOT), // d
	vSeg(L, MID, BOT), // e
	vSeg(L, TOP, MID), // f
	hSeg(MID) // g
];
const DP: [number, number, number] = [55, BOT, T * 0.42]; // cx, cy, r

// The clock colon: a dedicated two-dot module (value ':'), the way real clock faces
// separate HH:MM — put it in a narrower slot and it fits by height, like nixie's
// separator tube. The dots ride the same animation/wear machinery as segments.
const COLON: [number, number, number][] = [
	[30, 36, T * 0.52],
	[30, 64, T * 0.52]
];

// Each segment's centroid — the hot-core pass scales the segment around its OWN
// centre (scaling around the digit centre would displace the core sideways).
const CENTERS: [number, number][] = SEGS.map((poly) => {
	let sx = 0;
	let sy = 0;
	for (let i = 0; i < poly.length; i += 2) {
		sx += poly[i];
		sy += poly[i + 1];
	}
	const n = poly.length / 2;
	return [sx / n, sy / n];
});
CENTERS.push([DP[0], DP[1]]);

// Which segments light per symbol (bit i = SEGS[i]). Digits, minus, and hex letters —
// the classic driver-chip repertoire.
const FONT: Record<string, number> = {
	'0': 0b0111111,
	'1': 0b0000110,
	'2': 0b1011011,
	'3': 0b1001111,
	'4': 0b1100110,
	'5': 0b1101101,
	'6': 0b1111101,
	'7': 0b0000111,
	'8': 0b1111111,
	'9': 0b1101111,
	'-': 0b1000000,
	A: 0b1110111,
	b: 0b1111100,
	C: 0b0111001,
	d: 0b1011110,
	E: 0b1111001,
	F: 0b1110001
};

/** Display style: classic red LED behind smoked glass, or cyan VFD phosphor. */
export type SevenSegmentStyle = 'led' | 'vfd';

/** Segment names in the standard order (`a` top, clockwise to `f`, `g` middle). */
export type SegmentName = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'dp';
const NAMES: SegmentName[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

/** The coordinate space of `segmentGeometry` (px, y-down). */
export const SEGMENT_VIEWBOX = { width: VB_W, height: VB_H } as const;

/** The classic italic as an x-shear per unit of height — apply it (or don't) when
 *  building your own geometry; the 2D display applies it at render time. */
export const SEGMENT_SLANT = SLANT;

/** The physical layout — one outline polygon per segment in the `SEGMENT_VIEWBOX`
 *  space (y-down, **un-slanted**), plus the decimal-point circle. Extrude these into
 *  prisms for a real 3D module (the core stays 2D — no 3D-engine dependency); pair
 *  with `litSegments` to light the right ones. Same philosophy as nixie's
 *  `nixieCathodes`. */
export function segmentGeometry(): {
	segments: { name: SegmentName; polygon: [number, number][] }[];
	dp: { cx: number; cy: number; r: number };
} {
	return {
		segments: SEGS.map((poly, i) => ({
			name: NAMES[i],
			polygon: Array.from({ length: poly.length / 2 }, (_, j) => [
				poly[j * 2],
				poly[j * 2 + 1]
			]) as [number, number][]
		})),
		dp: { cx: DP[0], cy: DP[1], r: DP[2] }
	};
}

/** Which segments light for a symbol — `0–9`, `-`, hex `A b C d E F`; unknown/blank →
 *  none. The decimal point is a separate display option, never part of a symbol. */
export function litSegments(symbol: string | number | null): SegmentName[] {
	const bits = bitsFor((symbol == null ? '' : String(symbol)).slice(0, 1));
	return NAMES.filter((_, i) => bits & (1 << i));
}

// Case-tolerant font lookup: `A C E F` are authored uppercase, `b d` lowercase (their
// seven-segment shapes ARE the lowercase letters) — accept either.
const bitsFor = (s: string): number =>
	FONT[s] ?? FONT[s.toUpperCase()] ?? FONT[s.toLowerCase()] ?? 0;

export interface SevenSegmentOptions {
	/** The symbol to show: `0–9`, `-`, hex `A b C d E F`, `:` (the two-dot clock
	 *  separator — give it a narrower slot), or null/'' = all dark. */
	value?: string | number | null;
	/** Light the decimal point (default false). */
	dp?: boolean;
	style?: SevenSegmentStyle;
	/** Segment colour (default per style: LED red-orange / VFD phosphor cyan). */
	color?: Color;
	/** Window tint behind the segments (default per style). */
	background?: Color;
	/** Glow strength 0..1 (default 0.7). */
	glow?: number;
	/** Show the unlit segments as faint ghosts (default true). */
	ghost?: boolean;
	/** Wear 0..1 (default 0 = factory fresh): deterministic per-segment dimming; past
	 *  ~0.7 the most-worn segment starts dying (sparse flicker dips), and from ~0.95
	 *  it is permanently dead — only its dark ghost body remains — while the
	 *  runner-up takes over the flickering. Decorative: at full age some symbols
	 *  become ambiguous, exactly like the real broken sign. */
	age?: number;
	/** Per-segment cross-fade on value changes, ms (default 90; 0 = instant — also
	 *  forced under `prefers-reduced-motion`). */
	transition?: number;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
	/** Accessible name (default: the shown symbol; a blank display is aria-hidden). */
	label?: string;
}

export interface SevenSegmentDisplay {
	setValue(v: string | number | null): void;
	setOptions(patch: Partial<SevenSegmentOptions>): void;
	resize(): void;
	snapshot(): string;
	dispose(): void;
}

const c255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

let warnedTruncation = false;
const norm = (v: string | number | null | undefined): string => {
	const s = v == null ? '' : String(v);
	if (s.length > 1 && !warnedTruncation) {
		warnedTruncation = true;
		console.warn(
			`glowbox: a seven-segment digit shows one symbol — "${s}" truncated to "${s[0]}". Compose a row for multi-digit values.`
		);
	}
	return s.slice(0, 1);
};

/** Create a seven-segment digit on a 2D canvas. Returns null if 2D is unavailable. */
export function createSevenSegment(
	canvas: HTMLCanvasElement,
	opts: SevenSegmentOptions = {}
): SevenSegmentDisplay | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	let value = norm(opts.value);
	let dp = opts.dp ?? false;
	let style: SevenSegmentStyle = opts.style ?? 'led';
	let colorOverride = opts.color != null ? parseColor(opts.color) : null;
	let bgOverride = opts.background != null ? parseColor(opts.background) : null;
	let glow = opts.glow ?? 0.7;
	let ghost = opts.ghost ?? true;
	let age = opts.age ?? 0;
	let transition = opts.transition ?? 90;
	let pixelRatio = opts.pixelRatio ?? 2;
	let label = opts.label ?? '';
	let w = 0;
	let h = 0;
	let dpr = 1;

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Per-instance wear fingerprint: every real display ages differently. Deterministic
	// per instance (stable across redraws), random across instances.
	const seed = Math.random() * 1000;
	const wear: number[] = [];
	for (let i = 0; i < 8; i++) wear.push(0.5 + 0.5 * Math.sin(seed + i * 12.9898));
	// The degradation arc: the most-worn segment starts flickering past age ~0.7 and
	// is permanently DEAD by ~0.95 (the 8 that reads as a 6); the runner-up picks up
	// the flickering near the end.
	const dying = wear.indexOf(Math.max(...wear));
	const second = wear.indexOf(Math.max(...wear.filter((_, i) => i !== dying)));
	const DIE_AT = 0.95;

	// Per-segment light state: current brightness eases toward target (0/1), each
	// segment with its own small stagger delay so digits smear like real multiplexing.
	const cur = new Float32Array(8);
	const stagger: number[] = [];
	for (let i = 0; i < 8; i++) stagger.push(((Math.sin(seed * 2 + i * 78.233) + 1) / 2) * 0.35);
	let flickerDim = 1; // the flicker target's momentary level
	let flickTarget = dying; // which segment is currently dipping
	let raf = 0;
	let lastT = 0;
	let flickerTimer: ReturnType<typeof setTimeout> | null = null;

	const styleOf = () => {
		if (style === 'vfd')
			return {
				color: colorOverride ?? ([0.45, 1, 0.85] as number[]),
				bg: bgOverride ?? ([0.012, 0.02, 0.028] as number[]),
				core: [0.85, 1, 0.95] as number[],
				halo: 1.6,
				mesh: true
			};
		return {
			color: colorOverride ?? ([1, 0.22, 0.08] as number[]),
			bg: bgOverride ?? ([0.03, 0.02, 0.02] as number[]),
			core: [1, 0.55, 0.3] as number[],
			halo: 1,
			mesh: false
		};
	};

	const targets = (): number =>
		value === ':' ? 0b0000011 : bitsFor(value) | (dp ? 0b10000000 : 0);

	// Lazily-built Path2D per segment (browser-only global — never at module scope).
	let paths: Path2D[] | null = null;
	const segPaths = (): Path2D[] => {
		if (paths) return paths;
		paths = SEGS.map((poly) => {
			const p = new Path2D();
			p.moveTo(poly[0], poly[1]);
			for (let i = 2; i < poly.length; i += 2) p.lineTo(poly[i], poly[i + 1]);
			p.closePath();
			return p;
		});
		const dpPath = new Path2D();
		dpPath.arc(DP[0], DP[1], DP[2], 0, Math.PI * 2);
		paths.push(dpPath);
		return paths;
	};
	let colon: Path2D[] | null = null;
	const colonPaths = (): Path2D[] => {
		if (colon) return colon;
		colon = COLON.map(([cx, cy, r]) => {
			const p = new Path2D();
			p.arc(cx, cy, r, 0, Math.PI * 2);
			return p;
		});
		return colon;
	};

	const rgba = (c: number[], a: number) => `rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${a})`;

	function draw() {
		if (!w || !h) return;
		const g = ctx!;
		const st = styleOf();
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, canvas.width, canvas.height);
		g.scale(dpr, dpr);

		// The window: a rounded module inset from the canvas edge (shadow into the
		// margin, like the nixie glass), tinted per style.
		const padX = Math.max(2, w * 0.04);
		const padY = Math.max(2, h * 0.04);
		const bw = w - padX * 2;
		const bh = h - padY * 2;
		const rad = Math.min(bw, bh) * 0.08;
		const micro = Math.min((bw * 0.7) / VB_W, (bh * 0.75) / VB_H) * VB_H < 34;
		g.save();
		if (!micro) {
			g.shadowColor = 'rgba(0,0,0,0.5)';
			g.shadowBlur = Math.min(padX, padY) * 1.6;
			g.shadowOffsetY = Math.min(padY * 0.5, 3);
		}
		roundRect(g, padX, padY, bw, bh, rad);
		g.fillStyle = rgba(st.bg, 1);
		g.fill();
		g.restore();
		g.save();
		roundRect(g, padX, padY, bw, bh, rad);
		g.clip();

		// Window vignette (subtle — smoked plastic, not nixie glass).
		if (!micro) {
			const grad = g.createRadialGradient(
				padX + bw / 2,
				padY + bh / 2,
				0,
				padX + bw / 2,
				padY + bh / 2,
				Math.max(bw, bh) * 0.7
			);
			grad.addColorStop(0, rgba(st.bg, 0));
			grad.addColorStop(1, 'rgba(0,0,0,0.35)');
			g.fillStyle = grad;
			g.fillRect(padX, padY, bw, bh);
		}

		// Fit + slant the digit into the window. The colon's ink is a narrow dot
		// column, so it fits by height — a slim separator slot keeps full-size dots.
		const isColon = value === ':';
		const s = isColon
			? Math.min((bh * 0.78) / VB_H, (bw * 0.85) / 14)
			: Math.min((bw * 0.7) / VB_W, (bh * 0.78) / VB_H);
		const cx = padX + bw / 2;
		const cy = padY + bh / 2;
		g.translate(cx, cy);
		g.transform(1, 0, -SLANT, 1, 0, 0); // rightward italic
		g.scale(s, s);
		g.translate(-VB_W / 2, -VB_H / 2);

		const ps = isColon ? colonPaths() : segPaths();
		const centers = isColon ? COLON : CENTERS;
		const bits = targets();
		const sz = VB_H * s;
		for (let i = 0; i < (isColon ? 2 : 8); i++) {
			if (!isColon && i === 7 && !(bits & 0b10000000) && cur[7] < 0.01) {
				// The dp ghost is a dot, not a segment — skip it entirely when dark.
				if (ghost && !micro) {
					g.fillStyle = rgba(st.color, 0.1);
					g.fill(ps[7]);
				}
				continue;
			}
			// Wear dims the segment; the flicker target dips; a dead segment is OFF
			// for good (its dark ghost body still shows, like the real thing).
			const worn = 1 - wear[i] * age * 0.5;
			const dead = i === dying && age >= DIE_AT;
			const lvl = dead ? 0 : cur[i] * worn * (i === flickTarget && age > 0.7 ? flickerDim : 1);
			if (lvl < 0.02) {
				// Unlit ghost: the dark segment body you see on every real display — a
				// neutral raised-plastic base with a whisper of the segment colour.
				if (ghost && !micro) {
					g.fillStyle = 'rgba(140,140,150,0.07)';
					g.fill(ps[i]);
					g.fillStyle = rgba(st.color, 0.09);
					g.fill(ps[i]);
				}
				continue;
			}
			// Halo → body → hot core, all scaled by the segment's level.
			const glowPx = sz * 0.18 * glow * st.halo * lvl;
			g.save();
			// Wide soft halo first (the room-glow), then the tight bright one.
			g.fillStyle = rgba(st.color, lvl);
			g.shadowColor = rgba(st.color, 0.5 * lvl * glow);
			g.shadowBlur = glowPx * 2.4 * (micro ? 0.5 : 1);
			g.fill(ps[i]);
			g.shadowColor = rgba(st.color, 0.9 * lvl);
			g.shadowBlur = glowPx * (micro ? 0.5 : 1);
			g.fill(ps[i]);
			g.fill(ps[i]); // second pass deepens the halo
			g.shadowBlur = 0;
			if (!micro) {
				// Hot core: the same segment, shrunk in place around its own centre.
				const [scx, scy] = centers[i];
				g.fillStyle = rgba(st.core, 0.55 * lvl * lvl);
				g.save();
				g.translate(scx, scy);
				g.scale(0.55, 0.55);
				g.translate(-scx, -scy);
				g.fill(ps[i]);
				g.restore();
			}
			g.restore();
		}

		// VFD anode grid: a fine mesh shadow over the phosphor (the give-away detail).
		if (st.mesh && !micro) {
			g.save();
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.scale(dpr, dpr);
			roundRect(g, padX, padY, bw, bh, rad);
			g.clip();
			g.strokeStyle = 'rgba(0,0,0,0.28)';
			g.lineWidth = Math.max(0.5, sz * 0.006);
			const step = Math.max(2.5, sz * 0.032);
			g.beginPath();
			for (let y = padY; y < padY + bh; y += step) {
				g.moveTo(padX, y);
				g.lineTo(padX + bw, y);
			}
			for (let x = padX; x < padX + bw; x += step * 1.6) {
				g.moveTo(x, padY);
				g.lineTo(x, padY + bh);
			}
			g.stroke();
			g.restore();
		}
		g.restore(); // window clip

		// Window rim highlight.
		if (!micro) {
			roundRect(g, padX, padY, bw, bh, rad);
			g.lineWidth = 1;
			g.strokeStyle = 'rgba(255,255,255,0.07)';
			g.stroke();
		}
	}

	// --- per-segment animation ------------------------------------------------
	// Ease each segment toward its target with its own stagger; run rAF only while
	// something is actually moving. Zero-duration (transition 0 / reduced motion)
	// snaps and paints synchronously, so setValue/setOptions read back immediately.
	function animate() {
		if ((reduced || transition <= 0) && flickerDim >= 1) {
			const bits = targets();
			for (let i = 0; i < 8; i++) cur[i] = bits & (1 << i) ? 1 : 0;
			draw();
			return;
		}
		if (raf) return;
		lastT = performance.now();
		const step = () => {
			raf = 0;
			const now = performance.now();
			const dt = Math.min(0.1, (now - lastT) / 1000);
			lastT = now;
			const bits = targets();
			const dur = reduced ? 0 : transition / 1000;
			let moving = false;
			for (let i = 0; i < 8; i++) {
				const target = bits & (1 << i) ? 1 : 0;
				if (dur <= 0) {
					cur[i] = target;
					continue;
				}
				const rate = dt / (dur * (1 + stagger[i]));
				const next = cur[i] + Math.sign(target - cur[i]) * rate;
				cur[i] = target > cur[i] ? Math.min(target, next) : Math.max(target, next);
				if (cur[i] !== target) moving = true;
			}
			// Dying-segment flicker recovery eases back up between dips.
			if (flickerDim < 1) {
				flickerDim = Math.min(1, flickerDim + dt * 6);
				moving = true;
			}
			draw();
			if (moving) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}

	// Sparse flicker scheduler: a dip every 0.4–2.4 s while age is past the threshold
	// — timeouts, not a render loop, so idle cost ≈ 0. Once the dying segment is dead
	// (age ≥ DIE_AT), the runner-up carries the flickering.
	function scheduleFlicker() {
		if (flickerTimer) return;
		const tick = () => {
			flickerTimer = null;
			if (age <= 0.7 || reduced) return;
			flickTarget = age >= DIE_AT || (age >= 0.9 && Math.random() < 0.35) ? second : dying;
			if (cur[flickTarget] > 0.5) {
				flickerDim = 0.05 + Math.random() * 0.3;
				animate();
			}
			flickerTimer = setTimeout(tick, 400 + Math.random() * 2000);
		};
		flickerTimer = setTimeout(tick, 400 + Math.random() * 2000);
	}
	function syncFlicker() {
		if (age > 0.7 && !reduced) scheduleFlicker();
		else if (flickerTimer) {
			clearTimeout(flickerTimer);
			flickerTimer = null;
			flickerDim = 1;
		}
	}

	function resize() {
		const cap = pixelRatio > 0 ? pixelRatio : 1;
		dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cap);
		const r = canvas.getBoundingClientRect();
		w = Math.max(1, r.width || canvas.clientWidth || 1);
		h = Math.max(1, r.height || canvas.clientHeight || 1);
		if (Math.abs(w - canvas.width) < 1 && Math.abs(h - canvas.height) < 1) {
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
		}
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		draw();
	}

	function applyAria() {
		canvas.setAttribute('role', 'img');
		const name = label || (value ? value + (dp ? '.' : '') : '');
		if (name) {
			canvas.setAttribute('aria-label', name);
			canvas.removeAttribute('aria-hidden');
		} else {
			canvas.setAttribute('aria-hidden', 'true');
			canvas.removeAttribute('aria-label');
		}
	}
	applyAria();

	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	ro?.observe(canvas);
	// First paint: segments land at their targets instantly (no boot animation), then
	// changes animate.
	{
		const bits = targets();
		for (let i = 0; i < 8; i++) cur[i] = bits & (1 << i) ? 1 : 0;
	}
	resize();
	syncFlicker();

	return {
		setValue(v) {
			value = norm(v);
			applyAria();
			animate();
		},
		setOptions(patch) {
			if (patch.style != null) style = patch.style;
			if (patch.color !== undefined)
				colorOverride = patch.color != null ? parseColor(patch.color) : null;
			if (patch.background !== undefined)
				bgOverride = patch.background != null ? parseColor(patch.background) : null;
			if (patch.glow != null) glow = patch.glow;
			if (patch.ghost != null) ghost = patch.ghost;
			if (patch.age != null) age = Math.max(0, Math.min(1, patch.age));
			if (patch.transition != null) transition = patch.transition;
			if (patch.dp != null) dp = patch.dp;
			if (patch.value !== undefined) value = norm(patch.value);
			if (patch.label !== undefined) label = patch.label;
			applyAria();
			syncFlicker();
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
			}
			animate();
		},
		resize,
		snapshot() {
			draw();
			return canvas.toDataURL('image/png');
		},
		dispose() {
			ro?.disconnect();
			if (raf) cancelAnimationFrame(raf);
			if (flickerTimer) clearTimeout(flickerTimer);
		}
	};
}

function roundRect(
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	rw: number,
	rh: number,
	r: number
) {
	const rr = Math.min(r, rw / 2, rh / 2);
	g.beginPath();
	g.moveTo(x + rr, y);
	g.arcTo(x + rw, y, x + rw, y + rh, rr);
	g.arcTo(x + rw, y + rh, x, y + rh, rr);
	g.arcTo(x, y + rh, x, y, rr);
	g.arcTo(x, y, x + rw, y, rr);
	g.closePath();
}
