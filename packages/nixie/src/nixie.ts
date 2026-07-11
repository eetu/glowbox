// @glowbox/nixie — a nixie-tube display *component*, a sibling rendering core to
// @glowbox/core's LED grid. It renders a single glowing numeral the way a real nixie
// works: a stack of bent-wire cathodes inside a glass tube, only one lit, warm-orange,
// behind a honeycomb anode mesh. Give it a canvas + a value; drive it with
// setValue/setOptions. The `style` prop picks the physical tube's numeral shape.
//
// The numerals are hand-authored *single-stroke* SVG paths (a viewBox of 60×100),
// stroked as one constant-width filament with round caps — a real nixie digit is one
// continuous bent wire, not a filled glyph. Each digit also carries a small fixed
// NUDGE: in a real tube the cathodes sit at slightly different positions/depths, so the
// glowing number shifts a hair off dead-centre and jitters as the value changes.
import { type Color, parseColor } from '@glowbox/core';

const TAU = Math.PI * 2;
const VB_W = 60;
const VB_H = 100;

// Single-stroke wire numerals (viewBox 0 0 60 100, y-down): each is one thin geometric
// filament — the cathode wire — drawn round-capped, in a light geometric grotesque (à la
// TT Chocolates Extra Light). The shapes live as editable SVGs in ../glyphs (their single
// source of truth); Vite inlines each at build time and we lift the path data out, so
// tuning a numeral is just editing its .svg — no second copy to keep in sync. (`dash.svg`
// → '-', `colon.svg` → the two-dot separator.) Every `d=` attribute in a file is read
// (single- or double-quoted) and concatenated, so layers without a `d` — guide rects, a
// `<title>`, etc. — are ignored; but any extra `<path>` is drawn too, so keep each glyph to
// the strokes you want.
const rawSvgs = import.meta.glob('../glyphs/*.svg', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;
const pathData = (svg: string): string =>
	[...svg.matchAll(/\bd\s*=\s*(["'])([\s\S]*?)\1/g)].map((m) => m[2]).join(' ');
const GLYPHS: Record<string, string> = {};
let colonD = '';
for (const [file, svg] of Object.entries(rawSvgs)) {
	const name = file.slice(file.lastIndexOf('/') + 1, -'.svg'.length);
	const ch = name === 'dash' ? '-' : name === 'colon' ? ':' : name;
	const d = pathData(svg);
	if (!d) continue;
	if (ch === ':') colonD = d;
	else GLYPHS[ch] = d;
}
// Colon separator: two circles, stroked as glowing wire rings like the numerals.
const COLON = new Path2D(colonD);

// Stack order, front → back (the physical cathode order of an IN-14-style tube). Depth
// index gives each numeral a slightly different position/scale, so the glowing digit
// sits a hair off dead-centre and set back among the wire stack.
const STACK = '1234567890';
const DEPTH: Record<string, number> = {};
for (let i = 0; i < STACK.length; i++) DEPTH[STACK[i]] = i;

// A digit's parallax offset + scale from its depth in the stack (viewBox units). The
// cathodes sit nearly concentric — mostly set *back* (smaller) with a small sideways
// drift — so they read as a nested stack, not a scattered spread. Symbols that aren't part
// of the numeral stack (the `:` and `-` separators) get no parallax — they render centred.
const placement = (ch: string): { ox: number; oy: number; ds: number } => {
	const d = DEPTH[ch];
	if (d === undefined) return { ox: 0, oy: 0, ds: 1 };
	const t = (d - 4.5) / 4.5; // -1 (front) .. +1 (back)
	return { ox: t * 1.2, oy: -t * 1.1 - 0.4 * Math.sin(d * 1.7), ds: 1 - d * 0.02 };
};

// Per-style wire proportions: horizontal/vertical squash and filament width (viewBox units).
const STYLES: Record<NixieStyle, { sx: number; sy: number; lw: number }> = {
	classic: { sx: 1, sy: 1, lw: 4.2 },
	slim: { sx: 0.84, sy: 1.06, lw: 3.2 },
	tall: { sx: 0.9, sy: 1.16, lw: 3.7 }
};
// Dull-metal colour of the unlit cathode wires behind the glass (dim nickel).
const WIRE: number[] = [0.52, 0.52, 0.56];

const glyphCache = new Map<string, Path2D>();
const pathFor = (ch: string): Path2D | null => {
	if (ch === ':') return COLON;
	const d = GLYPHS[ch];
	if (!d) return null;
	let p = glyphCache.get(ch);
	if (!p) {
		p = new Path2D(d);
		glyphCache.set(ch, p);
	}
	return p;
};

/** Physical tube style — changes the numeral shape (and proportions). */
export type NixieStyle = 'classic' | 'slim' | 'tall';

export interface NixieOptions {
	/** The symbol to light: a single char `0–9`, `:`, `-`, or null/'' = all cathodes dark. */
	value?: string | number | null;
	/** Tube style (default 'classic'). */
	style?: NixieStyle;
	/** Glow colour (default warm nixie orange). */
	color?: Color;
	/** Glow strength 0..1 (default 0.7). */
	glow?: number;
	/** Tube glass colour behind the numerals (default near-black). */
	background?: Color;
	/** Draw the honeycomb anode mesh over the tube (default true). */
	mesh?: boolean;
	/** Draw the other, unlit cathodes faintly behind — the stacked-numeral depth (default true). */
	ghost?: boolean;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
}

export interface NixieTube {
	/** Light a new symbol (single char `0–9`, `:`, `-`, or null = off). */
	setValue(v: string | number | null): void;
	/** Live-update any option. */
	setOptions(patch: Partial<NixieOptions>): void;
	/** Redraw at the current canvas box size (call after the canvas resizes). */
	resize(): void;
	/** Return the current frame as a PNG data URL. */
	snapshot(): string;
	dispose(): void;
}

const norm = (v: string | number | null | undefined): string =>
	v == null ? '' : String(v).slice(0, 1);
const c255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** Create a nixie tube on a 2D canvas. Returns null if a 2D context is unavailable. */
export function createNixieTube(
	canvas: HTMLCanvasElement,
	opts: NixieOptions = {}
): NixieTube | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	let value = norm(opts.value);
	let style: NixieStyle = opts.style ?? 'classic';
	let color = parseColor(opts.color ?? [1, 0.45, 0.08]);
	let glow = opts.glow ?? 0.7;
	let bg = parseColor(opts.background ?? [0.03, 0.03, 0.045]);
	let mesh = opts.mesh ?? true;
	let ghost = opts.ghost ?? true;
	let pixelRatio = opts.pixelRatio ?? 2;
	let w = 0;
	let h = 0;
	let dpr = 1;

	const rgb = (c: number[]) => `rgb(${c255(c[0])},${c255(c[1])},${c255(c[2])})`;
	const rgba = (c: number[], a: number) => `rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${a})`;

	function hex(cx: number, cy: number, r: number) {
		ctx!.beginPath();
		for (let i = 0; i < 6; i++) {
			const a = Math.PI / 6 + (i * Math.PI) / 3;
			const px = cx + r * Math.cos(a);
			const py = cy + r * Math.sin(a);
			if (i) ctx!.lineTo(px, py);
			else ctx!.moveTo(px, py);
		}
		ctx!.closePath();
	}
	function drawMesh(bw: number, bh: number) {
		ctx!.strokeStyle = 'rgba(120,120,135,0.09)';
		ctx!.lineWidth = 0.8;
		const r = Math.max(bw, bh) * 0.06;
		const hw = r * Math.sqrt(3);
		for (let y = -r; y < bh + r; y += r * 1.5) {
			const off = (Math.round(y / (r * 1.5)) % 2) * (hw / 2);
			for (let x = -hw; x < bw + hw; x += hw) {
				hex(x + off, y, r);
				ctx!.stroke();
			}
		}
	}
	// The glass envelope shape — its shadow, fill/clip, and rim all trace this rounded rect.
	function roundRect(x: number, y: number, rw: number, rh: number, r: number) {
		const rr = Math.min(r, rw / 2, rh / 2);
		const g = ctx!;
		g.beginPath();
		g.moveTo(x + rr, y);
		g.arcTo(x + rw, y, x + rw, y + rh, rr);
		g.arcTo(x + rw, y + rh, x, y + rh, rr);
		g.arcTo(x, y + rh, x, y, rr);
		g.arcTo(x, y, x + rw, y, rr);
		g.closePath();
	}

	function draw() {
		if (!w || !h) return;
		const g = ctx!;
		g.setTransform(1, 0, 0, 1, 0, 0);
		// Clear to *transparent* — the page background shows through the margin around the
		// glass. The glass is drawn as a rounded module inset from the canvas edge so it can
		// cast a soft shadow into that margin: that depth is what lets the tube sit right on
		// ANY backdrop, including white. (A bloom can't read against white, so the glass
		// itself must stay dark; the shadow + rim, not a light glass, are what carry it.)
		g.clearRect(0, 0, canvas.width, canvas.height);
		g.scale(dpr, dpr);
		// Shadow/glass margin — horizontal tracks width, vertical tracks height, so tubes
		// that share a canvas height get the SAME glass height (a narrow separator tube stays
		// exactly as tall as the digit tubes beside it, instead of gaining height from a
		// smaller margin).
		const padX = Math.max(4, w * 0.08);
		const padY = Math.max(4, h * 0.05);
		const bw = w - 2 * padX;
		const bh = h - 2 * padY;
		const rad = Math.min(bw, bh) * 0.1;
		const sPad = Math.min(padX, padY);

		// Drop shadow (invisible on a dark page, a soft lift on a light one).
		g.save();
		g.shadowColor = 'rgba(0,0,0,0.42)';
		g.shadowBlur = sPad * 1.6;
		g.shadowOffsetY = padY * 0.3;
		roundRect(padX, padY, bw, bh, rad);
		g.fillStyle = '#000';
		g.fill();
		g.restore();

		// Clip to the glass and work in glass-local coordinates.
		g.save();
		roundRect(padX, padY, bw, bh, rad);
		g.clip();
		g.translate(padX, padY);

		// Tube glass: a radial vignette from the glass colour out to a darkened tint of it
		// (not pure black), so coloured/tinted tubes keep a coloured — not black — rim.
		const grad = g.createRadialGradient(bw / 2, bh / 2, 0, bw / 2, bh / 2, Math.max(bw, bh) * 0.72);
		grad.addColorStop(0, rgba(bg, 1));
		grad.addColorStop(1, rgba([bg[0] * 0.16, bg[1] * 0.16, bg[2] * 0.18], 1));
		g.fillStyle = grad;
		g.fillRect(0, 0, bw, bh);

		const cx = bw / 2;
		const cy = bh / 2;
		const st = STYLES[style];
		const isColon = value === ':';
		// Level of detail from the rendered numeral height (css px). The filament illusion —
		// a *thin* wire under a heavy bloom, behind a honeycomb mesh and a stack of cathode
		// wires — reads down to ~64px. Smaller than that, forcing it makes a sub-pixel wire
		// vanish into its own blur, so we switch methods: fatten the filament, drop the mesh
		// + stack, and use fewer/tighter bloom passes. Tiny tubes become a plain bold glyph.
		// The colon's ink is narrow (two dots), so gauge it by tube *height* — otherwise its
		// slim separator tube would wrongly demote it below its digit neighbours.
		const est = isColon ? bh * 0.62 : Math.min((bw * 0.6) / VB_W, (bh * 0.7) / VB_H) * VB_H;
		const micro = est < 32; // tiny — a legible bold glyph, minimal glow
		const compact = est < 64; // small numeral — no cathode stack, lighter bloom
		// The mesh belongs to the glass, so it tracks glass *height* — uniform across a row —
		// which keeps a narrow separator tube's mesh matching its wider digit neighbours (a
		// min(bw,bh) gauge would single the slim colon out). The cathode stack, below, tracks
		// numeral size instead (it needs room to read).
		if (mesh && bh >= 34) drawMesh(bw, bh);

		// Fit the numeral into the glass. The digit viewBox already carries side margin, so
		// the width factor can run fairly high — the glyph fills most of the glass width
		// (the bloom is clipped to the glass anyway) — which lets a narrow tube still show a
		// full-size numeral. Small tubes fill even more (legibility trumps bloom room). The
		// colon is fit by height (its ink is narrow), falling back to width only in an
		// extremely slim tube, so the dots stay sized like the digits beside them.
		const s = isColon
			? Math.min((bh * 0.62) / VB_H, (bw * 0.9) / 24)
			: compact
				? Math.min((bw * 0.82) / VB_W, (bh * 0.82) / VB_H)
				: Math.min((bw * 0.72) / VB_W, (bh * 0.68) / VB_H);
		const sz = VB_H * s; // filament height in css px — the glow scale reference
		const weight = micro ? 2.4 : compact ? 1.5 : 1; // fatten the thin wire as it shrinks
		const blur = (f: number) => Math.min(sz * f * glow, 160); // cap: perf + huge-size sanity
		g.lineJoin = 'round';
		g.lineCap = 'round';

		// Position a glyph at its depth in the cathode stack (parallax offset + scale),
		// under the style's squash, then stroke it. Everything is a stroked filament — the
		// colon's circles included (they render as glowing wire rings, matching the digits).
		const place = (path: Path2D, ch: string) => {
			const { ox, oy, ds } = placement(ch);
			g.save();
			g.translate(cx + ox * s, cy + oy * s);
			g.scale(s * st.sx * ds, s * st.sy * ds);
			g.translate(-VB_W / 2, -VB_H / 2);
			g.stroke(path);
			g.restore();
		};

		// The physical cathode stack: every numeral as a thin dull-metal wire, back-to-front
		// so nearer digits overlap farther ones — the wire stack you see behind the glass
		// even unlit. Only on a digit tube (a separator tube — `:`/`-` — has no digit
		// cathodes, so it shows none) and only when big enough to read (else a smudge).
		if (ghost && !compact && DEPTH[value] !== undefined) {
			g.shadowBlur = 0;
			for (const ch of STACK) {
				if (ch === value) continue; // the lit numeral is drawn glowing below
				const p = pathFor(ch);
				if (!p) continue;
				const back = DEPTH[ch] / 9; // 0 front .. 1 back → farther wires dimmer
				g.strokeStyle = rgba(WIRE, 0.3 - back * 0.19);
				g.lineWidth = st.lw * 0.72;
				place(p, ch);
			}
		}

		// The lit cathode: an outer neon bloom (fewer passes as the tube shrinks), then a
		// hot thin filament core.
		const path = pathFor(value);
		if (path) {
			const layers = micro
				? [[0.3, 0.6, 1.3]]
				: compact
					? [
							[0.42, 0.4, 1.5],
							[0.13, 0.85, 1]
						]
					: [
							[0.6, 0.3, 1.7],
							[0.28, 0.6, 1.15],
							[0.09, 0.92, 0.85]
						];
			g.shadowColor = rgb(color);
			for (const [blurF, alpha, lwF] of layers) {
				g.shadowBlur = blur(blurF);
				g.strokeStyle = rgba(color, alpha);
				g.lineWidth = st.lw * lwF * weight;
				place(path, value);
			}
			// Hot core — a thinner, near-white filament down the centre of the wire.
			g.shadowBlur = blur(0.05);
			g.strokeStyle = rgba(
				[Math.min(1, color[0] + 0.55), Math.min(1, color[1] + 0.45), Math.min(1, color[2] + 0.35)],
				0.95
			);
			g.lineWidth = st.lw * (micro ? 0.62 : 0.42) * weight;
			place(path, value);
			g.shadowBlur = 0;
		}
		// Glass highlight (skip on tiny tubes — it's just noise there).
		if (!micro) {
			g.fillStyle = 'rgba(255,255,255,0.045)';
			g.beginPath();
			g.ellipse(bw * 0.36, bh * 0.28, bw * 0.2, bh * 0.12, -0.5, 0, TAU);
			g.fill();
		}
		g.restore(); // end glass clip

		// Glass rim: a hairline bright edge so the envelope reads as a curved-glass tube even
		// against a light background.
		roundRect(padX, padY, bw, bh, rad);
		g.lineWidth = 1;
		g.strokeStyle = 'rgba(255,255,255,0.08)';
		g.stroke();
	}

	function resize() {
		// pixelRatio caps the device ratio; guard a non-positive value (fall back to 1×) so a
		// stray 0 can't zero the backing store below.
		const cap = pixelRatio > 0 ? pixelRatio : 1;
		dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cap);
		const r = canvas.getBoundingClientRect();
		// CSS (layout) size — never derive it from canvas.width (that's the *device*
		// backing size; on retina it's dpr× the display size and reusing it here would
		// inflate the tube every frame).
		w = Math.max(1, r.width || canvas.clientWidth || 1);
		h = Math.max(1, r.height || canvas.clientHeight || 1);
		// If the element has no CSS size of its own, its layout box is driven by the
		// width/height *attributes* — so writing a HiDPI backing store below would enlarge
		// the box and re-fire the ResizeObserver, an unbounded loop on retina. Pin the
		// display size in CSS px once so the backing-store write can't feed back into
		// layout. A CSS-sized canvas (width:100%, fixed px, …) reports a box that differs
		// from the attribute, so it's left alone and stays responsive.
		if (Math.abs(w - canvas.width) < 1 && Math.abs(h - canvas.height) < 1) {
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
		}
		// Floor at 1px: a sub-1 dpr on a tiny element must not round to a 0-size (blank) canvas.
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		draw();
	}

	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	ro?.observe(canvas);
	resize();

	return {
		setValue(v) {
			value = norm(v);
			draw();
		},
		setOptions(patch) {
			if (patch.style) style = patch.style;
			if (patch.color != null) color = parseColor(patch.color);
			if (patch.glow != null) glow = patch.glow;
			if (patch.background != null) bg = parseColor(patch.background);
			if (patch.mesh != null) mesh = patch.mesh;
			if (patch.ghost != null) ghost = patch.ghost;
			if (patch.value !== undefined) value = norm(patch.value);
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
				return;
			}
			draw();
		},
		resize,
		snapshot() {
			draw();
			return canvas.toDataURL('image/png');
		},
		dispose() {
			ro?.disconnect();
		}
	};
}
