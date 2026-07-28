// @glowbox/split-flap — an electromechanical split-flap (Solari) display *component*,
// a sibling rendering core to the flip-dot board. The bar for existing at all (text
// on cards is a trivial CSS exercise) is the mechanism — everything a cross-fade
// can't do, modelled the way the real modules work:
//   • Each module is a DRUM of flap cards journalled at its circumference; the pin
//     line — the hinge — is the horizontal split through the window's centre. A card
//     carries the TOP half of one character on its front and the BOTTOM half of the
//     *next* character on its back; every displayed character is two half-cards.
//   • A flip is a RELEASE, not a tween: the drum steps, the catch lets the top card
//     go, and it falls under gravity about the hinge — slow off the catch,
//     accelerating, hard stop on the stack (with a settle bounce when it's the last
//     flap of a run). The next character's top half is already standing behind it
//     the moment it drops.
//   • The drum is a ratchet: it only rotates forward. Reaching an earlier character
//     wraps through the whole flap sequence — the cascading rattle that IS the
//     departure board. `charset` order is drum order.
//   • The fall renders with true perspective (the free edge swings toward the
//     viewer, magnifying near edge-on), drawn as projected strips — not a flat
//     scale-y squash.
//   • Chroma drums: `palette` marks flaps as solid paint instead of print, and a
//     wall of modules becomes a rough image display (`paletteFrame` maps pixels
//     onto the drum) — the colour-flap installations.
//   • Optional card slap (`sound`) via `createMechSound` — every landing clacks.
// Flat matte by default (the boards photograph as paint on plastic); `shaded: true`
// adds the lighting story. Give it a canvas; drive it with setText/setLine/setChar.
// Import-safe under node/SSR (no browser globals at module scope).
import { type Color, parseColor, type RGB } from './color';
import { DEFAULT_CHARSET, flapIndex, flapsOf, padCells } from './drum';
import { createMechSound, type MechSound } from './sound';

/** A flap's printed face, when it isn't just the drum grapheme in the board
 *  ink: another glyph, another ink, another card colour — any or all. */
export interface FlapFace {
	/** The printed character (default the flap's own grapheme). */
	glyph?: string;
	/** Its colour (default the board's `ink`). */
	ink?: Color;
	/** The card behind it (default the board's `card`). */
	paint?: Color;
}

export interface SplitFlapOptions {
	/** Modules per row / rows of modules (default 12×1 — one destination line). */
	cols?: number;
	rows?: number;
	/** The drum: flap sequence in rotation order (default `DRUM_NORDIC`).
	 *  Characters not on the drum display as blank. */
	charset?: string;
	/** Per-flap faces. A plain colour paints the whole card — a chroma flap, no
	 *  glyph (pair with `paletteFrame` for rough pictures). A face spec
	 *  re-prints the flap instead: `glyph` overrides the printed character,
	 *  `ink` its colour, `paint` the card behind it — so one drum can carry the
	 *  same letter twice in different colours, the way real boards kept a red
	 *  duplicate alphabet for DELAYED and CANCELLED. */
	palette?: Record<string, Color | FlapFace>;
	/** Flap card colour (default near-black plastic). */
	card?: Color;
	/** Printed character colour (default warm white). */
	ink?: Color;
	/** Frame behind/between the modules (default '#0c0c0f'). */
	board?: Color;
	/** Gap around each module as a fraction of the cell, 0..0.4 (default 0.08). */
	gap?: number;
	/** Character font family (default a Helvetica stack — the Solari letterform). */
	font?: string;
	/** Add the lighting story: card gradients, the top flap's shadow on the
	 *  stack, the ribbed pile of fallen cards under the bottom flap, recessed
	 *  module wells, the hinge clips in front of the flaps, the edge-on glint.
	 *  Default false — flat matte IS the authentic photographed look. */
	shaded?: boolean;
	/** One flap's fall, ms (default 90; 0 = instant — also forced under
	 *  `prefers-reduced-motion`). A run of flips is a fall per flap. */
	flipMs?: number;
	/** Card slap: true (= 0.5) or a 0..1 volume. Default off. Sound starts on the
	 *  first user gesture (autoplay policy); nothing to wire up. */
	sound?: boolean | number;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
	/** Accessible name (default 'split-flap display'; '' hides from the a11y
	 *  tree). The shown text is appended so the board reads as what it says. */
	label?: string;
}

export interface SplitFlapBoard {
	readonly cols: number;
	readonly rows: number;
	/** Replace the whole board: a string (newlines split rows) or one string per
	 *  row. Short lines pad with blanks; every module spins forward to its new
	 *  character. */
	setText(text: string | string[]): void;
	/** Replace one row. */
	setLine(row: number, text: string): void;
	/** Set one module. */
	setChar(x: number, y: number, ch: string): void;
	/** A module's *target* character (what it is spinning toward). */
	getChar(x: number, y: number): string;
	/** The board's target text, one string per row (trailing blanks trimmed). */
	getText(): string[];
	/** All blanks. */
	clear(): void;
	setOptions(patch: Partial<SplitFlapOptions>): void;
	resize(): void;
	snapshot(): string;
	dispose(): void;
}

const c255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
const rgba = (c: RGB, a: number) => `rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t
];
const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];

/** Create a split-flap board on a 2D canvas. Returns null if 2D is unavailable. */
export function createSplitFlap(
	canvas: HTMLCanvasElement,
	opts: SplitFlapOptions = {}
): SplitFlapBoard | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	let cols = Math.max(1, Math.floor(opts.cols ?? 12));
	let rows = Math.max(1, Math.floor(opts.rows ?? 1));
	let flaps = flapsOf(opts.charset ?? DEFAULT_CHARSET);
	let palette = opts.palette;
	let card = parseColor(opts.card ?? '#1b1c1f');
	let ink = parseColor(opts.ink ?? '#f4f4ef');
	let board = parseColor(opts.board ?? '#0c0c0f');
	let gap = Math.max(0, Math.min(0.4, opts.gap ?? 0.08));
	let font = opts.font ?? "'Helvetica Neue', Helvetica, Arial, sans-serif";
	let shaded = opts.shaded ?? false;
	let flipMs = opts.flipMs ?? 90;
	let volume = opts.sound === true ? 0.5 : Math.max(0, Math.min(1, Number(opts.sound) || 0));
	let pixelRatio = opts.pixelRatio ?? 2;
	let label = opts.label ?? 'split-flap display';
	let w = 0;
	let h = 0;
	let dpr = 1;

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Per-module state. `idx` is the flap at rest (the character shown, or being
	// departed from), `tgt` the flap being spun toward. `fall` is the in-flight
	// card's progress 0→1 (−1 = none), `bounce` the settle wobble of a just-landed
	// run-ending card, `wait` the serial-address scatter before a fresh command
	// starts. `jit` is each module's mechanical character — no two drums are timed
	// identically — reused for fall speed, bounce size and slap level.
	let n = cols * rows;
	let idx = new Int32Array(n);
	let tgt = new Int32Array(n);
	let fall = new Float32Array(n).fill(-1);
	let bounce = new Float32Array(n).fill(-1);
	let wait = new Float32Array(n);
	let jit = new Float32Array(n);
	const seedJit = () => {
		for (let i = 0; i < n; i++) jit[i] = Math.random();
	};
	seedJit();

	let raf = 0;
	let lastT = 0;
	let snd: MechSound | null = null;
	const sound = (): MechSound | null => {
		if (volume > 0 && !snd) snd = createMechSound({ volume });
		return volume > 0 ? snd : null;
	};
	// Slap budget: a board-wide update clacks freely, but a continuously-spinning
	// wall of modules settles to a sparse clatter instead of a buzz — kinder on the
	// ear AND on the audio graph.
	const SLAPS_PER_S = 60;
	let slapBudget = SLAPS_PER_S;

	// --- baked layers -----------------------------------------------------------
	// Half-card sprites are baked once per character per bake (lazily — a clock
	// board never pays for the drum's unused letters); per-frame work is drawImage.
	let cellW = 0;
	let cellH = 0;
	let cardW = 0; // module card, CSS px
	let cardH = 0;
	let split = 0; // the gap at the hinge line where the drum shows through
	let halfH = 0; // one flap's height about the hinge
	let hinge = 0; // hinge-line y within the cell (off-centre when shaded)
	let micro = false; // too small for physics — flat card + glyph, no flight
	let boardLayer: HTMLCanvasElement | null = null; // wells, behind the cards
	let hwLayer: HTMLCanvasElement | null = null; // hinge clips, in front of them
	type Faces = { top: HTMLCanvasElement; bottom: HTMLCanvasElement };
	const faces = new Map<string, Faces>();

	// Perspective: the viewer sits D half-card heights from the hinge plane. The
	// falling card's free edge swings toward the eye, so near edge-on it projects
	// *wider* than the window (×1.25 at D=5) — the physical tell a flat scale-y
	// squash can't fake.
	const PERSPECTIVE_D = 5;

	function bake() {
		cellW = w / cols;
		cellH = h / rows;
		split = Math.max(0.75, cellH * 0.018);
		cardW = cellW * (1 - gap);
		// Shaded modules reserve a band under the bottom flap for the FALLEN
		// stack — the ribbed pile of card edges the real modules show. The
		// hinge rides up with it; flat mode keeps the pair dead-centre.
		const stackH = shaded ? cellH * 0.1 : 0;
		cardH = cellH * (1 - gap) - split - stackH;
		halfH = cardH / 2;
		hinge = (cellH - cardH - split - stackH) / 2 + halfH + split / 2;
		micro = cellH * dpr < 10;
		faces.clear();
		if (micro) {
			boardLayer = hwLayer = null;
			return;
		}

		// The module wells: only the shaded look needs a board layer; flat mode
		// fills the background directly each frame.
		if (shaded) {
			const b = document.createElement('canvas');
			b.width = Math.max(1, Math.round(w * dpr));
			b.height = Math.max(1, Math.round(h * dpr));
			const g = b.getContext('2d')!;
			g.scale(dpr, dpr);
			g.fillStyle = rgba(board, 1);
			g.fillRect(0, 0, w, h);
			g.fillStyle = 'rgba(0,0,0,0.5)';
			g.shadowColor = 'rgba(0,0,0,0.6)';
			g.shadowBlur = cellH * 0.06;
			const m = Math.min(cellW, cellH) * 0.03;
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++)
					rr(
						g,
						x * cellW + (cellW - cardW) / 2 - m,
						y * cellH + (cellH - cardH - split - stackH) / 2 - m,
						cardW + 2 * m,
						cardH + split + stackH + 2 * m,
						Math.min(cardW, cardH) * 0.06,
						true
					);
			// The fallen stack — drawn as board geometry so it never rides a moving
			// flap: a ribbed band of card edges below the bottom flap, each catching
			// the light over its shadow gap (the real modules show three or four). NOTHING shows at the top: the upcoming reserve hides behind the
			// housing, so the top card reads clean to its edge.
			g.shadowBlur = 0;
			const e = Math.max(0.75, stackH * 0.14);
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++) {
					const cx = x * cellW + (cellW - cardW) / 2;
					const hy = y * cellH + hinge;
					const slats = 3;
					for (let i = 0; i < slats; i++) {
						const sy = hy + split / 2 + halfH + 1 + i * ((stackH - 2) / slats);
						g.fillStyle = rgba(mix(card, WHITE, 0.22), 0.9);
						g.fillRect(cx + cardW * 0.03, sy, cardW * 0.94, e);
						g.fillStyle = 'rgba(0,0,0,0.42)';
						g.fillRect(cx + cardW * 0.03, sy + e, cardW * 0.94, (stackH - 2) / slats - e);
					}
				}
			boardLayer = b;

			// The hinge clips: the retaining tabs that hold the flap pins, sitting IN
			// FRONT of the cards at mid-height (they fill the pin cuts). Static
			// hardware → baked once, one blit per frame, drawn over everything —
			// falling cards pass behind them, exactly as on the real module.
			const hw = document.createElement('canvas');
			hw.width = b.width;
			hw.height = b.height;
			const hg = hw.getContext('2d')!;
			hg.scale(dpr, dpr);
			const clipW = Math.max(1.5, cardW * 0.05);
			const clipH = Math.max(3, cardH * 0.13);
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++) {
					const cx = x * cellW + cellW / 2;
					const hy = y * cellH + hinge;
					for (const side of [-1, 1]) {
						const cxs = cx + (side * cardW) / 2 - clipW / 2 + side * clipW * 0.15;
						hg.fillStyle = 'rgba(0,0,0,0.45)'; // its drop shadow
						rr(hg, cxs + 0.5, hy - clipH / 2 + 1, clipW, clipH, clipW * 0.35, true);
						hg.fillStyle = '#565b62';
						rr(hg, cxs, hy - clipH / 2, clipW, clipH, clipW * 0.35, true);
						hg.fillStyle = 'rgba(255,255,255,0.22)'; // catching the light
						rr(hg, cxs, hy - clipH / 2, clipW, clipH * 0.3, clipW * 0.35, true);
					}
				}
			hwLayer = hw;
		} else {
			boardLayer = hwLayer = null;
		}
	}

	function rr(
		g: CanvasRenderingContext2D,
		x: number,
		y: number,
		w2: number,
		h2: number,
		r: number,
		fill = false
	) {
		r = Math.min(r, w2 / 2, h2 / 2);
		g.beginPath();
		g.moveTo(x + r, y);
		g.arcTo(x + w2, y, x + w2, y + h2, r);
		g.arcTo(x + w2, y + h2, x, y + h2, r);
		g.arcTo(x, y + h2, x, y, r);
		g.arcTo(x, y, x + w2, y, r);
		g.closePath();
		if (fill) g.fill();
	}

	// One character's two half-card sprites. The full card is drawn once — rounded
	// corners, the glyph, the journal-pin corner cuts at the hinge (real flaps are
	// cut where the pins ride the drum slots; the cuts are geometry, not shading,
	// so flat mode keeps them) — then sliced at the hinge line.
	function face(ch: string): Faces {
		const hit = faces.get(ch);
		if (hit) return hit;
		const W = Math.max(2, Math.ceil(cardW * dpr));
		const H = Math.max(2, Math.ceil(cardH * dpr));
		const full = document.createElement('canvas');
		full.width = W;
		full.height = H;
		const g = full.getContext('2d')!;
		// A plain-colour palette entry is a chroma flap: paint, not print. A face
		// spec re-prints the flap — its own glyph, ink and card colour.
		const spec = palette?.[ch];
		const isPaint = typeof spec === 'string' || Array.isArray(spec);
		const facePaint = isPaint ? spec : spec?.paint;
		const paint = facePaint != null ? parseColor(facePaint) : null;
		const base = paint ?? card;
		const glyph = isPaint ? ' ' : (spec?.glyph ?? ch);
		const glyphInk = !isPaint && spec?.ink != null ? parseColor(spec.ink) : ink;
		if (!shaded) {
			g.fillStyle = rgba(base, 1);
		} else {
			// Plastic card lit from above: a lift toward the top edge, the base
			// colour through the middle, darker toward the bottom.
			const grad = g.createLinearGradient(0, 0, 0, H);
			grad.addColorStop(0, rgba(mix(base, WHITE, 0.12), 1));
			grad.addColorStop(0.45, rgba(base, 1));
			grad.addColorStop(1, rgba(mix(base, BLACK, 0.22), 1));
			g.fillStyle = grad;
		}
		rr(g, 0, 0, W, H, Math.min(W, H) * 0.07, true);
		if (glyph !== ' ') {
			// The letterform: large, slightly condensed, centred on the FULL card so
			// the two halves meet exactly at the split.
			g.fillStyle = rgba(glyphInk, 1);
			let fontPx = Math.round(H * 0.74);
			g.font = `600 ${fontPx}px ${font}`;
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			let m = g.measureText(glyph).width;
			if (m > W * 0.82 && [...glyph].length > 1) {
				// A word flap ('DELAYED' printed across one card — the real boards'
				// remark flaps): shrink the type to fit instead of condensing a
				// letter-sized face into a smear.
				fontPx = Math.max(4, Math.floor((fontPx * W * 0.82) / m));
				g.font = `600 ${fontPx}px ${font}`;
				m = g.measureText(glyph).width;
			}
			const sx = Math.min(1, (W * 0.8) / Math.max(1, m)) * 0.94;
			g.setTransform(sx, 0, 0, 1, W / 2, H * 0.54);
			g.fillText(glyph, 0, 0);
			g.setTransform(1, 0, 0, 1, 0, 0);
		}
		// The pin cuts: a nick out of each side at the hinge line.
		g.globalCompositeOperation = 'destination-out';
		const nw = W * 0.05;
		const nh = H * 0.045;
		g.fillRect(-1, H / 2 - nh, nw + 1, 2 * nh);
		g.fillRect(W - nw, H / 2 - nh, nw + 1, 2 * nh);
		g.globalCompositeOperation = 'source-over';

		const Hh = Math.round(H / 2);
		const slice = (sy: number, sh: number, shadowTop: boolean): HTMLCanvasElement => {
			const c = document.createElement('canvas');
			c.width = W;
			c.height = sh;
			const cg = c.getContext('2d')!;
			cg.drawImage(full, 0, sy, W, sh, 0, 0, W, sh);
			if (shaded && shadowTop) {
				// The resting top flap overhangs the stack — a soft shadow just
				// below the split, the depth cue every real module carries.
				const sg = cg.createLinearGradient(0, 0, 0, sh * 0.22);
				sg.addColorStop(0, 'rgba(0,0,0,0.4)');
				sg.addColorStop(1, 'rgba(0,0,0,0)');
				cg.fillStyle = sg;
				cg.fillRect(0, 0, W, sh * 0.22);
			}
			return c;
		};
		const f: Faces = { top: slice(0, Hh, false), bottom: slice(Hh, H - Hh, true) };
		faces.set(ch, f);
		return f;
	}

	// --- the fall ----------------------------------------------------------------
	// θ over the fall: released from the catch at the top (unstable equilibrium),
	// gravity torque grows with the swing — slow start, accelerating, no ease-out:
	// the stop is the stack. t^1.7 tracks the pendulum inversion closely enough.
	const theta = (t: number) => Math.PI * Math.pow(t, 1.7);

	// Project one face of the in-flight card as horizontal strips. `sprite` is a
	// half-card with its hinge edge at the bottom (top faces) or top (bottom
	// faces); `c` = |cos θ| (extent), `s` = sin θ (depth toward the viewer);
	// `up` draws above the hinge (the front face), else below (the back).
	function flyFace(
		g: CanvasRenderingContext2D,
		sprite: HTMLCanvasElement,
		cx: number,
		hy: number,
		c: number,
		s: number,
		up: boolean
	) {
		const strips = Math.max(2, Math.min(12, Math.round(halfH / 5)));
		const SH = sprite.height;
		const mag = (v: number) => PERSPECTIVE_D / (PERSPECTIVE_D - v * s);
		const proj = (v: number) => v * halfH * c * mag(v);
		for (let i = 0; i < strips; i++) {
			const v0 = i / strips;
			const v1 = (i + 1) / strips;
			const y0 = proj(v0);
			const y1 = proj(v1);
			const dh = y1 - y0;
			if (dh < 0.05) continue;
			const dw = cardW * mag((v0 + v1) / 2);
			// v runs hinge→free edge; on a top-face sprite the hinge is the BOTTOM row.
			const sy = up ? SH * (1 - v1) : SH * v0;
			const dy = up ? hy - split / 2 - y1 : hy + split / 2 + y0;
			g.drawImage(sprite, 0, sy, sprite.width, SH / strips, cx - dw / 2, dy, dw, dh);
		}
		// Near edge-on the card is all thickness: a sliver at the projected free
		// edge, magnified past the window width — the card pointing at you.
		if (c < 0.18) {
			const a = 1 - c / 0.18;
			g.fillStyle = shaded ? `rgba(255,252,240,${0.35 * a})` : rgba(mix(card, WHITE, 0.25), a);
			const ew = cardW * mag(1);
			const ey = up ? hy - split / 2 - proj(1) : hy + split / 2 + proj(1);
			g.fillRect(cx - ew / 2, ey - 0.75, ew, 1.5);
		}
	}

	function draw() {
		if (!w || !h) return;
		const g = ctx!;
		g.setTransform(1, 0, 0, 1, 0, 0);
		if (boardLayer) {
			g.drawImage(boardLayer, 0, 0);
			g.scale(dpr, dpr);
		} else {
			g.scale(dpr, dpr);
			g.fillStyle = rgba(board, 1);
			g.fillRect(0, 0, w, h);
		}
		if (micro) {
			// Degenerate size: cards and glyphs, no mechanism — still a correct
			// picture. Chroma flaps keep their paint (a tiny image wall must stay an
			// image, not turn into the drum's address letters) and face specs keep
			// their glyph and ink.
			g.font = `600 ${Math.max(2, cellH * 0.7)}px ${font}`;
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			for (let i = 0; i < n; i++) {
				const ch = flaps[fall[i] > 0.5 ? (idx[i] + 1) % flaps.length : idx[i]];
				const spec = palette?.[ch];
				const isPaint = typeof spec === 'string' || Array.isArray(spec);
				g.fillStyle = rgba(isPaint ? parseColor(spec) : card, 1);
				g.fillRect(
					(i % cols) * cellW + (cellW - cardW) / 2,
					((i / cols) | 0) * cellH + (cellH - cardH) / 2,
					Math.max(1, cardW),
					Math.max(1, cardH)
				);
				if (isPaint) continue;
				const glyph = spec?.glyph ?? ch;
				if (glyph === ' ') continue;
				g.fillStyle = rgba(spec?.ink != null ? parseColor(spec.ink) : ink, 1);
				g.fillText(glyph, ((i % cols) + 0.5) * cellW, (((i / cols) | 0) + 0.5) * cellH);
			}
			return;
		}
		const N = flaps.length;
		// Pass 1 — every module's resting halves. During a fall the next character's
		// top half is ALREADY standing behind the dropping card (it came around the
		// drum with it), and the old bottom half stays until the card lands on it. A
		// bouncing module lifts its just-landed card, re-revealing the half beneath.
		for (let i = 0; i < n; i++) {
			const cx = (i % cols) * cellW + cellW / 2;
			const hy = ((i / cols) | 0) * cellH + hinge;
			const falling = fall[i] >= 0;
			const topCh = flaps[falling ? (idx[i] + 1) % N : idx[i]];
			// Mid-bounce the lifted card re-reveals the previous stack top beneath it.
			const botCh = flaps[bounce[i] >= 0 ? (idx[i] - 1 + N) % N : idx[i]];
			g.drawImage(face(topCh).top, cx - cardW / 2, hy - split / 2 - halfH, cardW, halfH);
			g.drawImage(face(botCh).bottom, cx - cardW / 2, hy + split / 2, cardW, halfH);
		}
		// Pass 2 — everything in flight, over the resting board (a dropping card is
		// nearer the viewer than any neighbour's window).
		for (let i = 0; i < n; i++) {
			const cx = (i % cols) * cellW + cellW / 2;
			const hy = ((i / cols) | 0) * cellH + hinge;
			if (fall[i] >= 0) {
				const th = theta(fall[i]);
				const cosT = Math.cos(th);
				const sinT = Math.sin(th);
				if (shaded && sinT > 0.05) {
					// The card overhangs the stack — its shadow sweeps the bottom half.
					g.fillStyle = `rgba(0,0,0,${0.3 * sinT})`;
					g.fillRect(cx - cardW / 2, hy + split / 2, cardW, halfH);
				}
				if (cosT >= 0) flyFace(g, face(flaps[idx[i]]).top, cx, hy, cosT, sinT, true);
				else flyFace(g, face(flaps[(idx[i] + 1) % N]).bottom, cx, hy, -cosT, sinT, false);
			} else if (bounce[i] >= 0) {
				// The settle: the landed card kicks up a few degrees and drops back.
				const phi = (0.12 + 0.1 * jit[i]) * Math.sin(Math.PI * bounce[i]);
				flyFace(g, face(flaps[idx[i]]).bottom, cx, hy, Math.cos(phi), Math.sin(phi), false);
			}
		}
		// Pass 3 — the fixed hardware in front of the flaps (shaded only).
		if (hwLayer) {
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.drawImage(hwLayer, 0, 0);
			g.scale(dpr, dpr);
		}
	}

	// --- animation ---------------------------------------------------------------
	// rAF runs only while a module is waiting, falling or settling; a resting board
	// costs nothing.
	function animate() {
		if (reduced || flipMs <= 0) {
			for (let i = 0; i < n; i++) {
				idx[i] = tgt[i];
				fall[i] = -1;
				bounce[i] = -1;
				wait[i] = 0;
			}
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
			slapBudget = Math.min(SLAPS_PER_S, slapBudget + dt * SLAPS_PER_S);
			const N = flaps.length;
			let moving = false;
			let lands = 0;
			let landSum = 0; // for the average pan of this frame's slaps
			for (let i = 0; i < n; i++) {
				if (wait[i] > 0) {
					wait[i] -= dt;
					moving = true;
					if (wait[i] > 0) continue;
					wait[i] = 0;
					// The command may have been retracted during the scatter — a drum
					// that hasn't released yet doesn't owe a full wrap-around.
					if (idx[i] !== tgt[i]) fall[i] = 0;
					continue;
				}
				if (fall[i] >= 0) {
					// Each drum is its own machine — a row spinning together drifts apart.
					fall[i] += dt / ((flipMs / 1000) * (0.85 + 0.3 * jit[i]));
					if (fall[i] >= 1) {
						idx[i] = (idx[i] + 1) % N;
						lands++;
						landSum += i % cols;
						if (idx[i] !== tgt[i]) fall[i] = 0;
						else {
							fall[i] = -1;
							bounce[i] = 0;
						}
					}
					moving = true;
				} else if (bounce[i] >= 0) {
					bounce[i] += dt / (0.1 * (0.8 + 0.4 * jit[i]));
					if (bounce[i] >= 1) bounce[i] = -1;
					moving = true;
				}
			}
			if (lands > 0) slaps(lands, landSum / lands);
			draw();
			if (moving) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}

	// The clack: each frame's landings become at most a few slaps — a full-board
	// cascade reads as clatter, not as N oscillators. Gain falls as density rises,
	// pan follows the landing column. Recipe: a card landing on a card stack is a
	// soft, PAPERY thud — band-limited noise (the lowpass is what keeps it from
	// reading sharp or plastic) over a low stack thump, plus the faintest dry tick
	// of an attack. No pitched ping anywhere: pings are what plastic sounds like.
	// Wide slap-to-slap level spread — real mechanisms are anything but uniform.
	function slaps(count: number, meanCol: number) {
		const s = sound();
		if (!s) return;
		const play = Math.min(count, 3, Math.floor(slapBudget));
		if (play <= 0) return;
		slapBudget -= play;
		const g = Math.min(1, 1.6 / count) * 0.7 + 0.3;
		const pan = cols > 1 ? (meanCol / (cols - 1)) * 1.4 - 0.7 : 0;
		for (let i = 0; i < play; i++) {
			const j = Math.random();
			const gj = g * (0.3 + 0.7 * j * j);
			const at = j * 0.014;
			// The body: the stack taking the hit under a papery burst.
			s.tick({
				delay: at,
				freq: 140 + j * 90,
				decay: 0.012 + j * 0.01,
				noise: 1,
				noiseHz: 350,
				noiseLpHz: 3000 + j * 1500,
				noiseDecay: 0.014 + j * 0.014,
				gain: gj,
				pan
			});
			// The attack: a soft noise-only articulation — the ping sits below
			// snapping range (a 2 ms burst at 400 Hz is one silent cycle), so the
			// tick shapes the thud's onset without a click of its own.
			s.tick({
				delay: at + 0.002,
				freq: 400 + j * 200,
				decay: 0.002,
				noise: 0.7,
				noiseHz: 1200,
				noiseLpHz: 3600,
				noiseDecay: 0.006,
				gain: gj * 0.2,
				pan
			});
		}
	}

	// --- commands ------------------------------------------------------------------
	function command(i: number, ch: string) {
		const t = flapIndex(flaps, ch);
		if (t === tgt[i]) return;
		tgt[i] = t;
		if (fall[i] < 0 && wait[i] <= 0 && idx[i] !== t) {
			// A fresh start gets the serial-address scatter (modules are strobed one
			// after another, never in perfect sync); an already-spinning drum just
			// keeps stepping toward the new target.
			bounce[i] = -1;
			wait[i] = 0.005 + jit[i] * 0.045;
		}
	}

	function applyAria() {
		canvas.setAttribute('role', 'img');
		if (label) {
			const text = getLines()
				.filter((l) => l.length > 0)
				.join(' / ');
			canvas.setAttribute('aria-label', text ? `${label}: ${text}` : label);
			canvas.removeAttribute('aria-hidden');
		} else {
			canvas.setAttribute('aria-hidden', 'true');
			canvas.removeAttribute('aria-label');
		}
	}

	const getLines = (): string[] => {
		const out: string[] = [];
		for (let y = 0; y < rows; y++) {
			let line = '';
			for (let x = 0; x < cols; x++) line += flaps[tgt[y * cols + x]];
			out.push(line.replace(/\s+$/, ''));
		}
		return out;
	};

	function resize() {
		const cap = pixelRatio > 0 ? pixelRatio : 1;
		dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cap);
		const r = canvas.getBoundingClientRect();
		w = Math.max(1, r.width || canvas.clientWidth || 1);
		h = Math.max(1, r.height || canvas.clientHeight || 1);
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		bake();
		draw();
	}

	applyAria();
	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	ro?.observe(canvas);
	resize();

	return {
		get cols() {
			return cols;
		},
		get rows() {
			return rows;
		},
		setText(text) {
			const lines = Array.isArray(text) ? text : text.split('\n');
			for (let y = 0; y < rows; y++) {
				const line = padCells(lines[y] ?? '', cols);
				for (let x = 0; x < cols; x++) command(y * cols + x, line[x]);
			}
			applyAria();
			animate();
		},
		setLine(row, text) {
			row = Math.floor(row);
			if (row < 0 || row >= rows) return;
			const line = padCells(text, cols);
			for (let x = 0; x < cols; x++) command(row * cols + x, line[x]);
			applyAria();
			animate();
		},
		setChar(x, y, ch) {
			x = Math.floor(x);
			y = Math.floor(y);
			if (x < 0 || x >= cols || y < 0 || y >= rows) return;
			command(y * cols + x, flapsOf(ch)[0] ?? ' ');
			applyAria();
			animate();
		},
		getChar(x, y) {
			x = Math.floor(x);
			y = Math.floor(y);
			if (x < 0 || x >= cols || y < 0 || y >= rows) return ' ';
			return flaps[tgt[y * cols + x]];
		},
		getText: getLines,
		clear() {
			this.setText([]);
		},
		setOptions(patch) {
			let rebake = false;
			let regrid = false;
			if (patch.cols != null && Math.floor(patch.cols) !== cols) {
				cols = Math.max(1, Math.floor(patch.cols));
				regrid = true;
			}
			if (patch.rows != null && Math.floor(patch.rows) !== rows) {
				rows = Math.max(1, Math.floor(patch.rows));
				regrid = true;
			}
			if (regrid) {
				// New geometry: preserve nothing (a re-tiled board powers up blank).
				n = cols * rows;
				idx = new Int32Array(n);
				tgt = new Int32Array(n);
				fall = new Float32Array(n).fill(-1);
				bounce = new Float32Array(n).fill(-1);
				wait = new Float32Array(n);
				jit = new Float32Array(n);
				seedJit();
				rebake = true;
				applyAria(); // the re-tiled board reads blank until the next setText
			}
			// After regrid, so a combined {cols, rows, charset} patch re-cards the
			// NEW grid (a re-tiled board has no text to keep anyway).
			if (patch.charset != null && patch.charset !== flaps.join('')) {
				// A new drum is a re-carding: the modules come back showing their
				// current text on the new flap sequence, instantly.
				const keep = regrid ? [] : getLines();
				flaps = flapsOf(patch.charset);
				for (let y = 0; y < rows; y++) {
					const line = padCells(keep[y] ?? '', cols);
					for (let x = 0; x < cols; x++) {
						const i = y * cols + x;
						tgt[i] = idx[i] = flapIndex(flaps, line[x]);
						fall[i] = bounce[i] = -1;
						wait[i] = 0;
					}
				}
				rebake = true;
			}
			if (patch.palette !== undefined) {
				// `{}` (or any fresh map) swaps the paint set; the faces re-bake.
				palette = patch.palette;
				rebake = true;
			}
			if (patch.card != null) {
				card = parseColor(patch.card);
				rebake = true;
			}
			if (patch.ink != null) {
				ink = parseColor(patch.ink);
				rebake = true;
			}
			if (patch.board != null) {
				board = parseColor(patch.board);
				rebake = true;
			}
			if (patch.gap != null) {
				gap = Math.max(0, Math.min(0.4, patch.gap));
				rebake = true;
			}
			if (patch.font != null) {
				font = patch.font;
				rebake = true;
			}
			if (patch.shaded != null) {
				shaded = patch.shaded;
				rebake = true;
			}
			if (patch.flipMs != null) flipMs = patch.flipMs;
			if (patch.sound !== undefined) {
				volume = patch.sound === true ? 0.5 : Math.max(0, Math.min(1, Number(patch.sound) || 0));
				snd?.setVolume(volume);
			}
			if (patch.label !== undefined) {
				label = patch.label;
				applyAria();
			}
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
				rebake = false; // resize() baked already
			}
			if (rebake) {
				bake();
				draw();
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
			snd?.dispose();
			// Hand the consumer's canvas back without our ARIA (it may be reused).
			canvas.removeAttribute('role');
			canvas.removeAttribute('aria-label');
			canvas.removeAttribute('aria-hidden');
		}
	};
}
